# Repository Guidelines

## Read the Working Agreement

- Start here, then read [WORKFLOW.md](WORKFLOW.md) for planning, task state and completion checks and [REPORTING.md](REPORTING.md) for execution reporting. Read [specs/README.md](specs/README.md) before specification work.
- If a root `PROJECT.md` exists, read it before acting: it contains this destination's additional operating rules and routes to its current-policy index. It is an optional destination overlay, not a required portable-kernel dependency. Its absence in a new project is normal.
- System/developer instructions and the user's authorized scope take precedence. Within repository policy, the destination overlay specializes these generic rules; explicit superseding specifications govern their named requirements. Do not infer precedence solely from a newer filename or historical status label. Resolve material ambiguity from the relevant source and session context.
- Use the smallest workflow that preserves intent and evidence. Do not add permission questions, delegation, external communication or tool installation merely because a template or borrowed methodology mentions them.

## Core Principles

- Read and understand the relevant code and documentation before making changes.
- Follow the user's requested scope. Propose materially broader work before starting it.
- Solve the root cause and complete one coherent problem at a time.
- Prefer simple, explicit solutions over clever or premature abstractions.
- All code must be clearly documented in the source. Treat inline documentation as part of implementation and completion, not optional follow-up work.
- Preserve existing behavior unless the requested change requires otherwise.
- Never expose secrets, credentials, personal data, or other sensitive information.
- Commit completed changes when the repository workflow or user requires it, and report the commit identifier.

## Working in the Repository

- Check the working tree before editing and preserve unrelated user changes.
- Follow existing project structure, naming, formatting, and tooling conventions.
- Reuse repository-owned utilities and constants instead of duplicating behavior.
- Add dependencies, configuration, environment variables, or new entry points only when necessary; explain the reason.
- Avoid destructive operations unless the user explicitly requests them.
- Keep generated files and build artifacts out of source control unless the repository intentionally tracks them.

## Code Quality

- Favor readable control flow, descriptive names, and small cohesive units.
- Keep domain states and serialized contract values centrally defined and validated at boundaries.
- Handle expected states explicitly. Do not silently swallow failures or invent fallback behavior that hides invalid state.
- Use environment variables for deployment-specific configuration and secrets, not as an undocumented substitute for application design.
- Follow the mandatory inline documentation requirements below for every code change.
- Do not mix unrelated cleanup or refactoring into a focused change.

## Inline Code Documentation (Required)

- Document all code, including application logic, internal helpers, scripts, tests, migrations, and configuration logic. Every new or changed code unit must have clear documentation alongside its implementation. When touching existing undocumented code, document the affected units as part of the same change.
- Give each module or script a concise explanation of its purpose and responsibilities. Document each function, method, class, and other logical unit with a nearby comment or the language's standard docstring/documentation format, including private helpers.
- Explain what the unit does and why it exists. Describe inputs, outputs, important constraints, failure behavior, and side effects where applicable. Include units, formats, defaults, state changes, and external interactions when they matter to correct use.
- Place inline comments immediately beside non-obvious logic. Explain business rules, invariants, boundary cases, algorithms, ordering requirements, concurrency, performance constraints, and workarounds well enough that a reader can safely change the code.
- Use short, plain, precise sentences and concrete domain terms. Explain intent and reasoning; do not merely paraphrase syntax or add a comment to every obvious assignment. Keep simple units' documentation brief while still stating their purpose.
- Keep documentation accurate in the same change as the code. Update or remove stale comments whenever behavior, contracts, or assumptions change. Never describe intended behavior as though it were implemented.
- README files, specifications, external documents, descriptive names, and tests supplement inline documentation; they do not replace it. Use references for deeper background while keeping the essential explanation in the source.
- Before declaring a code change complete, review every added or changed unit for documentation coverage, clarity, and agreement with the implementation. Missing or misleading inline documentation is unfinished work, even when tests pass.

## Testing and Verification

- Add or update tests for changed behavior, including important success, failure, and boundary cases.
- Run the narrowest relevant checks first, then broader checks when justified by the change.
- Verify user-visible changes in the actual interface or runtime when practical.
- Report exactly what was verified and disclose any checks that could not be run.
- Do not claim completion while known failures caused by the change remain unresolved.

## User Interface and Experience

- For tasks that create, change, review, or test a user-facing interface or interaction flow, evaluate clarity, ease of completion, error prevention, and recovery.
- Verify the common path, a meaningful error-and-recovery path, and relevant responsive layouts before declaring UI work complete.

## Data Provenance

