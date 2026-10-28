# Selectable address choices

Codex, 2026-10-28. User requests well-designed address choices whose click shows the selected property's price. Preserve the minimal text/Enter/Speak interface and LiveKit tool-call system.

AC-01: Present up to three source-backed address options as accessible cards with clear street/locality, ordinal number, action and selected/loading states. Support keyboard activation and narrow touch layouts.
AC-02: Clicking a card explicitly selects that displayed candidate, runs the existing LiveKit tool flow, and shows its server-backed price without another Enter/yes action. Do not invent or preload unconfirmed prices. Keep source conflicts labeled.
AC-03: Keep the original choice context so users can select a different card, and prevent late results or stale cards from attaching a price to a different query. Preserve voice ordinal selection and text previews.
AC-04: Verify click-to-price, switching choices, stale/error recovery, source-backed selection, existing checks, then commit/push and publish the existing public Site.

Supersedes plain-text recommendation presentation in 00009. Clicking a specific displayed address is explicit confirmation under 00010; source data and authorization boundaries are unchanged.

Checks: native button semantics and safe text rendering; preview/card selection to tools and price; switching choices; conflict/zero price; stale callbacks and retry; source-backed candidate ID; API/privacy and active JS/Python regressions. Actual device visual/audio verification remains separately disclosed.
