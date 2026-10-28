# Publish cloud source

Codex, 2026-10-28. User instruction: push all current code to GitHub. Synchronize the deployed Site/LiveKit implementation into lets-getitnow/finvoice while preserving existing GitHub history and portable workflow files. This supersedes 00001's original extraction-only delivery scope and exclusion of non-secret hosting metadata; specifications 00002–00010 describe the now-authorized runtime.

AC-01: GitHub main includes all tracked current deployment source, LiveKit function tools, server CSV loader, migrations, tests and implementation evidence.
AC-02: Preserve the destination's kernel/workflow, historical bootstrap records, existing history and observed repository visibility. Exclude the CSV, secrets, local environments and generated deployment bundles.
AC-03: Verify source equality and active checks in the destination, then perform a normal non-force push and verify GitHub main matches the resulting commit.

Check ideas: byte-compare synchronized source; verify workflow file preservation; check ignored data/artifacts and precise secret patterns; run active JS/Python checks; compare remote main and local HEAD. Existing device-verification limits remain unchanged; this publication does not redeploy the website.
