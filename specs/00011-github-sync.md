# Publish the Current Cloud Source

<a id="publish-cloud-source"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-28, the owner instructed that all current code be pushed to GitHub. The repository initially contained the extracted local prototype, while the deployed website and voice worker had gained substantial functionality. A reader or developer on GitHub needed the actual current cloud implementation.

Publish to `lets-getitnow/finvoice`, retaining its history and reusable development instructions. Synchronizing source is separate from deploying the website.

## Relationship to earlier work

This expands the extraction-only delivery scope in [00001](00001-bootstrap-finvoice.md), including its exclusion of non-secret hosting metadata. Specs [00002](00002-public-cloud.md) through [00010](00010-livekit-disambiguation-tools.md) describe the cloud functionality now authorized for publication. Preserve the repository visibility actually observed at delivery; do not assume the original private setting still applies.

## Required outcome

- **AC-01:** Include all tracked current deployment source on GitHub main: LiveKit function tools, the server CSV loader, migrations, tests and implementation evidence.
- **AC-02:** Preserve the destination's portable kernel/workflow files, historical bootstrap records, Git history and observed visibility. Exclude the company CSV, secrets, local environments and generated deployment bundles.
- **AC-03:** Compare source and run active checks in the destination repository, then publish with a normal, non-force update. Verify that GitHub main points to the resulting commit.

## Scope and limits

Do not erase newer repository work or publish runtime data because it was present in a deployment workspace. Existing real-device verification limits remain. This source publication does not itself redeploy the live website.

## How to verify

Compare synchronized source bytes; check preservation of workflow/history; inspect ignored data/artifacts and targeted secret patterns; run the active JavaScript/Python checks where prerequisites exist; compare the delivered commit with remote main. Distinguish local commits from commits actually visible on GitHub.
