"""Synthetic audio and transcript checks; no recordings or network."""
import asyncio
import unittest
from types import SimpleNamespace
from livekit import rtc
from livekit.agents import stt
from voice_worker import forward_audio, Transcription

class SyntheticAudioStream:
    """Yield one synthetic frame and record closure without capturing real audio."""
    def __init__(self, track, **kwargs):
        """Capture synthetic inputs and initialize per-instance test state."""
        self.closed=False
        self.frames=iter([SimpleNamespace(frame='synthetic-frame')])
    def __aiter__(self):
        """Return this synthetic asynchronous iterator."""
        return self
    async def __anext__(self):
        """Yield the next synthetic frame, or end/block according to the test double."""
        try:return next(self.frames)
        except StopIteration:raise StopAsyncIteration
    async def aclose(self):
        """Close the synthetic stream/model; track closure where the test asserts it."""
        self.closed=True

class AudioChecks(unittest.IsolatedAsyncioTestCase):
    """Exercise forwarding, cancellation and transcript assembly with in-memory streams."""
    async def test_pinned_stream_protocol_forwards_and_closes(self):
        """Verify pinned stream protocol forwards and closes."""
        self.assertFalse(hasattr(rtc.AudioStream,'__aenter__'))
        stream=SyntheticAudioStream(None);received=[]
        transcription=SimpleNamespace(version=7,push=received.append)
        await forward_audio(None,transcription,lambda *a,**k:stream)
        self.assertEqual(received,['synthetic-frame'])
        self.assertTrue(stream.closed)

    async def test_stale_turn_audio_is_discarded(self):
        """Verify stale turn audio is discarded."""
        stream=SyntheticAudioStream(None);received=[]
        transcription=SimpleNamespace(version=7,push=received.append)
        def factory(*args,**kwargs):
            """Advance the turn before returning the stream to simulate obsolete microphone capture."""
            transcription.version=8
            return stream
        await forward_audio(None,transcription,factory)
        self.assertEqual(received,[]);self.assertTrue(stream.closed)

    async def test_stream_closes_when_capture_is_cancelled(self):
        """Verify stream closes when capture is cancelled."""
        started=asyncio.Event()
        class BlockingStream(SyntheticAudioStream):
            """Block iteration until cancelled to verify stream cleanup."""
            async def __anext__(self):
                """Yield the next synthetic frame, or end/block according to the test double."""
                started.set()
                await asyncio.Event().wait()
        stream=BlockingStream(None)
        transcription=SimpleNamespace(version=7,push=lambda frame:None)
        task=asyncio.create_task(forward_audio(None,transcription,lambda *a,**k:stream))
        await started.wait();task.cancel()
        with self.assertRaises(asyncio.CancelledError):await task
        self.assertTrue(stream.closed)

    async def test_transcripts_reach_browser_events(self):
        """Verify transcripts reach browser events."""
        events=[stt.SpeechEvent(type=stt.SpeechEventType.INTERIM_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='synthetic address')]),stt.SpeechEvent(type=stt.SpeechEventType.END_OF_SPEECH)]
        async def stream():
            """Yield the configured synthetic transcript events in order."""
            for event in events:yield event
        emitted=[]
        async def emit(event):
            """Append emitted lifecycle/transcript events to the isolated test observation list."""
            emitted.append(event)
        transcription=Transcription(None,emit);transcription.version=7
        await transcription._read(7,stream())
        self.assertEqual([(e['text'],e['final']) for e in emitted],[('synthetic address',False),('synthetic address',True)])

    async def test_multiple_final_segments_keep_house_number(self):
        """Verify multiple final segments keep house number."""
        events=[stt.SpeechEvent(type=stt.SpeechEventType.FINAL_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='thirty two')]),stt.SpeechEvent(type=stt.SpeechEventType.INTERIM_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='Mint')]),stt.SpeechEvent(type=stt.SpeechEventType.FINAL_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='Mint Drive')]),stt.SpeechEvent(type=stt.SpeechEventType.END_OF_SPEECH)]
        async def stream():
            """Yield the configured synthetic transcript events in order."""
            for event in events:yield event
        emitted=[];finished=[]
        async def emit(event):
            """Append emitted lifecycle/transcript events to the isolated test observation list."""
            emitted.append(event)
        transcription=Transcription(None,emit,lambda version,text:finished.append((version,text)));transcription.version=7
        await transcription._read(7,stream())
        self.assertEqual(emitted[-1]['text'],'thirty two Mint Drive');self.assertEqual(finished,[(7,'thirty two Mint Drive')])

if __name__=='__main__':unittest.main()
