# Show Prices and Submit Addresses

<a id="match-price-and-submit"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner requested a visible price for a matched address and an Enter button to submit text, followed by committed/pushed source and live publication. A person entering a complete, exact address should not have to confirm an already verified match just to see its value.

This convenience applies only to evidence in the actual typed or spoken reply. A model-corrected spelling or longer suggested house number is still uncertain and needs an explicit choice.

## Relationship to earlier work

This changes [00010](00010-livekit-disambiguation-tools.md) only for unique exact matches independently validated against the actual reply. Other confirmation, access and privacy safeguards remain. It also relaxes [00007](00007-minimal-voice-interface.md)'s single-button restriction to add the requested Enter control.

## Required outcome

- **AC-01:** Immediately display the source price for a unique exact match supported by the actual entered/spoken address. Continue to require explicit confirmation for partial, similar-sounding, model-interpreted or ambiguous matches. Keep conflicting source values visibly unresolved.
- **AC-02:** Place a prominent price next to the matched address, clear it when the query changes, and provide an accessible Enter submit button with the same behavior as keyboard Enter. Retain Speak and the LiveKit tool-call flow.
- **AC-03:** Preserve a usable narrow-screen layout and server-only CSV. Verify matching, confirmation, price display and submission; then commit, push to GitHub and publish through the existing public Site.

## Scope and limits

“Exact” must be established against source address components and actual user input, not merely a confident model interpretation. Showing a source price does not independently verify the source valuation. Do not choose one of several conflicting values or treat zero as a missing value.

## How to verify

Exercise exact-match price display; guard similar-sounding/prefix guesses and misleading model hints; confirm uncertain candidates explicitly; check conflicting, missing and zero values; clear stale prices after edits; compare button/keyboard submission and responsive styling. Run relevant active checks and verify source synchronization, non-force publication and native hosting success. Disclose device checks not performed.
