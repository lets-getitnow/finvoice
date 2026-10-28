# Writing and Reading Specifications

<a id="specifications-guide"></a>
<a id="forward-only-specifications"></a>
<a id="prompt-coverage"></a>
<a id="content"></a>
<a id="plans-tasks-and-current-requirements"></a>
<a id="testing"></a>
<a id="naming"></a>
<a id="completion-record"></a>

A specification explains a requested change so that someone who did not see the conversation can understand the problem, the intended result and how to check it. Write for that reader first. A list of implementation terms or acceptance IDs is not enough.

## What Finvoice does

Finvoice helps a person find a property in an owner-provided company export and hear or read its imported valuation. People can type or speak incomplete addresses, answer follow-up questions and select a suggested record. The page is public; access to company records and voice sessions requires sign-in. The current design keeps the full dataset on the server and uses LiveKit for voice.

The specifications below record how that design evolved. They describe requested behavior, not proof that it was implemented or deployed. For observed outcomes and limitations, read the corresponding records under [results](../results/). For current setup and architecture, start with the [project README](../README.md).

## Required writing standard

Every spec must provide enough context to stand on its own:

1. **Explain the problem first.** State who asked for the change, what they were trying to do, what happened and why the difference matters. Include the initiating prompt or a faithful summary. Do not invent logs, quotations, causes or facts missing from the original evidence.
2. **Describe the desired experience.** Use a short concrete example when useful, such as an incomplete address producing choices instead of an unexplained failure. Mark synthetic examples as examples; do not present them as observed company records.
3. **Explain how it fits.** Link the relevant earlier specs. State exactly which requirements change and which remain. Explain historical designs that later specs replace so readers do not mistake them for current instructions.
4. **Write observable requirements.** Use stable acceptance IDs (`AC-01`, etc.). Each item should say what must happen and under what conditions. Expand dense lists into readable sentences. Define necessary terms at first use; an API name alone does not explain a requirement.
5. **State scope and limits.** Explain what the request includes, what it excludes, what data/infrastructure it depends on and what remains unknown. Separate source identity from source accuracy, and engineering simulation from real-world evidence.
6. **Explain verification.** Give three to seven focused checks, or comparably clear groups of checks. Say what each check establishes. A successful build, deployment or mock test must not imply real-device audio, visual review or source-data truth.

Include an author and date where known. For historical material with missing metadata, mark what is known instead of inventing an original author/date. Editorial revision metadata must be distinct from the original request date.

Use clear, descriptive titles; clarity matters more than a word-count limit. Prefer familiar language: “ask a follow-up question” instead of unexplained “disambiguation,” “obsolete result” instead of unexplained “stale turn,” and “publish to GitHub” instead of an unexplained “delivery gate.” Keep exact function names where they help identify a contract, then explain their role. Write paragraphs with a clear subject and connected reasoning; avoid sentence fragments packed with slashes and acronyms.

Keep requirements separate from implementation choices. Put necessary protocol, API or architectural details in a short technical-context section after the main requirements. Do not remove a technical restriction when it is part of the owner's request, such as requiring actual LiveKit function calls.

## A useful shape

Adapt this structure to the size of the change; do not add empty sections to satisfy a template:

- A descriptive title and known author/date.
- Why the change was requested, including the relevant user journey or failure.
- How it relates to earlier work and any explicit replacements.
- Required outcomes with stable acceptance IDs.
- Scope, dependencies, unknowns and essential technical explanations.
- How to verify, with the limits of those checks.

Before completing a spec, read it as if you were new to the project. A reader should be able to answer: What problem are we solving? What should happen? Why do these constraints exist? What changed from earlier decisions? How would we know it works? Rewrite any passage that requires the chat history to answer those questions.

## Changes, history and requirement IDs

Published numbered specifications normally remain fixed. New or changed product requirements belong in the next unused numbered spec, with links to the requirements it explicitly replaces. Do not infer authority from a higher number, a newer filename or an old “completed” label alone. Unaffected earlier requirements continue to apply.

The owner may explicitly authorize an editorial revision of existing specs, as in [00017](00017-clear-specifications.md). That exception permits clearer context and wording, not silent changes to behavior. Preserve filenames, numbering, acceptance IDs, requirement meaning and existing referenced headings/anchors. Record the reason, affected documents and checks in a new results record. Git history retains the original wording. Do not use this exception without owner authorization or use it to rewrite historical results.

Do not append implementation progress, test passes or deployment claims to numbered specs. Keep those in their associated results records. Do not retrofit or renumber acceptance IDs in historical specs; reference the original heading/requirement when it has no ID.

## Reading the specification history

This index is a map to the decisions, not a replacement for their requirements. Read the linked changes when a historical rule appears to conflict with current behavior.

