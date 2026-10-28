# Make Specifications Understandable

Author: Codex, requested by the project owner. Date: 2026-10-28.

## Why this change was requested

The owner reported that the specifications lacked context and used cryptic language. They requested better guidance in the specs README and revision of all existing specs to follow it. A reader should not need the original conversation or detailed implementation knowledge to understand why a change exists and what it requires.

The existing writing guide named content categories but did not require a clear user story, definitions or readable explanation of evolving decisions. Several specs compressed those ideas into fragments, unexplained acronyms and lists. Historical requirements also appeared to conflict without enough explanation of which later request replaced them.

## Relationship to earlier work

This applies to the specification-writing guide and specs 00001–00016, including the newer spoken-address and microphone-startup requirements. It complements [00014](00014-document-current-source.md), which concerns documentation inside source code rather than specification prose.

The owner explicitly authorizes editing the existing specs for this task. This is an exception to the repository's usual fixed-after-publication rule. It permits editorial clarification while preserving acceptance IDs, filenames, references and product behavior. New or changed product requirements still need a new numbered spec; this task does not silently revise them.

## Required outcome

- **AC-01:** Update the specs README to require the user problem, desired experience, relationship to earlier requirements, definitions of necessary terms, observable outcomes, scope/dependencies and verification limits in clear language. Include a usable reading map and examples of the writing standard.
- **AC-02:** Revise every existing numbered spec through 00016. Explain its original context and requested behavior so it stands on its own. Preserve each acceptance ID, constraint and requirement meaning; explain later replacements without erasing historical intent. Preserve original links and heading anchors.
- **AC-03:** Align AGENTS with the new writing rule and the explicitly authorized editorial exception. Link the guide from the project README. Preserve runtime code, data, historical results and unrelated newer work.
- **AC-04:** Review each revised spec against its prior requirements, validate IDs, links and historical references, and inspect the exact change scope. Commit and publish the documentation to GitHub with current-source checks; distinguish source publication from deployment.

## Scope and limits

Use original specs and current repository evidence as the basis for context. Do not invent root causes, original author/date metadata or verification claims. Explain observed evidence as evidence and a proposed requirement as a requirement. Synthetic examples are illustrative, not company observations.

This task does not change product features, run the application, install dependencies, retrieve company data, run live audio/model checks or redeploy the website. Published implementation reports remain historical evidence. Record this editorial review separately rather than overwriting those reports.

## How to verify

1. Compare each spec's acceptance IDs and requirements with the pinned GitHub revision; manually review meaning, scope and replacements.
2. Check that each spec explains why, how it relates to earlier decisions, what must happen and how to verify it, using terms defined locally or in linked explanations.
3. Validate local Markdown links and preserve previous heading anchors; ensure the guide includes every numbered spec.
4. Confirm the published diff contains only the intended documentation files and that GitHub main includes the reviewed commit without overwriting subsequent changes.
