# Clearer specifications

Codex, 2026-10-28. Self-review, not independent review. Controlling requirements: [00017](../../specs/00017-clear-specifications.md).

The owner asked for contextual, readable specs and better guidance so cryptic specifications stop recurring. The revised guide now requires a user problem, intended experience, links to earlier decisions, definitions, observable acceptance criteria, scope and meaningful verification. All sixteen earlier specs have been rewritten to explain those elements while retaining their product requirements. The guide adds a history map and glossary; AGENTS enforces the writing standard and limits editorial exceptions to explicit owner authorization. The project README links to the guide.

## Source and scope

Pinned GitHub main: `3ed55f3b86523ab124ee51a36c7585b69fbb118e`. Its newer spoken-evidence and microphone-startup specs (00015/00016), and its updated project README, were read directly from GitHub before editing. All earlier spec/guide and AGENTS blob identities were checked against that revision. The publication must build on its tree, not the older local runtime snapshot. The remote branch is checked again before publication and updated without force using its expected head.

This is the owner's explicit exception to normally fixed specifications. Original filenames, acceptance IDs and heading anchors are retained; Git history preserves the original wording. Existing runtime files, historical result records and unrelated recent changes are outside this diff. No application tests or deployment are needed for these prose edits.

## Plan and task outcomes

1. Read all sixteen specs and the current guide/README; identify missing context and supersessions: done.
2. Establish the plain-language standard, history map and glossary; align AGENTS and README: done (AC-01, AC-03).
3. Rewrite specs 00001–00016 against their original acceptance and scope requirements: done (AC-02).
4. Check requirement IDs, anchors, links and intended file scope; commit and publish using the pinned remote parent: local review/checks complete (AC-04). The commit containing this report is the documentation delivery; successful remote publication must be checked separately, not inferred from a local commit.

## Requirement-preservation review

Each row was compared manually against its original text. Automated ID/link checks do not establish semantic preservation on their own.

| Spec | Preserved requirement and clarified context |
| --- | --- |
| 00001 | Separate extraction, eleven-file kernel, exclusions, original byte/privacy checks and private delivery. Explained the local-prototype stage and later hosting/source-scope changes. |
| 00002 | Public page, per-user protected persistent records, deployment/access checks and honest missing-data limits. Explained that the later shared dataset replaces per-user imports. |
| 00003 | LiveKit-only voice, typed lookup, authenticated same-origin short-lived room grants and separate worker readiness. Defined rooms and tokens. |
| 00004 | Start voice without data, retain captured input, expose then-required recovery and preserve valuation/privacy limits. Explained the observed early exit and later removal of visitor uploads. |
| 00005 | Hosted HTML must initialize handlers, controls stay disabled until ready and failures offer recovery. Explained why direct-controller tests missed startup and retained the historical sign-in startup check. |
| 00006 | Supported stream iteration, current-frame forwarding, explicit closure, cancellation and safe diagnostics. Defined iterator/context-manager mismatch and separated worker reading from later browser timing. |
| 00007 | Minimal input/primary voice control, removed UI, transcript/error/stop behavior, typed/private lookup and publication. Explained later Enter/card exceptions rather than deleting original intent. |
| 00008 | Original source identity, automatic signed-in dataset, no public CSV/index, bounded memory, disabled uploads and preserved old data. Distinguished source fingerprint from valuation truth. |
| 00009 | Street-first/prefix suggestions, three choices, retained replies, silent previews, strict default behavior and real-source check. Explained missing historical tools without claiming they existed. |
| 00010 | Actual ordered model function calls, source/actual-reply constraints, answerable questions, lifecycle/RPC defenses, access/privacy and deployment checks. Defined tool roles and browser relay; linked later exact-match exception. |
| 00011 | Current cloud source on GitHub, preserved workflow/history/visibility, excluded secrets/data/artifacts and verified non-force publication. Distinguished publication from deployment. |
| 00012 | Source-verified unique exact price, confirmation for uncertainty, price clearing/Enter, responsive layout and publication. Explained zero/conflicts and model guesses. |
| 00013 | Accessible three-card choices, direct confirmation through tools, context-preserving switching, obsolete-result protection and publication. Explained click-to-price journey. |
| 00014 | Mandatory accurate inline source explanations, current implementation coverage, behavior/vendor preservation, honest checks and actual GitHub delivery. Separated source comments from spec-writing quality. |
| 00015 | Consistent spoken number parsing, priority of actual numeric/address evidence, uncertainty safeguards and explicit build-input blocker. Explained the reported phrase without introducing a hardcoded property. |
| 00016 | Capture permission from Speak, publish only after readiness, single-owner cancellation, accurate errors and focused checks/publication. Defined tracks/connection work and retained no-retry/dependency/data/worker-deploy bounds. |

## Verification and limits

[verification.txt](verification.txt) records successful checks across all sixteen prior specs: original acceptance IDs and occurrence counts, original heading anchors, contextual sections, index coverage, and local Markdown links/fragments across the specs/guide/AGENTS/README. `git diff --check` also passes. The first structural check caught a missing explicit predecessor section in spec 00001; added the section and reran successfully (two structural-check attempts).

Source comparison and self-review show no intended product requirement change. The additional headings are explanations, not completed implementation claims. Checks inspect prose structure and references; they cannot automatically prove a document is understandable. The semantic review above supplies that human-readable assessment without claiming independent review. Application/device/source-data validation and website redeployment were not performed or implied.
