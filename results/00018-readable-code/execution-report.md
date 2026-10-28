# Understandable code

Codex, 2026-10-28. Self-review, not independent review. Requirements: [00018](../../specs/00018-readable-code.md). Source baseline: GitHub main `e3f0847693f94a62f25f783ae5317de91d1087b9`, freshly cloned with its actual history.

The owner found the implementation cryptic and requested intentionally descriptive names in AGENTS and code. Existing inline explanations were useful, but single-letter business variables, ambiguous placeholders and compressed statements still made the flow hard to follow. This change names values by their actual role and expands maintained source into readable steps. It preserves the current architecture and application decisions.

## What changed

AGENTS now requires domain-specific nouns, action/predicate names, meaningful callback/test names, clear raw/source/pending/committed distinctions and appropriate units/ownership. It also requires readable statements and a newcomer review, and explains when external keys or conventional names must stay compatible.

Across maintained browser, server, build and test modules, 567 JavaScript lexical bindings changed names; see [naming-summary.txt](naming-summary.txt). Examples include `$` → `getElementById`, `r` → `propertyRecord`, server `b` → `toolRequest`, parser groups → `recordsByAddress`, and token `now` → `issuedAtSeconds`. Python locals now distinguish `job_context`, `speech_synthesizer`, `audio_source`, `tool_call` and the appropriate speech/transcript text. Functions and statements are expanded consistently. The previously compressed generated server request handler is visible as a multiline template with descriptive locals; its routing behavior is unchanged.

Existing exported function/method names, serialized field names, tool definitions, selectors, literals and test assertions remain compatible. Where a short field is part of an existing contract, the descriptive local alias is explicit. Source comments are retained, updated where they name changed variables, and added to newly clarified test helpers. The third-party SDK, hash-pinned requirements, package metadata, HTML/CSS, migrations and company-source identity are unchanged. No new application dependency, production data or deployment is included.

## Verification and acceptance

- **AC-01:** Reviewed the mandatory AGENTS section for naming roles, exceptions, formatting and completion review.
- **AC-02:** Inspected parsing, retrieval, address tools, DOM rendering, token/session handling, audio lifecycle, build code and test helpers. Corrected several first-pass names that were long but described the wrong role (string comparisons are not always cities; state callbacks do not receive streams).
- **AC-03:** [JavaScript AST comparisons](javascript-preservation.txt) pass for every maintained JS source/test module after canonicalizing lexical bindings, equivalent static object-key spelling and the embedded handler's own AST. Property/export names, literals, order and control flow remain checked. [Python AST comparisons](python-preservation.txt) pass after reversing scoped local renames and excluding docstrings. Existing attributes/keyword keys and tool annotations are retained. These checks establish structural preservation under the permitted transformation, not real-device behavior.
- **AC-04:** Baseline source-only JavaScript checks passed 43 tests; the generated-entrypoint test requires a build artifact and was explicitly excluded from that first run. Both baseline and final isolated generated-server runs built the actual Worker and ran the repository's complete `npm test`: server fingerprint/auth/decoding/token checks plus all 44 active JS tests passed. All seven Python worker tests passed before and after with the repository's hash-pinned dependencies installed only under /tmp. Final diff/whitespace checks pass. Source publication is verified separately after the delivery commit.

Evidence: [baseline JS](baseline-tests.txt), [baseline generated-server run](baseline-synthetic-integration.txt), [baseline Python](baseline-python-tests.txt), [final generated-server run](final-synthetic-integration.txt), [final Python](final-python-tests.txt).

## Data and environment limits

No real company CSV was available in the checkout, and none was retrieved or replaced. Integration used an explicitly labeled synthetic one-record CSV and corresponding synthetic fingerprint only in `/tmp/finvoice-synthetic-readability-*` staging copies. Production `.openai/property-source.json` is unchanged. Temporary artifacts were never deployed or committed. Their success validates engineering assembly/access behavior, not company-record provenance, valuation accuracy, real microphone audio or deployed runtime performance.

The original browser-speech suites under tests/ are historical source, as documented in README. Their names/formatting were improved and their ASTs preserved, but they are not substituted for the active package suites. The live-model probe was not run. Real device/visual checks and live publication are outside this source readability task.

Development-only Babel/Prettier and LibCST/Black tooling was installed under /tmp; application manifests remain unchanged. Verification scripts used the pinned original source and parsed both versions. The Worker build's current line-based import removal requires single-line import declarations, which were preserved while function bodies were expanded.

## Recovery and review limits

Temporary transformation/verification tooling needed correction before final verification:

- Initial npm metadata lookup failed because its default cache path was unwritable; using a task-specific /tmp cache resolved it. No repository configuration changed.
- Three lexical rename collisions were caught before transformation completion. Explicit role-specific names resolved them; the final transformation completed on its fourth attempt, and source-only regressions passed.
- Initial JS comparison could not spawn Git inside the Node sandbox. Extracting the baseline through Python resolved that; a subsequent comparison accounted for formatter-equivalent numeric object keys. No source decision changed to satisfy the checker.
- Black's process-based CLI stalled in this sandbox (default and one-worker attempts). Both were terminated; its sequential formatting API completed, followed by passing Python tests.
- The initial file-wide reverse-name checker confused a newly named Transcription parameter with an existing entrypoint variable. Scoping that reversal correctly produced identical Python ASTs on the second comparison attempt.
- Expanding the embedded handler initially lost the semicolon separating the generated asset table from its export. Structural and isolated-build checks caught it. Restoring the separator preserved the original routing AST and made all integration checks pass. No failed generated artifact was deployed; the temporary failing artifact remains at `/tmp/finvoice-synthetic-readability-final` for this session, with successful artifacts in later staging directories.

Final work was inspected by Codex. Automated syntax/rename equivalence does not by itself prove readability; the role-specific naming review above addresses that judgment. No independent review, production build, deployment or real-device validation is claimed.
