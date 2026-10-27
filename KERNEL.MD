# Project Kernel

## Purpose

A small, domain-neutral development workflow: persistent rules, forward-only specifications, proportionate plans and resumable tasks, reusable procedures, and explicit verification/review. This manifest defines the complete reusable document set and its refresh procedure. It does not install tooling or enforce checks automatically.

## Kernel Files

Copy this manifest plus every file in the table. Paths are relative to the repository root; directory names are not implicit recursive includes.

| Required file | Responsibility |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Generic working agreement and optional destination-policy discovery |
| [WORKFLOW.md](WORKFLOW.md) | Planning, task/resume state, testing/debugging and manual completion gate |
| [REPORTING.md](REPORTING.md) | Proportionate narrative reporting, evidence and durable results |
| [specs/README.md](specs/README.md) | Immutable requirements, acceptance IDs and prompt traceability |
| [templates/plan.md](templates/plan.md) | Technical approach, scope, dependencies and verification plan |
| [templates/tasks.md](templates/tasks.md) | Ordered tasks, acceptance mapping and resume packet |
| [templates/verification.md](templates/verification.md) | Check outcomes, source identities and semantic review |
| [templates/execution-report.md](templates/execution-report.md) | Optional writing aid for a clear outcome-first story |
| [skills/PROPOSALS.md](skills/PROPOSALS.md) | Active/dormant procedure rationale and promotion criteria |
| [skills/preserve-efficient-paths/SKILL.md](skills/preserve-efficient-paths/SKILL.md) | Narrow procedure for preserving bounded, cached workflows |

There are ten dependencies plus this manifest. No application, package, external framework, model service or tool-specific configuration is required to read or use this document workflow. A skill file can be read explicitly when relevant; automatic discovery depends on the receiving agent's environment and is not provisioned here.

## Destination Boundary

Root `PROJECT.md` and `specs/CURRENT.md`, if present, are destination-specific overlays/indexes, excluded from the export. AGENTS conditionally discovers PROJECT; a new destination without it is valid. Never carry source policy implicitly. Root application `README.md`, numbered product specs, application code, results, datasets, secrets and environment/tool configuration are also excluded.

The required set must not depend on any excluded source artifact. It may describe optional overlays or illustrative output paths as such. A destination can create its own overlay and current-requirements index after copying; preserve the distinction between generic policy and domain-specific authorization.

## Refresh and Snapshot Procedure

1. Read this manifest and the current working version of every dependency. Inspect Git status and compare with HEAD; neither silently discard uncommitted improvements nor assume all working edits are approved for export.
2. Select a reviewed snapshot. Record date/time, source HEAD when available, whether the snapshot uses working files, each exported path's content hash, and the reasons for differences from HEAD. Preserve unrelated work. A working snapshot is suitable for local review; do not describe it as committed or synchronized.
3. Read every required document and generalize source-specific products, providers, tools, account details, permissions, paths and commands. Keep only rules useful in an unknown destination. Retain narrow procedures only when their actual stable value is documented; keep speculative ones dormant.
4. Copy only the explicit manifest set to an isolated review directory. Resolve all required local links inside that directory, including skill references. Missing required files block export readiness. Optional destination paths and template placeholders are explicitly exempt, not silently ignored.
5. Inspect the isolated set for domain-specific operating policy, source-only dependencies and sensitive information. Compare content hashes with the chosen snapshot. Verify the forward-only specification rule, scope/authorization preservation, and reporting/review requirements still apply.
6. Review the actual export diff and record outcomes with [the verification template](templates/verification.md). These are manually performed checks backed by tools when available; no automatic validator is bundled.
7. Before publishing an export or claiming a durable committed release, commit only the reviewed kernel and its necessary workflow evidence as a focused change. Verify the committed set resolves its dependencies. Follow the destination's delivery rules for any push; local refresh/assessment alone does not activate publication or permit staging unrelated files.

## Readiness and Maintenance

A local snapshot is document-ready when its required references close within the set, generic rules need no unavailable source, placeholders are clearly illustrative, promoted skills remain scoped, and verification/review identify the exact contents. Committed-release readiness additionally requires a verified commit. Neither status implies cross-agent discovery, automatic enforcement or application runtime validity.

When adding a required document or skill, update this table and verify dependency closure in the same change. When updating a procedure, update its callers, templates and associated verification. Do not duplicate the constitution in a competing framework directory. When operating rules evolve, change the destination overlay/index and preserve numbered history rather than expanding the reusable kernel with product-specific policy.
