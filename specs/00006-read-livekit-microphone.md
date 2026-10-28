# Read the pinned LiveKit microphone stream

2026-10-28 user reports connection sounds but no transcription. Worker logs show TypeError in read_audio: AudioStream does not support the asynchronous context manager protocol. Correct microphone consumption for the pinned RTC API; preserve LiveKit, private data and public access.

AC-01: Iterate AudioStream using its supported async iterator, always explicitly close it, and forward current-turn frames to transcription.
AC-02: Discard stale-turn frames; close streams on cancellation. Keep stage/error diagnostics free of audio, transcript text and secrets; report read failures to the client.
AC-03: Reproduce failure, verify frames/transcript-event handling and deploy to the existing authorized worker slot. Device speech verification remains distinct from synthetic protocol tests.

Checks: context-protocol failure before fix; current/stale frames; cancellation cleanup; interim/final transcript events; existing web/API checks; hosted worker status/startup evidence.
