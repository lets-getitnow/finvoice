# Stabilize microphone startup

Author: Codex. Date: 2026-10-28.

Prompt: “Feels like race consition cause after a few oresses it works” with a phone screenshot of the microphone-blocked message.

Extends 00006/00007 and 00010; supersedes requesting browser microphone permission only after asynchronous room/worker setup. Preserve LiveKit transport, minimal controls, address cards, server data, authorization and address matching.

AC-01: Request microphone access directly from the Speak action before asynchronous connection work, including a cold start. Publish only after the worker is ready. Only one current turn may own capture.
AC-02: Stop/retry/disconnect suppress stale state and stop obsolete tracks, including delayed permission grants and publications. Stale connection setup cannot replace a newer room or connection promise.
AC-03: Distinguish microphone permission/device errors from audio playback and network failures. Playback permission rejection must not prevent microphone capture or typed resolution. Genuine microphone denial remains recoverable with accurate guidance.
AC-04: Verify synthetic delayed cold start, stop/retry while permission is pending, stop during publication, stale connection setup, playback rejection and genuine microphone denial. Run relevant existing checks; publish the focused update. Real iPhone Safari audio remains a separate verification limit.

No automatic permission retries, new dependencies, property-data changes or worker redeployment. Synthetic timing tests establish lifecycle behavior, not real-device permission policy.
