# GitHub source synchronization

Codex, 2026-10-28. User explicitly requests pushing the current code to GitHub. Destination is lets-getitnow/finvoice, default branch main. GitHub metadata reports PUBLIC visibility and push permission; preserve that observed setting. This differs from historical bootstrap records that described its creation as private. No visibility change is authorized or performed.

Baseline GitHub main: 2e311943a29ce0998040ebea4916658f7b5138f3. Current deployed source/evidence snapshot: Sites dbe6f58ae819a30b2e366a96b29eee4fc0d1426a (runtime source 3003b7d084e91553a75aea3ab2e07748a668beae). Both trees were clean. Fetch succeeded; no newer GitHub changes or conflicts found.

Plan/tasks: copy the Site's tracked source into the existing GitHub tree, merge ignore rules, retain kernel and historical bootstrap files; verify source identities, active checks and sensitive-file exclusions; commit on the existing history and push normally to main. No runtime code redesign, GitHub visibility change or website deployment. Original Sites history remains in its repository; this commit synchronizes the complete current source snapshot.

Company CSV is the existing owner-provided source, not independently verified. A local ignored copy is used solely for the existing build checks. It, generated artifacts, environments and credentials are excluded from Git. Synthetic engineering fixtures remain separately labeled. Source identity manifest contains fingerprint and aggregate provenance only.

Checks and delivery outcome will be recorded below. Attempts: one fetch succeeded; no failing operations. Reviewer: Codex self-review; no independent or new device validation claimed.

Verification passed in the GitHub destination: all 49 tracked files from the Sites snapshot match byte-for-byte, except the intentionally merged ignore rules and appended README repository note. AGENTS.md, KERNEL.MD, WORKFLOW.md, REPORTING.md and specs/README.md match the baseline exactly. Raw CSV, generated Worker artifact and local environment are ignored. Targeted private-key/GitHub-token/OpenAI-key pattern scan of synchronized files passed. Build succeeded against the unchanged owner-provided CSV fingerprint; 22 JavaScript checks and seven Python checks passed. Existing model/device verification is not repeated or broadened by this copy.

GitHub CLI auth-status check in the restricted shell reported an invalid GH_TOKEN; this does not establish the outcome of an authenticated Git push. Next: try the normal non-force Git push using the available CLI credential helper, and verify remote main. No token contents inspected or printed.

Delivery succeeded: source commit b0707cb963a480ef1ca6800ba66fd2f0de96c146 pushed normally from the existing history to GitHub main. A separate git ls-remote confirmed refs/heads/main equals that full SHA, and working tree was clean. Credential helper worked for the actual networked push despite the earlier restricted-shell auth-status diagnostic. One source push succeeded; no push failures, force pushes, visibility changes or runtime deployments. This evidence record is delivered in a subsequent normal commit.

Acceptance review: AC-01 all current tracked Site source copied and matched; AC-02 workflow/history preserved and sensitive inputs/artifacts ignored; AC-03 destination build and 29 active checks passed, push and remote SHA verified. Codex self-review inspected the staged inventory, source equality, exclusions and remote destination. No new audio/device validation was performed or implied. All requested GitHub publication scope is complete.
