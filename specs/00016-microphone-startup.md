# Make Microphone Startup Reliable

<a id="stabilize-microphone-startup"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner reported that voice worked only after several button presses and suspected a timing problem. A phone screenshot showed a microphone-blocked message. The browser was requesting microphone permission only after asynchronous room/worker setup, rather than directly from the person's Speak action.

The desired experience is a reliable first attempt: request microphone access from the user action, connect the voice service, then publish capture only when the worker is ready. Cancelled or delayed work must never take ownership from a newer attempt.

## Relationship to earlier work

Extend microphone handling and UI/tool lifecycle requirements in [00006](00006-read-livekit-microphone.md), [00007](00007-minimal-voice-interface.md) and [00010](00010-livekit-disambiguation-tools.md). Replace the timing rule that requested browser permission only after connection setup. Preserve LiveKit, minimal controls, address cards, server records, authentication and matching behavior.

## Required outcome

- **AC-01:** Request microphone access directly from Speak before asynchronous connection work, including on a first visit. Publish audio only after worker readiness. Only one current interaction may own capture.
- **AC-02:** Stop/retry/disconnect must suppress obsolete state and stop obsolete tracks, including delayed permission grants and publications. An old connection attempt must not replace a newer room or its in-progress connection promise.
- **AC-03:** Distinguish microphone permission/device errors from playback and network failures. A playback-permission rejection must not prevent microphone capture or typed resolution. Genuine microphone denial must remain recoverable with accurate instructions.
- **AC-04:** Test delayed first connection, stop/retry while permission is pending, stop during track publication, obsolete connection completion, playback rejection and genuine microphone denial. Run relevant existing checks and publish the focused update; disclose real iPhone Safari audio as separate verification.

## Scope and limits

A “track” is the captured audio resource; ownership determines which interaction may publish or stop it. A connection promise represents setup that is still running. These details matter because cancellation may occur while the browser is still asking for permission or establishing the room.

Do not add automatic permission retries, dependencies, property-data changes or voice-worker redeployment. Simulated timing checks verify lifecycle behavior; they do not establish a real browser's permission policy.

## How to verify

Control the order in which permission, connection and publication complete in synthetic tests. Confirm that cancelled resources stop and cannot change current UI/room state. Check playback rejection separately from capture denial, then rerun relevant address and voice checks. Report deployment evidence and any unperformed device tests without treating one as proof of the other.
