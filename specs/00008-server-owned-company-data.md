# Load Company Records Automatically

<a id="automatic-company-records-on-the-server"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

The owner required the company CSV to be loaded on the server so visitors would never need to upload it. Signed-in visitors should search the same authorized company records automatically.

Earlier work associated uploads with individual users. This request changes where records come from, not whether records are public: the raw export and full search index must remain unavailable to the browser.

## Relationship to earlier work

This replaces the per-visitor import/ownership design in [00002](00002-public-cloud.md) and the remaining upload dependency discussed in [00007](00007-minimal-voice-interface.md). Retain the public minimal page, authenticated record access and LiveKit transcript events. Existing historical stored data must not be deleted as part of this change.

## Required outcome

- **AC-01:** Recover and verify the identity of the original owner-provided CSV. Automatically make that same server dataset available to signed-in visitors and remove the runtime dependency on visitor uploads.
- **AC-02:** Keep the raw CSV and complete searchable dataset out of public assets and new Git source. Validate the source identity during the build. Return bounded matching records, not a downloadable export.
- **AC-03:** Fit within the hosted Worker's memory budget. Preserve address normalization, clarification and valuation-conflict handling. Disable obsolete browser upload endpoints without deleting historical data.
- **AC-04:** Verify source-backed lookup and metadata, absence of uploads, authentication/data access, and UI/LiveKit regressions; then publish through the existing public Site.

## Source and operational limits

The source is the original company export recovered from the owner's historical Site source. It is owner-provided and has not been independently verified. A file fingerprint checks that the build used the approved bytes; it does not prove the valuations are correct. Never replace missing operational records with fixtures.

The local runtime data is ignored by Git and embedded only in the private server deployment artifact. Here, “Worker” means the hosted web server, not the separate LiveKit audio worker.

## How to verify

Check the source fingerprint and record counts; measure a representative memory case before scaling; test synthetic group decoding and signed-in lookup in isolation; test the generated server against the real source; reject public CSV routes and unauthenticated access; rerun minimal UI/LiveKit checks and inspect native deployment success.
