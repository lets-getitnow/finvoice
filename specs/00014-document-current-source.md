# Document Current Source

Author: Codex, requested by project owner. Date: 2026-10-28.

The owner requested clear inline documentation for all code, then a comprehensive pass and commit. Follow-up prompts reported subsequent code changes and missing documentation on GitHub. The first documentation commit existed only in an outdated local checkout. This specification applies the request to current GitHub main, preserving the behavior required by specs 00001–00013. It does not supersede any application behavior.

- **AC-01:** Require accurate inline documentation in AGENTS and document every maintained application module, named function/method, stateful callback, test helper/scenario, build script and migration.
- **AC-02:** Cover the current LiveKit transport/worker and server-owned data/tool paths. Explain contracts, sequencing, cancellation, confirmation and value-disclosure rules beside their implementations.
- **AC-03:** Preserve all executable logic, test assertions, data boundaries, HTML structure and stylesheet rules/order. Document static UI/style sections. Preserve the vendor SDK bundle and upstream notices; describe its ownership at its import boundary.
- **AC-04:** Verify syntax, source preservation and available isolated tests. Identify checks unavailable without private data or installed dependencies. Commit and publish the result on top of the observed current GitHub revision without replacing newer work.

Scope is documentation and stylesheet whitespace only. JSON metadata and hash-pinned dependency manifests have no source-comment requirement; README explains their commands. Historical reports/specifications remain unchanged. No deployment, live-model probe, company-data download, dependency installation or automatic documentation enforcement is included.

Verification ideas: compare executable JS lines and Python ASTs excluding documentation; compare HTML/CSS/SQL/Docker instructions excluding comments/formatting; run current synthetic address/voice/card tests; review source-level documentation accuracy and verify the published GitHub branch/file contents.
