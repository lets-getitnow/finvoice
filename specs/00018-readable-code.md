# Make Code Easy to Understand

Author: Codex, requested by the project owner. Date: 2026-10-28.

## Why this change was requested

The owner finds the code cryptic and favors understandability. They asked that names be deliberately chosen to convey what values do, and that both AGENTS.md and existing code follow that rule. Earlier work added inline explanations, but compressed statements and names such as single-letter records still make the implementation hard to read.

A reader should be able to follow address parsing, candidate selection and voice cancellation from meaningful names and ordinary control flow, without reconstructing each abbreviation from a comment.

## Relationship to earlier work

This strengthens the source-documentation standard in [00014](00014-document-current-source.md) and complements the plain-language specification rules in [00017](00017-clear-specifications.md). Preserve the application behavior established through [00016](00016-microphone-startup.md), including spoken-address evidence, microphone timing, authentication, source-data handling and cancellation safeguards.

## Required outcome

- **AC-01:** Require intentionally descriptive variable, parameter, function and state names in AGENTS. Names must communicate domain meaning and distinguish roles, ownership and lifecycle where relevant. Avoid cryptic abbreviations, ambiguous placeholders and compressed unrelated statements.
- **AC-02:** Apply the rule to maintained application, server, build, Python worker and test code. Rename local values and internal helpers to reflect their role; expand dense formatting and keep nearby documentation accurate. Preserve third-party generated code.
- **AC-03:** Preserve runtime decisions, literal values, external exported interfaces, protocol/schema field names, model tool definitions, source-data safeguards and existing assertions. Do not change product features, dependencies, live data or deployment access as part of readability work.
- **AC-04:** Verify the refactor using binding-aware JavaScript comparisons, Python syntax-tree checks and relevant existing tests. Test generated server assembly in explicitly isolated synthetic storage if the real build input is unavailable; never replace the repository's approved source identity or claim synthetic checks validate company data. Commit and publish on top of current GitHub source, preserving concurrent changes.

## Scope and limits

This is a source readability refactor, not a redesign or live deployment. Existing field names required by an API or SDK may remain short; local aliases should make their meaning clear. A longer name is useful only when it is accurate and helps the reader. Preserve source comments and update references to renamed helpers.

Development tools and test dependencies may be installed in temporary storage for reliable transformation/verification; do not add them as application dependencies or commit installed environments. The vendored LiveKit bundle and dependency manifests remain unchanged. Real phone audio and source valuation correctness are outside this change.

## How to verify

1. Inspect representative code and naming changes across parsing, resolution, voice lifecycle, server APIs, build scripts and tests.
2. Compare syntax trees after accounting for permitted local-name and formatting changes; preserve literals, property keys, exports and control flow.
3. Run existing synthetic tests before and after, including microphone startup and spoken evidence; exercise generated server assembly with explicitly synthetic, isolated inputs when necessary.
4. Run Python worker tests where their pinned dependencies can be installed, and verify no private data/vendor/dependency changes enter the commit.
5. Verify the resulting commit and selected readable files on GitHub. Report test scope and any unavailable production/device checks accurately.
