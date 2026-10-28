# Automatic company records on the server

User requires the CSV to be loaded on the server; visitors must never need to upload it. Supersedes per-visitor import/ownership requirements from 00002 and 00007. Retain public minimal interface, authenticated record access and LiveKit events.

AC-01: Recover and verify the original owner-provided CSV, automatically provide the same server dataset to signed-in visitors, and remove runtime upload dependency.
AC-02: Keep raw CSV and complete searchable dataset out of public assets and new Git source. Validate source identity during build; return bounded matching records rather than an export.
AC-03: Fit the hosted Worker memory budget and preserve address normalization, clarification and valuation conflicts. Disable obsolete browser upload endpoints without deleting historical data.
AC-04: Verify source-backed lookup, metadata, upload absence, auth/privacy and UI/LiveKit regressions, then publish the existing public Site.

Provenance: original company export from owned historical Site source, user-provided and not independently verified. No synthetic operational data. Runtime data is ignored locally and embedded only in the private Worker deployment artifact.

Checks: file fingerprint/count; memory pilot; synthetic group decoding/visitor lookup; source-backed generated Worker lookup; no public CSV route; authentication; minimal UI and LiveKit checks; native deployment.
