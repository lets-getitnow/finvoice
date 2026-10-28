# Read Microphone Audio Correctly

<a id="read-the-pinned-livekit-microphone-stream"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner heard connection sounds but received no transcription. Worker logs identified a TypeError: the installed LiveKit AudioStream did not support the asynchronous context-manager protocol used by the code.

Connecting to a room does not prove that microphone frames reach speech recognition. The worker must consume audio using the API supported by the pinned dependency version and release the stream reliably when capture ends.

## Relationship to earlier work

This repairs the microphone stage of [00003](00003-retain-livekit.md), after the startup corrections in [00004](00004-start-voice-without-data.md) and [00005](00005-initialize-hosted-entrypoint.md). Preserve LiveKit transport, private data and public page access. [00016](00016-microphone-startup.md) later addresses browser-side capture timing; this spec concerns worker-side reading.

## Required outcome

- **AC-01:** Consume AudioStream through its supported asynchronous iterator, explicitly close it, and forward frames belonging to the current user interaction to transcription.
- **AC-02:** Discard frames from an obsolete interaction and close streams on cancellation. Log useful stage/error diagnostics without audio, transcript text or secrets, and report audio-read failures to the client.
- **AC-03:** Reproduce the unsupported-protocol failure, verify frame forwarding and transcript-event delivery, then deploy to the existing authorized worker slot. Report real-device speech verification separately from simulated protocol tests.

## Technical context

An asynchronous iterator yields audio frames as they arrive. An asynchronous context manager additionally supports entering/leaving an `async with` block; this installed API did not. A “turn” identifies one user interaction, allowing delayed frames from a cancelled capture to be rejected.

## How to verify

Demonstrate the original context-manager failure. Test current and obsolete frames, cancellation cleanup, and interim/final transcript events. Rerun applicable web/API checks and inspect hosted-worker status/startup evidence. Neither a registered worker nor a simulated stream establishes real microphone-to-speaker performance.
