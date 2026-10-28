# Create the Finvoice Repository

<a id="bootstrap-finvoice"></a>
<a id="owner-intent"></a>
<a id="acceptance"></a>
<a id="bounds-and-verification-ideas"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

On 2026-10-27, the owner narrowed an initial request to publish an entire source repository. The new request was to create a separate app named Finvoice containing only the property valuation voice assistant and the reusable development instructions it needed. The original repository also contained API analysis and unrelated experiments that were not part of the new app.

At this stage, Finvoice was a local browser application: a person supplied an authorized company CSV export, spoke or typed an address, answered clarification questions, and received the matching property's imported valuation. This spec describes that initial extraction, not the later hosted architecture.

The “portable kernel” means the eleven-file set of reusable agent instructions, workflow guidance and dependencies listed in [KERNEL.MD](../KERNEL.MD). “Closing references” means including the local files that those instructions require so their links work in the new repository.

## Required outcome

- **AC-01:** Create a separate Finvoice repository containing the complete eleven-file portable kernel. During extraction, preserve the selected files byte for byte and include every required local reference.
- **AC-02:** Copy the property voice application's runtime and tests into a project that can run independently. Preserve address lookup, clarification and voice behavior, name the app Finvoice, and explain how to start it using an authorized CSV kept outside Git.
- **AC-03:** Leave the original repository intact. Exclude its API analysis, simulations, prior specifications/results, unrelated voice demos, Git history, cloud identities, credentials, datasets, installed dependencies and generated artifacts.
- **AC-04:** Check the copied file inventory, kernel hashes and links, and relevant tests. Where practical, exercise a successful lookup, an error and recovery, and narrow-screen layout in a browser. Commit and publish normally to a private Finvoice GitHub repository under the authenticated owner's account; report its URL and actual commit, and disclose any unverified audio behavior.

## Scope and limits

This extraction did not authorize feature redesign, uploading company data, changing cloud agents, publishing a website, exposing credentials or installing dependencies. Use available tooling. Company records remain outside Git, and the owner's provenance statement does not independently verify their valuations. Synthetic test records must stay isolated.

## Relationship to earlier work

This is the first spec in the new repository; it has no predecessor here. These are historical delivery constraints. [00002](00002-public-cloud.md) later changes hosting visibility, [00008](00008-server-owned-company-data.md) changes data delivery, and [00011](00011-github-sync.md) expands which cloud source belongs on GitHub. Later maintenance of workflow files does not retroactively change the byte-preservation check required for this original extraction.

## How to verify

Compare the extracted kernel bytes and allowed file inventory; check local links; run the copied test suite; serve the copy with the authorized external CSV and inspect lookup, error recovery and mobile layout; scan for credentials and excluded files; confirm GitHub visibility and that its commit matches the delivered source. Record results separately from this specification.
