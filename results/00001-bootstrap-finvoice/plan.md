# Extraction plan

Codex, 2026-10-27. Requirements: ../../specs/00001-bootstrap-finvoice.md.

Decision: export an explicit allowlist into an isolated review directory, validate it, then create a fresh sibling Git repository at ~/dev/finvoice and publish private lets-getitnow/finvoice. Copying the complete source tree or its history would include excluded analysis; reimplementing would add unnecessary risk. Defer publication only if credentials, scope review or required checks fail.

Source: current reviewed kernel working files, source main HEAD 5326bc2; property voice app current clean nested Site source HEAD 6ec8636. Snapshot records individual copied hashes. The new app retains the property voice implementation, not unrelated LiveKit hello-world demos. Kernel dependencies close within the new destination; old cloud identity and original source history are excluded. The real CSV remains external and is used only for a local smoke check, never copied to evidence or Git.

Order: copy exact kernel and allowlisted runtime/tests; change app identity/docs; check link closure, secrets and tests; promote copy to new sibling, initialize/commit; create private GitHub repository and normal push; verify remote visibility and matching HEAD. No purchases, paid API calls, dependency installs, data upload or changes to the original app. Maximum ten bounded attempts per failing operation; investigate before retry and preserve evidence. Scope is the smallest independent runnable property voice app plus kernel and new destination evidence.

Real audio remains a manual owner check. Synthetic engineering test outcomes and source-backed UI checks are reported separately. No 80% retrieval-performance claim is made.
