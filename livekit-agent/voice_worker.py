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

TOPIC = "finvoice.voice"
logger = logging.getLogger("finvoice.voice")


class SpeechBridge:
    """Sequence every turn so delayed RPCs cannot speak obsolete results."""

    def __init__(self, audio_source, speech_synthesizer, emit_voice_event):
        """Own an RTC audio source, TTS provider, event emitter and cancellable playback task."""
        self.source, self.tts, self.emit = (
            audio_source,
            speech_synthesizer,
            emit_voice_event,
        )
        self.version = 0
        self.task = None

    async def stop(self, turn_id):
        """Reject stale/noninteger versions; otherwise cancel playback, drain its task and clear queued audio."""
        if (
            not isinstance(turn_id, int)
            or isinstance(turn_id, bool)
            or turn_id < self.version
        ):
            return False
        self.version = turn_id
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
            self.task = None
        self.source.clear_queue()
        return True

    async def speak(self, turn_id, speech_text, *, current_turn=False):
        """Validate text up to 4000 characters and schedule versioned playback; same-turn speech requires current_turn."""
        if (
            not isinstance(speech_text, str)
            or not speech_text.strip()
            or len(speech_text) > 4000
        ):
            raise ValueError("Invalid speech text")
        if (
            not isinstance(turn_id, int)
            or isinstance(turn_id, bool)
            or turn_id < self.version
            or (turn_id == self.version and not current_turn)
        ):
            return False
        await self.stop(turn_id)
        self.task = asyncio.create_task(self._play(turn_id, speech_text))
        return True

    async def _play(self, turn_id, speech_text):
        """Stream synthesized frames while current, wait for playout and emit completion; sanitize provider failures and propagate cancellation."""
        try:
            async with self.tts.synthesize(speech_text) as stream:
                first = True
                async for chunk in stream:
                    if turn_id != self.version:
                        return
                    if first:
                        await self.emit({"type": "speech_started", "id": turn_id})
                        first = False
                    await self.source.capture_frame(chunk.frame)
            if first:
                raise ValueError("No speech audio returned")
            await self.source.wait_for_playout()
            await self.emit({"type": "speech_done", "id": turn_id})
        except asyncio.CancelledError:
            raise
        except Exception:
            # Provider exception details may contain user text or credentials.
            await self.emit({"type": "speech_error", "id": turn_id})


class Transcription:
    """Own one cancellable STT stream; accumulate final segments and emit interim/final browser events without storing history."""

    def __init__(self, transcription_model, emit_voice_event, on_final_transcript=None):
        """Inject the STT model/emitter and optional synchronous final callback; start with no stream."""
        self.model, self.emit, self.on_final = (
            transcription_model,
            emit_voice_event,
            on_final_transcript,
        )
        self.version = 0
        self.stream = None
        self.task = None

    async def stop(self):
        """Invalidate the active version, cancel and await the reader, then close its provider stream."""
        self.version = 0
        if self.task:
            self.task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self.task
            self.task = None
        if self.stream:
            await self.stream.aclose()
            self.stream = None

    async def start(self, turn_id):
        """Close previous input and start a versioned provider stream with a background reader task."""
        await self.stop()
        self.version = turn_id
        self.stream = self.model.stream()
        self.task = asyncio.create_task(self._read(turn_id, self.stream))

    async def _read(self, turn_id, stream):
        """Accumulate final segments without dropping house-number fragments; emit interim updates and finalize on end-of-speech or exhaustion. Log error type only."""
        transcript_text = ""
        has_reported_transcription = False
        final_segments = []
        try:
            async for event in stream:
                if self.version != turn_id:
                    return
                if event.type in (
                    stt.SpeechEventType.INTERIM_TRANSCRIPT,
                    stt.SpeechEventType.FINAL_TRANSCRIPT,
                ):
                    segment = event.alternatives[0].text if event.alternatives else ""
                    if event.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
                        if segment:
                            final_segments.append(segment)
                        transcript_text = " ".join(final_segments)
                    else:
                        transcript_text = " ".join(
                            final_segments + ([segment] if segment else [])
                        )
                    if transcript_text and not has_reported_transcription:
                        logger.info("transcription received", extra={"turn": turn_id})
                        has_reported_transcription = True
                    await self.emit(
                        {
                            "type": "transcript",
                            "id": turn_id,
                            "text": transcript_text,
                            "final": False,
                        }
                    )
                if (
                    event.type == stt.SpeechEventType.END_OF_SPEECH
                    and transcript_text.strip()
                ):
                    await self.emit(
                        {
                            "type": "transcript",
                            "id": turn_id,
                            "text": transcript_text,
                            "final": True,
                        }
                    )
                    if self.on_final:
                        self.on_final(turn_id, transcript_text)
                    return
            if self.version == turn_id:
                await self.emit(
                    {
                        "type": "transcript",
                        "id": turn_id,
                        "text": transcript_text,
                        "final": True,
                    }
                )
                if self.on_final and transcript_text.strip():
                    self.on_final(turn_id, transcript_text)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error(
                "transcription stream failed",
                extra={"error_type": type(error).__name__},
            )
            await self.emit({"type": "input_error", "id": turn_id})

    def push(self, frame):
        """Forward a microphone frame only while the current stream reader is active."""
        if self.stream and self.task and not self.task.done():
            self.stream.push_frame(frame)

    def finish(self):
        """Signal end of audio input if a reader is still active; final text arrives asynchronously."""
        if self.stream and self.task and not self.task.done():
            self.stream.end_input()


