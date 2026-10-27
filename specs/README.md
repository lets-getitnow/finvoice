# Specifications Guide

Specifications describe the intended behavior and acceptance criteria for a change before implementation details.

## Forward-only specifications

Write each numbered specification once. After it is written, never edit, append to, rename, or renumber it, including for corrections, clarifications, status updates or completion notes. New work or changed requirements require the next numbered specification. Reference the relevant predecessors and state exactly which requirements are superseded; unaffected requirements continue to apply.

This forward-only policy supersedes earlier instructions to maintain a single mutable specification. Preserve existing numbered documents as historical records, including any outdated workflow instructions they contain. `AGENTS.md` and this guide are maintained workflow documents, not immutable numbered specifications.

## Prompt coverage

Every project-owner prompt must be accounted for in the same change. Record the initiating prompt in each new specification. A later prompt that adds, removes or changes requirements belongs in a new numbered specification with its own acceptance criteria and predecessor references. A prompt that only continues already specified work or causes no requirement change belongs in an associated results record, with the reason it does not change the contract. Do not rely on chat history as the only source of intent or append later prompts to existing specifications.

Implementation is not complete until the specification chain and associated results records account for every owner prompt in the task and identify how the new or changed requirements were checked.

## Content

1. Begin with a concise, action-focused title, preferably fewer than five words.
2. Include metadata such as the author and date near the top.
3. State the problem, goals, scope, constraints, and acceptance criteria in high-level language.
4. Keep implementation details and code examples out of the main requirements when possible. Put necessary low-level notes at the end.
5. Identify assumptions, dependencies, risks, and explicitly excluded work.
6. Define how the completed behavior will be verified.

For new specifications, assign stable acceptance IDs such as `AC-01`. IDs are scoped by the spec number, never renumbered after publication, and referenced by tasks and evidence. Do not retrofit IDs into old specs: cite their exact heading/requirement number in new task records instead.

## Plans, tasks and current requirements

Follow [WORKFLOW.md](../WORKFLOW.md). Requirements state what and why; a technical plan states how; tasks identify ordered work, dependencies and state; verification links acceptance to observed evidence. Keep mutable plan/task progress under the associated results directory. Published verification/report records remain immutable; corrections create linked revisions.

Use [plan](../templates/plan.md), [tasks](../templates/tasks.md) and [verification](../templates/verification.md) templates for substantial work. Small changes may combine these fields in one concise results record. Templates are starting structures, not new authorization or instructions to execute unspecified commands.

If a destination maintains `specs/CURRENT.md`, update it when effective requirements change. This optional index links explicit supersessions and implementation evidence; it is not part of the portable kernel and must not replace source specs. A historical proposed/completed label is not a substitute for subsequent authorization and results.

Before resuming, read the task's saved next action, controlling spec, source identities, blockers and recovery count. Before completion, map every applicable acceptance criterion to output and verification; unresolved failed or stale required checks prevent completion. A passing command alone cannot establish semantic acceptance.

## Testing

1. Propose three to seven focused test ideas for each specification.
2. Organize tests so their association with the specification number and title is clear.
3. Store generated test evidence under the repository's designated results or artifacts location when persistent evidence is required.
4. Make recorded results detailed enough to identify inputs, relevant environment information, observations, and outcomes.
5. Keep tests that require live external services out of routine CI unless CI is intentionally configured with the required credentials and isolation.
6. Never place secrets or sensitive production data in tests, fixtures, logs, or results.

## Naming

Use the next unused sequential number for each new unit of work, including follow-on changes to previously specified behavior. Do not create a competing copy of the entire predecessor: describe the new scope and link to the earlier requirements that still apply.

Keep each specification's identifier and slug aligned with its own related artifacts. For example:

- Specification: `specs/00003-example-change.md`
- Test or verification script: `00003-example-change.<ext>`
- Results directory: `results/00003-example-change/`

Keep earlier specifications and their artifact identifiers unchanged. New work receives a new identifier rather than reusing the earlier one.

## Completion Record

When a specification is implemented, write its completion record under `results/<spec-number>-<slug>/`, separately from the immutable specification. Record:

- the previous behavior and failure mode;
- the implemented change;
- verification performed and key evidence;
- important invariants preserved;
- whether all acceptance criteria were satisfied;
- remaining or out-of-scope work;
- rejected shortcuts or tradeoffs that future maintainers should understand.

Keep the record concise but reproducible. Link to the specification, tests and result artifacts instead of duplicating large outputs. Add dated progress or verification entries without overwriting earlier evidence; never insert completion records into an existing numbered specification.
