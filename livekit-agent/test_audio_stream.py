"""Synthetic audio and transcript checks; no recordings or network."""
import asyncio
import unittest
from types import SimpleNamespace
from livekit import rtc
from livekit.agents import stt
from voice_worker import forward_audio, Transcription

class SyntheticAudioStream:
    def __init__(self, track, **kwargs):
        self.closed=False
        self.frames=iter([SimpleNamespace(frame='synthetic-frame')])
    def __aiter__(self):return self
    async def __anext__(self):
        try:return next(self.frames)
        except StopIteration:raise StopAsyncIteration
    async def aclose(self):self.closed=True

class AudioChecks(unittest.IsolatedAsyncioTestCase):
    async def test_pinned_stream_protocol_forwards_and_closes(self):
        self.assertFalse(hasattr(rtc.AudioStream,'__aenter__'))
        stream=SyntheticAudioStream(None);received=[]
        transcription=SimpleNamespace(version=7,push=received.append)
        await forward_audio(None,transcription,lambda *a,**k:stream)
        self.assertEqual(received,['synthetic-frame'])
        self.assertTrue(stream.closed)

    async def test_stale_turn_audio_is_discarded(self):
        stream=SyntheticAudioStream(None);received=[]
        transcription=SimpleNamespace(version=7,push=received.append)
        def factory(*args,**kwargs):
            transcription.version=8
            return stream
        await forward_audio(None,transcription,factory)
        self.assertEqual(received,[]);self.assertTrue(stream.closed)

    async def test_stream_closes_when_capture_is_cancelled(self):
        started=asyncio.Event()
        class BlockingStream(SyntheticAudioStream):
            async def __anext__(self):
                started.set()
                await asyncio.Event().wait()
        stream=BlockingStream(None)
        transcription=SimpleNamespace(version=7,push=lambda frame:None)
        task=asyncio.create_task(forward_audio(None,transcription,lambda *a,**k:stream))
        await started.wait();task.cancel()
        with self.assertRaises(asyncio.CancelledError):await task
        self.assertTrue(stream.closed)

    async def test_transcripts_reach_browser_events(self):
        events=[stt.SpeechEvent(type=stt.SpeechEventType.INTERIM_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='synthetic address')]),stt.SpeechEvent(type=stt.SpeechEventType.END_OF_SPEECH)]
        async def stream():
            for event in events:yield event
        emitted=[]
        async def emit(event):emitted.append(event)
        transcription=Transcription(None,emit);transcription.version=7
        await transcription._read(7,stream())
        self.assertEqual([(e['text'],e['final']) for e in emitted],[('synthetic address',False),('synthetic address',True)])

    async def test_multiple_final_segments_keep_house_number(self):
        events=[stt.SpeechEvent(type=stt.SpeechEventType.FINAL_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='thirty two')]),stt.SpeechEvent(type=stt.SpeechEventType.INTERIM_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='Mint')]),stt.SpeechEvent(type=stt.SpeechEventType.FINAL_TRANSCRIPT,alternatives=[stt.SpeechData(language='en',text='Mint Drive')]),stt.SpeechEvent(type=stt.SpeechEventType.END_OF_SPEECH)]
        async def stream():
            for event in events:yield event
        emitted=[];finished=[]
        async def emit(event):emitted.append(event)
        transcription=Transcription(None,emit,lambda version,text:finished.append((version,text)));transcription.version=7
        await transcription._read(7,stream())
        self.assertEqual(emitted[-1]['text'],'thirty two Mint Drive');self.assertEqual(finished,[(7,'thirty two Mint Drive')])

if __name__=='__main__':unittest.main()
