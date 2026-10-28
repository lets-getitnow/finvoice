# Suggest Partial Address Matches

<a id="partial-address-recommendations-and-clarification"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

The owner expected an incomplete phrase such as “Mint 32” to produce useful address recommendations. They also asked about previously designed LiveKit tools for resolving ambiguous speech. At this stage, the recovered worker contained only speech-control remote calls; the earlier function-tool definitions were not available.

A partial address should help a person find the right record without silently choosing a different house number. For example, a longer source house number beginning with 32 may be suggested, but its price must not be treated as confirmed.

## Relationship to earlier work

Extend lookup while keeping the minimal page, server company CSV and LiveKit text events from [00007](00007-minimal-voice-interface.md) and [00008](00008-server-owned-company-data.md). Do not claim unavailable historical tool definitions were preserved or invent their contract. [00010](00010-livekit-disambiguation-tools.md) later defines the approved function-tool system; [00013](00013-selectable-address-choices.md) later improves recommendation presentation.

## Required outcome

- **AC-01:** Recognize a street name before a house number. Offer house-number-prefix candidates only as unconfirmed recommendations; never silently substitute a valuation.
- **AC-02:** Recommend addresses for street-only or ambiguous input, showing at most three choices. Retain context for yes/no confirmation, numbered choices and ZIP corrections.
- **AC-03:** Show recommendations after a short pause in typing rather than speaking on every keystroke. Preserve transcript-driven lookup and spoken clarification through LiveKit.
- **AC-04:** Keep source data on the server, bound runtime data loading and retain strict default matching for callers that do not opt into prefix recommendations. Verify the reported Mint 32 case against the actual source and publish.

## How to verify

Use isolated fixtures to compare strict lookup with optional suggestions; exercise confirmation, ZIP replies and numbered choices. Check a source-backed recommendation and its later confirmation. Verify that typing previews neither reveal valuations nor invoke speech. Rerun startup and API privacy checks. Missing earlier tool names/roles were an unresolved input at this stage, not an implemented feature.
