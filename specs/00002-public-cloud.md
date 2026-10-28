# Publish a Public Website

<a id="public-cloud-finvoice"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner authorized moving Finvoice from a private/local delivery to a public cloud website. A visitor should be able to open the interface over HTTPS, while access to company property records remains restricted.

A public page and private property data are different requirements: the page may load without sign-in, but that does not authorize an anonymous visitor to search or download company records. At this point in the design, signed-in users uploaded and owned separate datasets.

## Relationship to earlier work

This changes the private hosting intent in [00001](00001-bootstrap-finvoice.md). Reuse the existing Finvoice Site—the already established hosted website—and preserve its source history. [00003](00003-retain-livekit.md) later replaces browser speech with LiveKit. [00008](00008-server-owned-company-data.md) later replaces per-user uploads with one automatically available company dataset. Those later changes do not remove authentication or make the export public.

## Required outcome

- **AC-01:** Provide a public HTTPS interface for typed addresses and browser voice input/output, retaining follow-up questions for ambiguous addresses and warnings for conflicting valuations.
- **AC-02:** Keep uploaded company records private to their authenticated owner. Perform lookup on the server, persist records in server storage, and never serve a company export as a public file.
- **AC-03:** Deploy versioned source. Verify who can reach the page, that hosting reports success, and that protected API requests enforce their access rules.
- **AC-04:** Explain missing data and verification limits accurately. Do not substitute synthetic test records for unavailable company data.

## Scope and limits

This is a hosting and data-access change. A successful deployment does not establish that source valuations are correct or that real microphone audio works. When the original company CSV is unavailable, report that real-source validation is blocked.

## How to verify

Open the page anonymously; reject unauthenticated import/search requests; check that one user cannot access another user's dataset; exercise lookup clarification and conflicting values; confirm that a failed import preserves a working dataset; inspect deployment status. Keep fixture-based checks separate from real-source evidence.
