# Skills and Proposals

This catalog distinguishes promoted repository procedures from dormant ideas. A dormant entry is a design note, not an active `SKILL.md`. Promoted procedures are listed in the kernel manifest; their metadata does not install agent-specific discovery or grant additional permissions.

Create a proposed skill only after the repository contains a real workflow that repeatedly needs its guidance. Until then, keep the proposal dormant so speculative instructions do not consume context or impose rules the project does not need.

## Preserve Efficient Paths

- **Name:** `preserve-efficient-paths`
- **Status:** Promoted repository procedure; [SKILL.md](preserve-efficient-paths/SKILL.md). Use through [WORKFLOW.md](../WORKFLOW.md) when relevant. Behavioral validation is a bounded local rehearsal, not a cross-agent benchmark.
- **Purpose:** Protect a known inexpensive execution path when changing cached, bounded, batch, or report-only workflows.
- **Why a skill may be needed:** Agents can accidentally turn a narrow operation into a broad rebuild, rescan, network refresh, or other expensive fallback. A repository-specific skill can capture which artifacts are reusable, which steps are costly, and how to prove that a change preserves the intended boundary.
- **Potential trigger:** Work on a mature workflow with measured performance, reusable cached state, or strict limits on which inputs may be processed.
- **Create it when:** The project has at least one measured expensive workflow, its safe bounded path is documented, and the same constraints apply across multiple changes.
- **Do not create it when:** The project has no such workflow, the guidance would only restate ordinary testing practices, or the correct path is still unknown.
- **Likely contents:** A short decision workflow, repository-specific performance invariants, representative verification commands, and references to authoritative cache or artifact contracts.
- **Success signal:** A change can be verified on the smallest representative input without silently triggering unrelated expensive work.

## Protect Review Interfaces

- **Proposed name:** `protect-review-interface-contracts`
- **Status:** Dormant proposal
- **Purpose:** Preserve accepted layout, interaction, persistence, and data-contract behavior in a human review interface.
- **Why a skill may be needed:** Review tools often combine visual requirements with stateful data semantics. Generic frontend guidance may miss repository-specific rules about what a count means, where feedback is stored, which server persists it, or which elements must remain visible together.
- **Potential trigger:** Changes to a recurring review interface whose accepted behavior depends on both visual checks and persistent feedback data.
- **Create it when:** The project has an accepted interface, stable data contracts, a repeatable visual-verification workflow, and recurring changes that risk regression.
- **Do not create it when:** No review interface exists, the UI is still exploratory, or ordinary component tests fully describe the behavior.
- **Likely contents:** Canonical screenshots or acceptance references, interaction and persistence invariants, a minimal verification sequence, and links to the authoritative data contract.
- **Success signal:** Interface changes preserve both the accepted review experience and the meaning and durability of stored feedback.

## Promotion Checklist

Before turning a proposal into a skill:

1. Collect concrete user requests that should trigger it.
2. Identify knowledge or procedure that a capable agent could not reliably infer from the repository alone.
3. Confirm the workflow is repeated and stable enough to justify always-visible metadata.
4. Define a concise name and description that state what the skill does and when to use it.
5. Include only necessary instructions and resources; link to repository-owned source-of-truth documents instead of duplicating them.
6. Create the minimal skill document and validate with available standard skill tooling. No mandatory code, model service or agent-specific configuration is required; disclose unavailable validation and use documented structural checks where necessary.
7. Test it on a representative task before treating it as authoritative.

Record promotion evidence in the destination's associated results: concrete triggers, repeated workflow/source evidence, a representative use, failure/recovery boundary check, validation outcome and limitations. Keep domain examples out of the portable skill; link only manifest-owned resources from its entry point. If a new destination has no demonstrated need, keep the procedure unused or demote it during refresh rather than imposing irrelevant work.

Testing, debugging and verification procedures are currently centralized in [WORKFLOW.md](../WORKFLOW.md). Create separate skills only when repeated tasks demonstrate additional non-obvious value. Protect Review Interfaces remains dormant; no accepted recurring interface workflow has been established by this promotion.
