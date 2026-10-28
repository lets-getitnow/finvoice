# Use LiveKit for Voice

<a id="retain-livekit-voice"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner clarified that Finvoice must retain LiveKit for speech rather than use the browser's built-in recognition and speech synthesis services. LiveKit is the realtime connection between the browser and a separate voice worker that transcribes microphone audio and speaks replies.

A person should still be able to type an address. Microphone capture, transcription and spoken output should use the selected LiveKit path, with useful recovery when a service is unavailable.

## Relationship to earlier work

This replaces the browser-speech portion of [00002 AC-01](00002-public-cloud.md#required-outcome). The public page, protected property data and other hosting requirements remain. This spec does not authorize changing property records or their storage schema.

## Required outcome

- **AC-01:** Use LiveKit for microphone transcription and spoken replies. Do not silently fall back to browser speech recognition or synthesis. Retain typed lookup.
- **AC-02:** Create voice sessions only for authenticated requests from the application's own origin—that is, the same scheme, host and port. Give the browser a short-lived token limited to one private voice room. Keep cloud API secrets on the server.
- **AC-03:** Publish through the existing public Site while preserving private property data and its schema. Check voice-worker readiness separately from website publication and report any missing infrastructure.

## Scope and limits

A “room” is the temporary LiveKit session joining a browser and its voice worker. A room token grants access to that session; it must not grant broad administrative privileges. Publishing frontend files is insufficient evidence that a worker is registered, ready or able to process audio.

## How to verify

Reject wrong HTTP methods, unauthenticated requests and requests from another origin. Inspect token expiry and room permissions. Check that browser modules and transport assets load, rerun relevant property checks, and perform a bounded check that the cloud worker can be dispatched. Disclose any real-device audio checks that were not performed.
