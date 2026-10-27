---
name: preserve-efficient-paths
description: Preserve a documented bounded or cached execution path when changing mature acquisition, batch, replay or report workflows; use when a change risks a broad rescan, rebuild or hidden external fetch.
---

# Preserve Efficient Paths

Use the current task's source contracts and measured/cache evidence. This procedure grants no access and does not assume any provider, scheduler, package or agent tool is installed. General recovery and completion rules remain in [AGENTS](../../AGENTS.md) and [WORKFLOW](../../WORKFLOW.md).

1. Identify the narrow path before changing it: exact required inputs, valid cached artifacts and their identities, affected output, costly alternatives, known request/compute bounds, and actual authorization. Distinguish measurements, estimates and unknowns.
2. Write those boundaries in the task's plan/resume record. Check that a real required source exists before inventing a fixture or fallback. Reuse known successful evidence; do not substitute an inadequate cache solely to avoid an authorized useful request.
3. Start with the smallest representative input that exercises the changed behavior. Check that the path touches only relevant inputs and does not silently fetch, rescan, rebuild, retry or publish. For a report/document change, prove source and operational state were preserved instead of rerunning its underlying workload.
4. If a source, cache identity or bound fails, preserve the failure and identify the affected scope. Investigate before retrying, retain the logical attempt count, and state the corrective change. An unchanged unavailable input is a blocker/pending state, not justification for a broad fallback. Continue independent authorized work where useful.
5. Record actual cost/requests, reused evidence, changed assumptions, verification and limitations with the [verification template](../../templates/verification.md). Do not count reused output as a new execution or infer real-world effectiveness from a fixture. Broader work requires an explicit scope decision; ordinary authorized recovery does not require repeated permission.

This is a repository procedure that can be read explicitly. Cross-agent discovery is environment-dependent and not installed by this file. Reassess its fit in a new destination; retain only useful workflow-specific information and links that travel with the manifest.