| Spec | Problem or decision | Relationship to later work |
| --- | --- | --- |
| [00001: Create the repository](00001-bootstrap-finvoice.md) | Extract only the app and reusable instructions into a separate private repository. | Public hosting and broader cloud-source publication arrive in 00002 and 00011. |
| [00002: Public website](00002-public-cloud.md) | Make the page publicly reachable while protecting records. | Browser speech changes in 00003; per-user uploads change in 00008. |
| [00003: LiveKit voice](00003-retain-livekit.md) | Use LiveKit instead of browser speech services. | Startup/capture fixes follow; the LiveKit choice remains. |
| [00004: Voice without records](00004-start-voice-without-data.md) | Missing records must not block starting voice. | Import UI described here is removed by 00007/00008. |
| [00005: Page initialization](00005-initialize-hosted-entrypoint.md) | Hosted HTML must actually initialize button handlers. | Later UI changes retain the need for working startup and recovery. |
| [00006: Audio stream reading](00006-read-livekit-microphone.md) | Fix worker-side microphone stream consumption. | Browser permission timing is addressed separately in 00016. |
| [00007: Minimal interface](00007-minimal-voice-interface.md) | Remove distracting UI while preserving conversation controls. | Enter and address cards are deliberately added by 00012/00013. |
| [00008: Automatic company data](00008-server-owned-company-data.md) | Let signed-in visitors use the server dataset without uploads. | Authentication and the prohibition on public exports continue. |
| [00009: Partial recommendations](00009-address-recommendations.md) | Suggest records for incomplete/reordered addresses. | Real model tools and selectable cards follow in 00010/00013. |
| [00010: Model function tools](00010-livekit-disambiguation-tools.md) | Resolve submitted replies through ordered LiveKit model tools. | 00012 permits source-verified exact release; 00015 strengthens user-evidence priority. |
| [00011: GitHub synchronization](00011-github-sync.md) | Publish the current cloud source instead of only the old prototype. | Source publication remains separate from website deployment. |
| [00012: Price and Enter](00012-match-price-submit.md) | Show verified exact prices and provide explicit text submission. | 00013 adds clickable choice confirmation. |
| [00013: Address cards](00013-selectable-address-choices.md) | Select a displayed candidate to see or compare its price. | Confirmation/data safeguards continue. |
| [00014: Code documentation](00014-document-current-source.md) | Document the current source and publish those explanations to GitHub. | This concerns source comments, not spec writing quality. |
| [00015: Spoken evidence](00015-spoken-address-evidence.md) | Preserve supplied numbers/addresses when model hints disagree. | Matching safeguards remain; this does not change capture infrastructure. |
| [00016: Microphone startup](00016-microphone-startup.md) | Request capture directly from Speak and handle cancellation reliably. | This changes browser capture timing, not property data or worker deployment. |
| [00017: Clear specifications](00017-clear-specifications.md) | Require standalone context and plain language; revise existing specs. | An explicitly authorized editorial change, preserving product requirements. |
| [00018: Readable code](00018-readable-code.md) | Require intentional descriptive names and refactor dense source without changing behavior. | Extends source documentation; public contracts and runtime safeguards continue. |

## Terms used in this repository

- **Company export / CSV:** the owner's source file of addresses and imported valuations. A fingerprint identifies approved bytes; it does not independently validate prices.
- **Site / web Worker:** the existing hosted website and its server application, which serves the page and protected APIs.
- **Voice worker / LiveKit agent:** a separate service that handles audio and invokes address tools. A website deployment alone does not prove it is ready.
- **Turn:** one user interaction. Its ID allows asynchronous results from cancelled interactions to be rejected.
- **Candidate / clarification:** a possible source address / a follow-up question to distinguish possible addresses.
- **Function tool / RPC / broker:** a callable operation selected by the model / a remote procedure call / the component relaying that request. See [00010](00010-livekit-disambiguation-tools.md) for their roles.
- **Same origin:** the same URL scheme, host and port as the app. It is an API access check, alongside authentication.
- **Synthetic fixture:** explicitly invented, isolated test data. It must never substitute for company records in operational behavior or evidence.
- **Acceptance criterion:** a numbered, observable requirement. Its ID is stable within its spec and links work to verification.

## Task records, verification and delivery

Follow [WORKFLOW.md](../WORKFLOW.md). The spec states what and why; the plan explains the approach; task records track work; verification records show what was actually checked. Use [plan](../templates/plan.md), [tasks](../templates/tasks.md) and [verification](../templates/verification.md) templates proportionately. Templates do not authorize extra tools, delegation or external actions.

Account for every owner prompt in the same change. A new requirement goes in a new spec; a continuation belongs in its results record with an explanation that the contract is unchanged. Record acceptance IDs, dependencies, outputs and checks so later work can resume without relying on chat history. If a project maintains `specs/CURRENT.md`, update it when effective requirements change; this optional index must not replace the source specs.

Use aligned names: `specs/00018-example-change.md` and `results/00018-example-change/`, with associated test filenames where appropriate. Keep previous identifiers and artifact paths unchanged.

Store useful verification evidence in the results directory. Identify the actual source revision, inputs, command/procedure, observed outcome and limitations. Keep secrets and sensitive production data out of tests/logs; do not run live-service tests routinely without their required credentials and isolation.

Before claiming completion, map applicable acceptance criteria to outputs and current verification. Unresolved required checks prevent completion; optional unavailable checks must be disclosed. A passing command alone is not semantic review. Completion records should explain the previous problem, resulting change, preserved invariants, acceptance coverage, remaining work and meaningful tradeoffs. Preserve published results; corrections belong in linked follow-up records. Reports should follow [REPORTING.md](../REPORTING.md) and make sense without reproducing internal workflow metadata.