- Treat every dataset as unverified until its source, collection method, and real-versus-synthetic status have been checked.
- Prefer real, source-attributed data. Before analysis, reporting, ranking, optimization, or model evaluation, inspect the available data and state what is real, what is synthetic, and what is unknown.
- Never fabricate records, transactions, outcomes, identities, or observations to fill a data gap. Report the missing data instead.
- Never mix synthetic records into operational databases, reports, learned artifacts, performance calculations, or evidence presented as real-world validation.
- Synthetic fixtures are allowed only for deterministic scaffolding and tests. They must be unmistakably named and marked as synthetic, use reserved example identifiers or domains, and write only to isolated temporary storage.
- Production ingestion must reject synthetic or unknown provenance by default. Any test-only override must be explicit, bounded, and visible in its output.
- User-facing reports and persistent evidence must identify data provenance and must not describe fixture behavior as a real result.
- When a real source is expected, check for it before creating a fixture or fallback. Do not silently substitute synthetic data for unavailable real data.

## Efficient Workflows

- Apply destination-specific access authorization and shared limits from the project policy when present. Distinguish engineering bounds from user permission; do not repeatedly seek permission already granted for the current scope.
- Start with the smallest representative input before scaling expensive or batch work.
- Reuse valid local caches and bounded inputs when doing so preserves correctness.
- Do not introduce hidden network calls, broad scans, or expensive fallback passes.
- Keep long-running commands observable with useful progress output.
- Record important performance assumptions and validate them when a change affects a measured path.

## Automation Failure Protocol

- Allow deliberate debugging and recovery within the authorized task, up to ten total attempts per logical failing operation, including the initial attempt. Preserve the count across restarts; a second attempt is not itself a workflow failure.
- Investigate the observed failure and record the reason or corrective change before each retry. Stop earlier when another attempt is unlikely to help. Do not run blind retry loops, reset counters to evade the limit, or repeat failures hundreds of times.
- On recurring defects, add a focused diagnostic, preflight, checkpoint, invariant or regression test when it helps prevent recurrence. Label planned verification separately from recovery attempts.
- Ordinary read-only retries within this bounded policy do not need repeated user confirmation. Existing authorization boundaries still apply to destructive actions, external messages, purchases and materially broader work. Ask before exceeding ten attempts or materially changing scope.
- Preserve failed evidence, reuse successful caches and count every external attempt against applicable request/rate limits. Never disguise retries as changed queries or erase an earlier attempt.
- Communicate material failures using `AUTOMATION FAILURE`, stating the operation, observed impact, investigation and next step. Report recovery and actual attempt counts; distinguish a resolved transient failure from an exhausted or unresolved operation.

## Documentation and Specifications

- Read relevant README and specification files before implementation.
- Read `specs/README.md` before starting specification work.
- Specifications are forward-only: write each numbered spec once and never edit, append to, rename, or renumber it. New work or changed requirements require a new numbered spec that references and explicitly supersedes the relevant earlier requirements.
- Record implementation progress, verification, completion notes, and follow-up prompt traceability in associated results records, not by changing an existing spec.
- Keep requirements high-level and implementation-independent where possible.
- Update documentation in the same change when commands, behavior, interfaces, or operational steps change.
- Separate completed scope, remaining work, and newly discovered out-of-scope issues in completion notes.
- Daily summaries must tell an evidence-backed story: start with the main finding and why it matters, then progress to supporting observations, granular metrics, uncertainties and next steps. Cite source records, distinguish engineering tests from domain evidence, and label cumulative versus newly observed results. Follow [REPORTING.md](REPORTING.md); do not lead with a raw table or task checklist.

## Response Format

- Tell a clear story: start with the high-level outcome and why it matters, then develop the useful details, what was verified, any limitations and what happens next. Follow [REPORTING.md](REPORTING.md).
- Match the length to the task. Small changes and direct questions deserve short answers; substantial work can include more detail. Prefer a few connected paragraphs over a formal report with repeated headings.
- Do not require seven sections, tournaments, hypothesis updates or internal process metadata in ordinary responses. Explain real tradeoffs only when they help the user make a decision.
- Keep claims evidence-backed. Distinguish implementation from successful execution, tests from real observations and completed work from blockers. Never claim review or validation that did not occur.
- Save useful results and recovery records for substantive work, and link technical evidence when helpful. The conversation must make sense on its own, but need not reproduce saved records in full. Preserve historical reports and specifications.

## Debugging

- Reproduce the problem and gather evidence before changing behavior.
- Add focused diagnostics without changing unrelated logic.
- Remove temporary diagnostics unless they provide lasting operational value.
- Fix race conditions through deterministic coordination or state design, not arbitrary delays.

## Commits

- Keep commits focused and self-contained.
- Use commit messages that describe the behavioral outcome.
- Do not commit unrelated changes, secrets, local configuration, or temporary artifacts.
- Follow the destination repository's documented delivery workflow; configure a remote only when its intended destination and access requirements are known.
- Before pushing, verify that the remote targets the intended repository and has the required visibility and access controls.
- Preserve repository visibility and deployment access unless the user explicitly requests a change.
- Use a normal non-force push when pushing is part of the agreed workflow. Never force-push, rewrite shared history, or delete a remote branch unless the user explicitly requests it.
- If a remote condition prevents an intended push, report the unpushed commit identifier and the exact blocker instead of claiming synchronization.
