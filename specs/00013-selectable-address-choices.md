# Choose an Address to See Its Price

<a id="selectable-address-choices"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner requested clear address choices that show the selected property's price when clicked. A list of text suggestions required too much interpretation and an additional reply. Each recommendation should instead be a direct, accessible action.

For example, after seeing several possible addresses, a person can select one card, see that record's source price, then select another card to compare. The app must preserve which list the selection came from so delayed work cannot attach a price to an unrelated query.

## Relationship to earlier work

This replaces the plain-text recommendation presentation from [00009](00009-address-recommendations.md). Clicking a specific displayed address counts as explicit confirmation under [00010](00010-livekit-disambiguation-tools.md). Preserve the minimal text/Enter/Speak interface from [00007](00007-minimal-voice-interface.md) and [00012](00012-match-price-submit.md), the LiveKit flow, server data and authorization rules.

## Required outcome

- **AC-01:** Show at most three source-backed address options as accessible cards. Include street/locality, option number, clear action and selected/loading states; support keyboard activation and narrow touch layouts.
- **AC-02:** Treat clicking a displayed card as selection of that candidate. Run the existing LiveKit tool flow and show its server-backed price without another Enter or “yes.” Do not invent or preload unconfirmed prices; label source conflicts.
- **AC-03:** Preserve the original choices' context so another card can be selected. Prevent obsolete cards or delayed results from showing a price for a different query. Retain voice numbered-choice replies and typed previews.
- **AC-04:** Verify click-to-price, switching, obsolete-result protection, error recovery and source-backed selection; run relevant existing checks, then commit/push and publish through the existing public Site.

## How to verify

Check native button semantics and literal text rendering; follow preview → card → LiveKit tools → price; switch choices; cover conflict/zero values, cancelled requests and retry; verify the selected source record ID. Rerun API/privacy and active JavaScript/Python checks. Actual device appearance and audio remain separately reported verification, not an implication of simulated DOM tests.
