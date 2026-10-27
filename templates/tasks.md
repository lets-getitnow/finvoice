# Tasks and Resume State

Template: fill actual values. Governed by [WORKFLOW.md](../WORKFLOW.md). Task states: `pending`, `in_progress`, `blocked`, `done`, `not_applicable` (justified). Updating work state never rewrites published evidence.

Specification: [number/path] · Plan: [path/revision]

| Task ID / outcome | Depends on | Spec acceptance IDs | State | Output and verification reference |
| --- | --- | --- | --- | --- |
| [task] | [IDs or none] | [spec:AC IDs] | pending | [intended output and observable check] |

## Resume packet

- Updated at / author: [timestamp and author]
- Controlling spec and plan: [paths/revisions and explicit supersessions]
- Source identities: [HEAD plus relevant working hashes or equivalent]
- Completed evidence: [stable artifact paths; what remains valid]
- Next action and check: [one concrete ready task and observable result]
- Blockers / pending decisions: [missing input, impact and resolution; none if clear]
- Failed attempts: [operation identity, actual count including initial, evidence, investigated reason and next permitted step]
- Authorization and resource boundaries: [existing scope, access, cost/limits, prohibited expansion]
- Changed/unknown state: [affected verification needing recheck; no guessed outcomes]

## Dated progress

[Changes, task transitions, reasons, actual checks and retained evidence. Mark inspection versus implementation versus domain observations accurately.]
