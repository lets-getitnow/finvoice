# Tasks and delivery state

Updated by Codex, 2026-10-27. Spec: ../../specs/00001-bootstrap-finvoice.md. Plan: plan.md.

| Task | Depends on | Acceptance | State | Evidence |
|---|---|---|---|---|
| Kernel/runtime extraction | none | AC-01, AC-02, AC-03 | done | source-snapshot.json; 11 matching kernel files, 39 links |
| Tests, source scope and browser review | extraction | AC-01–AC-04 | done | verification.md; 31 passed in test-output.txt |
| Independent commit and private publication | checks | AC-04 | done | delivery.md; matching local/remote content SHA, private lets-getitnow/finvoice |

Local app: /Users/hunterp/dev/finvoice. Remote: https://github.com/lets-getitnow/finvoice.git, private, main. Content commit 1f7cf3ff8e66698d5a6a3cec65982009a4051dc3. Final delivery evidence is synchronized in a subsequent normal commit. Source snapshot hashes are the authoritative copied identities; original files rechecked unchanged after publication. No API analysis, source history, source policy overlay, old cloud identity, credentials or company CSV copied. No failures or unresolved blockers in this extraction/publication. No feature, hosting or live-model deployment work remains within this scope. Real audio validation remains an explicitly disclosed manual limitation, not a claim of success.
