"""LiveKit speech and model-invoked address tools. No persistent transcript logging."""
import asyncio
import contextlib
import json
import logging
import os
from pathlib import Path
from address_agent import AddressToolAgent

from livekit import rtc
from livekit.agents import AgentServer, JobContext, cli, inference, stt

TOPIC = 'finvoice.voice'
logger = logging.getLogger('finvoice.voice')


class SpeechBridge:
    """Sequence every turn so delayed RPCs cannot speak obsolete results."""
    def __init__(self, source, tts, emit):
        self.source, self.tts, self.emit = source, tts, emit
        self.version = 0
        self.task = None

    async def stop(self, version):
        if not isinstance(version, int) or isinstance(version, bool) or version < self.version:
            return False
        self.version = version
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
            self.task = None
        self.source.clear_queue()
        return True

    async def speak(self, version, text, *, current_turn=False):
        if not isinstance(text, str) or not text.strip() or len(text) > 4000:
            raise ValueError('Invalid speech text')
        if not isinstance(version, int) or isinstance(version, bool) or version < self.version or (version == self.version and not current_turn):
            return False
        await self.stop(version)
        self.task = asyncio.create_task(self._play(version, text))
        return True

    async def _play(self, version, text):
        try:
            async with self.tts.synthesize(text) as stream:
                first = True
                async for chunk in stream:
                    if version != self.version:
                        return
                    if first:
                        await self.emit({'type': 'speech_started', 'id': version})
                        first = False
                    await self.source.capture_frame(chunk.frame)
            if first:
                raise ValueError('No speech audio returned')
            await self.source.wait_for_playout()
            await self.emit({'type': 'speech_done', 'id': version})
        except asyncio.CancelledError:
            raise
        except Exception:
            # Provider exception details may contain user text or credentials.
            await self.emit({'type': 'speech_error', 'id': version})


class Transcription:
    def __init__(self, model, emit, on_final=None):
        self.model, self.emit, self.on_final = model, emit, on_final
        self.version = 0
        self.stream = None
        self.task = None

    async def stop(self):
        self.version = 0
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
            self.task = None
        if self.stream:
            await self.stream.aclose()
            self.stream = None

    async def start(self, version):
        await self.stop()
        self.version = version
        self.stream = self.model.stream()
        self.task = asyncio.create_task(self._read(version, self.stream))

    async def _read(self, version, stream):
        text = ''
        reported = False
        final_segments = []
        try:
            async for event in stream:
                if self.version != version:
                    return
                if event.type in (stt.SpeechEventType.INTERIM_TRANSCRIPT, stt.SpeechEventType.FINAL_TRANSCRIPT):
                    segment = event.alternatives[0].text if event.alternatives else ''
                    if event.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
                        if segment:final_segments.append(segment)
                        text = ' '.join(final_segments)
                    else:
                        text = ' '.join(final_segments + ([segment] if segment else []))
                    if text and not reported:
                        logger.info('transcription received', extra={'turn': version})
                        reported = True
                    await self.emit({'type': 'transcript', 'id': version, 'text': text, 'final': False})
                if event.type == stt.SpeechEventType.END_OF_SPEECH and text.strip():
                    await self.emit({'type': 'transcript', 'id': version, 'text': text, 'final': True})
                    if self.on_final:self.on_final(version,text)
                    return
            if self.version == version:
                await self.emit({'type': 'transcript', 'id': version, 'text': text, 'final': True})
                if self.on_final and text.strip():self.on_final(version,text)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error('transcription stream failed', extra={'error_type': type(error).__name__})
            await self.emit({'type': 'input_error', 'id': version})

    def push(self, frame):
        if self.stream and self.task and not self.task.done():
            self.stream.push_frame(frame)

    def finish(self):
        if self.stream and self.task and not self.task.done():
            self.stream.end_input()


async def forward_audio(track, transcription, stream_factory=rtc.AudioStream):
    version = transcription.version
    frames = stream_factory(track, sample_rate=16000, num_channels=1)
    received = False
    try:
        async for event in frames:
            if version and version == transcription.version:
                if not received:
                    logger.info('microphone audio received', extra={'turn': version})
                    received = True
                transcription.push(event.frame)
    finally:
        await frames.aclose()


# One idle process keeps dispatch warm without local model downloads.
server = AgentServer(num_idle_processes=1, host='0.0.0.0', port=8081,
                     http_proxy=os.environ.get('HTTPS_PROXY'))


@server.on('worker_registered')
def registered(worker_id, server_info):
    if path := os.environ.get('FINVOICE_WORKER_READY_FILE'):
        Path(path).write_text('registered')


