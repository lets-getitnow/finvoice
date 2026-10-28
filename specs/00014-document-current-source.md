# Document the Current Code

<a id="document-current-source"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner requested clear inline documentation for all code, then a comprehensive documentation pass and commit. Follow-up messages pointed out that other code changes had happened and that the documentation was absent on GitHub.

The initial documentation commit was local and based on an outdated checkout. The task therefore applies to the current GitHub implementation, including the newer LiveKit worker, server address tools and UI, while preserving other people's subsequent work.

## Relationship to earlier work

This adds documentation requirements to specs [00001](00001-bootstrap-finvoice.md) through [00013](00013-selectable-address-choices.md); it does not change application behavior. Inline documentation means explanations adjacent to the implementation, including docstrings, rather than relying only on separate design documents.

## Required outcome

- **AC-01:** Make accurate inline documentation mandatory in AGENTS. Document every maintained application module, named function/method, stateful callback, test helper/scenario, build script and migration.
- **AC-02:** Cover the current LiveKit transport/worker and server-owned data/tool paths. Explain contracts, ordering, cancellation, confirmation and value-disclosure rules beside the implementation.
- **AC-03:** Preserve executable logic, test assertions, data boundaries, HTML structure and stylesheet rules/order. Explain static UI/style sections. Preserve the bundled third-party SDK and its upstream notices, documenting its ownership where it is imported.
- **AC-04:** Verify syntax, source preservation and available isolated tests. Identify checks unavailable without private data or installed dependencies. Commit and publish on top of the observed current GitHub revision without replacing newer work.

## Scope and limits

Limit changes to documentation and stylesheet whitespace. JSON metadata and hash-pinned dependency manifests do not need embedded source comments; README explains their commands. Historical reports and specifications were outside this task's scope. That exclusion describes this original task, not a prohibition on a later owner-authorized editorial rewrite.

Do not deploy, run live-model probes, download company data, install dependencies or add automated documentation enforcement as part of this pass. A written completion rule is not an automated checker.

## How to verify

Compare executable JavaScript lines and Python syntax trees after excluding comments/docstrings. Compare HTML, stylesheet rules, SQL and container instructions after excluding documentation/formatting. Run available synthetic address/voice/card checks and review comment accuracy. Finally, inspect the branch and source files on GitHub; a local commit alone is not publication.