async def forward_audio(
    microphone_track, transcription, stream_factory=rtc.AudioStream
):
    """Read mono 16 kHz RTC frames for the captured turn, discard stale audio and always close the stream, including on cancellation."""
    turn_id = transcription.version
    audio_stream = stream_factory(microphone_track, sample_rate=16000, num_channels=1)
    has_received_audio = False
    try:
        async for event in audio_stream:
            if turn_id and turn_id == transcription.version:
                if not has_received_audio:
                    logger.info("microphone audio received", extra={"turn": turn_id})
                    has_received_audio = True
                transcription.push(event.frame)
    finally:
        await audio_stream.aclose()


# One idle process keeps dispatch warm without local model downloads.
server = AgentServer(
    num_idle_processes=1,
    host="0.0.0.0",
    port=8081,
    http_proxy=os.environ.get("HTTPS_PROXY"),
)


@server.on("worker_registered")
def registered(worker_id, server_info):
    """Write the optional readiness sentinel after worker registration; never include credentials or transcripts."""
    if path := os.environ.get("FINVOICE_WORKER_READY_FILE"):
        Path(path).write_text("registered")


@server.rtc_session(agent_name="finvoice")
async def entrypoint(job_context: JobContext):
    """Serve one dispatched browser identity with STT, ordered address tools and TTS. Reject invalid job identity, serialize control transitions and clean up on exit."""
    browser_identity = json.loads(job_context.job.metadata).get("participant")
    if not isinstance(browser_identity, str) or not browser_identity.startswith(
        "browser-"
    ):
        raise ValueError("Missing browser participant identity")
    await job_context.connect()

    async def emit_voice_event(message):
        """Publish reliable turn events only to the dispatched browser on the Finvoice topic."""
        await job_context.room.local_participant.publish_data(
            json.dumps(message),
            reliable=True,
            destination_identities=[browser_identity],
            topic=TOPIC,
        )

    speech_model = inference.TTS(
        "cartesia/sonic-3", voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"
    )
    transcription_model = inference.STT("deepgram/nova-3", language="en")
    audio_source = rtc.AudioSource(
        speech_model.sample_rate, speech_model.num_channels, queue_size_ms=100
    )
    speech_track = rtc.LocalAudioTrack.create_audio_track(
        "finvoice-answer", audio_source
    )
    await job_context.room.local_participant.publish_track(
        speech_track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    )
    speech = SpeechBridge(audio_source, speech_model, emit_voice_event)
    tool_task = None

    async def invoke_tool(tool_call):
        """Forward the model tool envelope to the owner browser RPC and decode its JSON response; failures propagate."""
        response = await job_context.room.local_participant.perform_rpc(
            destination_identity=browser_identity,
            method="finvoice.address_tool",
            payload=json.dumps(tool_call),
            response_timeout=10,
        )
        return json.loads(response)

    address_agent = AddressToolAgent(invoke_tool, emit_voice_event)

    async def resolve_and_speak(turn_id, address_utterance):
        """Bound tool resolution to 50 seconds and commit/speak only the current version under the control lock; cancelled or stale work cannot publish a result."""
        try:
            await transcription.stop()
            result = await asyncio.wait_for(
                address_agent.resolve(turn_id, address_utterance), timeout=50
            )
            async with control_lock:
                if turn_id != speech.version:
                    return
                await emit_voice_event(
                    {"type": "address_result", "id": turn_id, "result": result}
                )
                address_agent.commit(result)
                if result.get("speech"):
                    await speech.speak(turn_id, result["speech"], current_turn=True)
                else:
                    await emit_voice_event({"type": "speech_done", "id": turn_id})
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error(
                "address tool turn failed", extra={"error_type": type(error).__name__}
            )
            if turn_id == speech.version:
                await emit_voice_event({"type": "tool_error", "id": turn_id})

    def schedule_turn(turn_id, address_utterance):
        """Schedule one resolution task for final text; control transitions cancel prior tasks before new capture."""
        nonlocal tool_task
        tool_task = asyncio.create_task(resolve_and_speak(turn_id, address_utterance))

    async def cancel_tools():
        """Cancel and await the owned tool task, tolerating cancellation, then release its handle."""
        nonlocal tool_task
        if tool_task:
            tool_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await tool_task
            tool_task = None

    transcription = Transcription(transcription_model, emit_voice_event, schedule_turn)
    audio_tasks = set()
    control_lock = asyncio.Lock()

    async def read_audio(microphone_track):
        """Forward owner microphone frames; propagate cancellation and report a generic input error only for the current turn."""
        turn_id = transcription.version
        try:
            await forward_audio(microphone_track, transcription)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error(
                "microphone stream failed", extra={"error_type": type(error).__name__}
            )
            if turn_id and turn_id == transcription.version:
                with contextlib.suppress(Exception):
                    await emit_voice_event({"type": "input_error", "id": turn_id})

    @job_context.room.on("track_subscribed")
    def subscribed(microphone_track, publication, participant):
        """Track audio-reader tasks only for the dispatched owner audio track; discard completed handles."""
        if (
            participant.identity == browser_identity
            and microphone_track.kind == rtc.TrackKind.KIND_AUDIO
        ):
            task = asyncio.create_task(read_audio(microphone_track))
            audio_tasks.add(task)
            task.add_done_callback(audio_tasks.discard)

    @job_context.room.local_participant.register_rpc_method("finvoice.control")
    async def control(rpc_invocation: rtc.RpcInvocationData):
        """Authorize owner RPCs, validate positive integer versions and serialize listen/stop/finish/resolve/speak transitions. Map malformed commands to generic RPC errors."""
        if rpc_invocation.caller_identity != browser_identity:
            raise rtc.RpcError(1401, "Not authorized")
        try:
            control_request = json.loads(rpc_invocation.payload)
            control_action, turn_id = control_request.get(
                "action"
            ), control_request.get("id")
            if control_action == "ready":
                return "ready"
            if (
                not isinstance(turn_id, int)
                or isinstance(turn_id, bool)
                or turn_id <= 0
            ):
                raise ValueError("Invalid turn")
            async with control_lock:
                if control_action == "resolve":
                    if turn_id <= speech.version:
                        return "stale"
                    address_utterance = control_request.get("text")
                    if (
                        not isinstance(address_utterance, str)
                        or not address_utterance.strip()
                        or len(address_utterance) > 250
                    ):
                        raise ValueError("Invalid address text")
                    await cancel_tools()
                    await speech.stop(turn_id)
                    await transcription.stop()
                    schedule_turn(turn_id, address_utterance)
                    return "accepted"
                if control_action == "speak":
                    if turn_id <= speech.version:
                        return "stale"
                    await cancel_tools()
                    await transcription.stop()
                    return (
                        "ok"
                        if await speech.speak(turn_id, control_request.get("text"))
                        else "stale"
                    )
                if control_action == "finish":
                    if turn_id == transcription.version:
                        transcription.finish()
                    return "ok"
                if control_action in ("listen", "stop"):
                    if not await speech.stop(turn_id):
                        return "stale"
                    await cancel_tools()
                    await transcription.stop()
                    if control_action == "listen":
                        await transcription.start(turn_id)
                    return "ok"
                raise ValueError("Invalid command")
        except (ValueError, TypeError, AttributeError):
            raise rtc.RpcError(1400, "Invalid voice command") from None

    browser_disconnected = asyncio.Event()

    @job_context.room.on("participant_disconnected")
    def left(participant):
        """Release the session wait only when the dispatched browser participant leaves."""
        if participant.identity == browser_identity:
            browser_disconnected.set()

    async def cleanup():
        """Cancel tools/audio, close model clients and release the RTC source at shutdown."""
        await cancel_tools()
        await address_agent.aclose()
        await transcription.stop()
        await speech.stop(speech.version + 1)
        for task in audio_tasks:
            task.cancel()
        await asyncio.gather(*audio_tasks, return_exceptions=True)
        await transcription_model.aclose()
        await speech_model.aclose()
        await audio_source.aclose()

    await job_context.room.local_participant.set_metadata(
        json.dumps({"finvoiceReady": True, "toolsVersion": 1})
    )
    job_context.add_shutdown_callback(cleanup)
    await job_context.wait_for_participant(identity=browser_identity)
    await browser_disconnected.wait()
    job_context.shutdown(reason="browser disconnected")


if __name__ == "__main__":
    cli.run_app(server)
