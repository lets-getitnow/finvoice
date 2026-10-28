# Start Voice Without Records

<a id="start-livekit-voice-before-connecting-records"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner reported that Start talking lit up but did not work. Production evidence showed a missing dataset response (HTTP 404) and no attempt to create a voice session. The click handler stopped before invoking LiveKit because records were unavailable.

Starting a conversation and finding a valuation have different prerequisites. A person should be able to begin capture and retain an address even if a company dataset has not yet connected. The app must explain why it cannot provide a valuation rather than inventing one.

## Relationship to earlier work

This corrects the voice-start behavior required by [00003](00003-retain-livekit.md). Authentication and microphone permissions still apply, and valuation still needs an authorized dataset. Its import-related recovery UI describes the design at that time; [00007](00007-minimal-voice-interface.md) and [00008](00008-server-owned-company-data.md) later remove visitor import controls and upload requirements.

## Required outcome

- **AC-01:** Invoke LiveKit when Start talking is pressed, regardless of CSV availability. Preserve authentication checks and microphone-error handling.
- **AC-02:** Retain a captured address without fabricating a valuation. Explain the CSV requirement beside the voice controls and provide import/sign-in recovery there.
- **AC-03:** Preserve private storage and lookup access boundaries. Test the reported failure and recovery, then publish the correction to the existing public Site.

## How to verify

Reproduce the early exit with a synthetic UI test before fixing it. Start and finish capture with no dataset; confirm that the transcript remains available and no property search is performed. Check permission-error retry and sign-in recovery, run existing server/property/session checks, and inspect the native hosting publication result. Simulated browser APIs do not verify real iPhone audio.
