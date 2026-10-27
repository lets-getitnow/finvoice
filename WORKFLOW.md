# Development Workflow

Use this with [AGENTS.md](AGENTS.md), the [specification guide](specs/README.md) and [REPORTING.md](REPORTING.md). This is an agent-performed procedure. It contains no automated checker, CI job, model service or scheduler.

## 1. Establish the task

Read the user's scope, working tree and relevant source before editing. Load optional destination policy through AGENTS. Identify controlling requirements and explicit supersessions; distinguish requirements from historical completion status. Record boundaries, unrelated edits and necessary inputs. Use available authorization without inserting new approval gates.

Investigate uncertainty that materially changes the solution. For substantial ambiguous work, compare plausible approaches and state the selected rationale; do not manufacture alternatives for trivial edits. New requirements get a new immutable spec before implementation. A continuation with no requirement change goes in its results record.

## 2. Plan proportionately

For dependent steps, cross-component work or work likely to span sessions, create a [plan](templates/plan.md) and [task record](templates/tasks.md). Include approach, affected surfaces, dependencies, verification, risks and recovery. Keep requirements separate from technical choices. A small reversible change may use one results record containing those same applicable fields.

Before substantial work, provide a compact decision brief: the decision, strongest feasible alternatives including stop/defer, the result that would change the next action, validity requirements, and authorized effort/stop condition. Use qualitative evidence and material tradeoffs, not invented numerical scoring weights. Read any governing intent/current-state records routed by destination policy and the applicable execution spec. Dependencies must identify the valuable decision or experiment they unlock; recurring blockers need a new source, method or reason to expect progress before extending work. Evaluation criteria must be defined before outcomes; follow destination rules for absent thresholds and promotion.

Every task references its spec-scoped acceptance IDs, predecessor tasks, output and check. States are `pending`, `in_progress`, `blocked`, `done` or `not_applicable`. Use `not_applicable` only with evidence that the task/criterion does not apply; it cannot waive an unmet requirement. Record blockers and the action that resolves them. Do not mark a task done just because its edit was written.

For dependencies, explain the path from the repair to the exact comparison/decision, its materiality and remaining obstacles. Compare feasible alternatives and state what would reverse the choice. An obtainable source is not sufficient priority evidence. Label measured effort, assumption-built estimates, configured limits and unknowns separately; a pilot must inform both correctness and residual scope before scaling. Keep this reasoning inside the existing brief.

For substantial work, use `results/<spec-number>-<slug>/` with `plan.md`, `tasks.md`, `verification.md` and `execution-report.md` as illustrative output names. Existing project formats may be reused when they preserve the same fields and meaning.

## 3. Implement and inspect

Work through ready tasks within scope. Update progress after meaningful changes, interruptions or blockers. Preserve unrelated files and successful evidence. Changed requirements need a new numbered spec; changed technical choices need a dated plan revision.

For a behavior change or bug fix, use a focused failure-reproducing check before the fix where practical, then demonstrate it passes after the fix and run relevant regression checks. For documentation, links, dependency closure, requirement consistency and preservation checks may suffice. If a before-failure cannot safely or meaningfully be reproduced, record the limitation and an alternative observable check. Do not claim TDD without a recorded failure→fix→pass sequence.

For debugging, establish the symptom and bounded failing operation, inspect evidence, form a testable cause and change one relevant factor. Keep useful diagnostics and remove temporary noise. Follow AGENTS' recovery ceiling and destination limits; retain counts across restarts, record the reason before retrying, and never disguise recovery as a fresh verification budget.

When cached inputs, expensive operations or a bounded report-only path are at risk, read [preserve-efficient-paths](skills/preserve-efficient-paths/SKILL.md). Other proposals remain dormant until justified. Available external agents/tools do not imply permission to delegate, install or expand the task.

## 4. Resume from durable state

Before an intentional pause or handoff, update tasks with timestamp, controlling spec/plan, source revision and relevant working-file identities, completed work, exact next action/check, blockers, failed attempts and retained counts, artifact paths, authorization boundaries and pending decisions. Record unknown outcome as unknown.

On resume, read that packet and authoritative sources, then check that inputs still match. Reuse completed valid work. If sources changed, assess affected tasks and invalidate their stale verification; preserve old evidence and record the replacement. Do not repeat expensive unchanged work merely to establish activity. Missing dependencies can remain visible blockers while independent authorized work continues.

A research/application checkpoint is not this development resume packet unless it contains these fields. Summarized context is not evidence that a check passed.

## 5. Completion gate

Use [the verification template](templates/verification.md), retaining actual source identities and artifacts. The gate is **manual**, even when individual checks use existing tools. Do not claim automatic enforcement.

1. **Intent coverage:** every applicable acceptance criterion maps to task/output and observed verification. Missing links or unsupported `not_applicable` prevent completion.
2. **Check outcomes:** record `passed`, `failed`, `blocked` or `not_run`, with command/procedure, scope and evidence. Failed, blocked or not-run required checks prevent completion. Genuinely inapplicable checks need rationale; optional unchecked surfaces are limitations.
3. **Freshness:** evidence identifies actual inputs and implementation/document snapshot, including uncommitted changes. Changed inputs make dependent checks stale until rechecked. An old test pass cannot establish current success.
4. **Consistency and preservation:** compare outputs with original intent and invariants. Check links/dependencies and unrelated-file preservation. For UI work, verify common use, meaningful error/recovery and relevant responsive layouts.
5. **Semantic review:** inspect the actual work, acceptance and supporting evidence before claiming completion. For substantive work, record who reviewed it and any important limits in the saved results. A template, task checkbox or exit code does not replace inspection; do not imply independent review or real-world validation that did not occur.
6. **Delivery:** follow [REPORTING.md](REPORTING.md): lead with the outcome, develop useful supporting detail, explain what was verified and make remaining work or next steps clear. Keep technical evidence in linked results when helpful; no fixed report sections or full-inline duplication are required. Follow applicable commit/delivery rules and preserve historical records.

If the gate finds missing work, add tasks under the unchanged requirement and repeat affected checks. Changed requirements need a new spec. Completion means applicable acceptance is satisfied and reviewed, not that time or a task list ended.

## Maintenance and automation boundary

Keep contracts, templates, manifest and callers consistent. Before an external-framework adapter, pin the intended version, compare authority/mutability/discovery rules and test a representative task. Before an automatic gate or CI, separately implement and verify missing-evidence, failed-check, stale-source and pending-review rejection. Documenting those criteria does not implement them; do not install tooling merely to use this workflow.