@server.rtc_session(agent_name='finvoice')
async def entrypoint(ctx: JobContext):
    owner = json.loads(ctx.job.metadata).get('participant')
    if not isinstance(owner, str) or not owner.startswith('browser-'):
        raise ValueError('Missing browser participant identity')
    await ctx.connect()

    async def emit(message):
        await ctx.room.local_participant.publish_data(json.dumps(message), reliable=True,
            destination_identities=[owner], topic=TOPIC)

    speech_model = inference.TTS('cartesia/sonic-3', voice='9626c31c-bec5-4cca-baa8-f8ba9e84c8bc')
    transcription_model = inference.STT('deepgram/nova-3', language='en')
    source = rtc.AudioSource(speech_model.sample_rate, speech_model.num_channels, queue_size_ms=100)
    track = rtc.LocalAudioTrack.create_audio_track('finvoice-answer', source)
    await ctx.room.local_participant.publish_track(track,
        rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
    speech = SpeechBridge(source, speech_model, emit)
    tool_task = None

    async def invoke_tool(payload):
        response = await ctx.room.local_participant.perform_rpc(
            destination_identity=owner, method='finvoice.address_tool',
            payload=json.dumps(payload), response_timeout=10)
        return json.loads(response)

    address_agent = AddressToolAgent(invoke_tool, emit)

    async def resolve_and_speak(version, text):
        try:
            await transcription.stop()
            result = await asyncio.wait_for(address_agent.resolve(version,text),timeout=50)
            async with control_lock:
                if version != speech.version:return
                await emit({'type':'address_result','id':version,'result':result})
                address_agent.commit(result)
                if result.get('speech'):
                    await speech.speak(version,result['speech'],current_turn=True)
                else:
                    await emit({'type':'speech_done','id':version})
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error('address tool turn failed',extra={'error_type':type(error).__name__})
            if version == speech.version:
                await emit({'type':'tool_error','id':version})

    def schedule_turn(version,text):
        nonlocal tool_task
        tool_task = asyncio.create_task(resolve_and_speak(version,text))

    async def cancel_tools():
        nonlocal tool_task
        if tool_task:
            tool_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):await tool_task
            tool_task = None

    transcription = Transcription(transcription_model, emit, schedule_turn)
    audio_tasks = set()
    control_lock = asyncio.Lock()

    async def read_audio(track):
        version = transcription.version
        try:
            await forward_audio(track, transcription)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error('microphone stream failed', extra={'error_type': type(error).__name__})
            if version and version == transcription.version:
                with contextlib.suppress(Exception):
                    await emit({'type': 'input_error', 'id': version})

    @ctx.room.on('track_subscribed')
    def subscribed(track, publication, participant):
        if participant.identity == owner and track.kind == rtc.TrackKind.KIND_AUDIO:
            task = asyncio.create_task(read_audio(track))
            audio_tasks.add(task)
            task.add_done_callback(audio_tasks.discard)

    @ctx.room.local_participant.register_rpc_method('finvoice.control')
    async def control(data: rtc.RpcInvocationData):
        if data.caller_identity != owner:
            raise rtc.RpcError(1401, 'Not authorized')
        try:
            payload = json.loads(data.payload)
            action, version = payload.get('action'), payload.get('id')
            if action == 'ready':
                return 'ready'
            if not isinstance(version, int) or isinstance(version, bool) or version <= 0:
                raise ValueError('Invalid turn')
            async with control_lock:
                if action == 'resolve':
                    if version <= speech.version:return 'stale'
                    text = payload.get('text')
                    if not isinstance(text,str) or not text.strip() or len(text)>250:raise ValueError('Invalid address text')
                    await cancel_tools()
                    await speech.stop(version)
                    await transcription.stop()
                    schedule_turn(version,text)
                    return 'accepted'
                if action == 'speak':
                    if version <= speech.version:
                        return 'stale'
                    await cancel_tools()
                    await transcription.stop()
                    return 'ok' if await speech.speak(version, payload.get('text')) else 'stale'
                if action == 'finish':
                    if version == transcription.version:
                        transcription.finish()
                    return 'ok'
                if action in ('listen', 'stop'):
                    if not await speech.stop(version):
                        return 'stale'
                    await cancel_tools()
                    await transcription.stop()
                    if action == 'listen':
                        await transcription.start(version)
                    return 'ok'
                raise ValueError('Invalid command')
        except (ValueError, TypeError, AttributeError):
            raise rtc.RpcError(1400, 'Invalid voice command') from None

    done = asyncio.Event()

    @ctx.room.on('participant_disconnected')
    def left(participant):
        if participant.identity == owner:
            done.set()

    async def cleanup():
        await cancel_tools()
        await address_agent.aclose()
        await transcription.stop()
        await speech.stop(speech.version + 1)
        for task in audio_tasks:
            task.cancel()
        await asyncio.gather(*audio_tasks, return_exceptions=True)
        await transcription_model.aclose()
        await speech_model.aclose()
        await source.aclose()

    await ctx.room.local_participant.set_metadata(json.dumps({'finvoiceReady': True, 'toolsVersion': 1}))
    ctx.add_shutdown_callback(cleanup)
    await ctx.wait_for_participant(identity=owner)
    await done.wait()
    ctx.shutdown(reason='browser disconnected')


if __name__ == '__main__':
    cli.run_app(server)
