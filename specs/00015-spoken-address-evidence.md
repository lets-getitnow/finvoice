# Preserve Spoken Address Details

<a id="preserve-spoken-address-evidence"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner reported that “Three twenty mint” should have found “320 Mint” and requested a generalized solution. A screenshot showed the system asking for the street name despite the spoken reply already containing a house number and street.

Speech can express the same house number as grouped words, single digits or a cardinal phrase. Deterministic address parsing should preserve that evidence rather than allow a model hint to discard it or replace it with a different address.

## Relationship to earlier work

Extend partial recommendations, model tools and exact-match price behavior from [00009](00009-address-recommendations.md), [00010](00010-livekit-disambiguation-tools.md) and [00012](00012-match-price-submit.md). Model hints may no longer replace a deterministically parsed house number and street. Confirmation, data and access safeguards remain.

## Required outcome

- **AC-01:** Resolve grouped, digit-by-digit and cardinal spoken house numbers consistently with numeric input. Include number-only follow-up replies and street-first input, while preserving literal street names.
- **AC-02:** Prevent model interpretations from discarding/replacing a supplied house number or full address, or classifying a numeric address as an unknown detail. Retain confirmation for ambiguous, prefix and similar-sounding matches.
- **AC-03:** Verify isolated synthetic regressions and relevant existing checks. Publish to the existing Site when the original build input is available; otherwise preserve the patch and report the build/publication blocker without fabricating data.

## Scope and limits

This is a general parsing/evidence rule, not a hardcoded special case for Mint. It does not authorize changing property records, microphone infrastructure or visual layout. The owner export remains independently unverified; synthetic records establish engineering behavior only.

## How to verify

Compare grouped, cardinal and digit-by-digit phrases with their numeric equivalents; test street-first phrases and number-only continuation; reject model hints that conflict with supplied house/street details; prevent a model “unknown” classification from erasing numeric evidence. Confirm that prefix and similar-sounding recovery still require a choice. Actual phone audio is a separate check.
