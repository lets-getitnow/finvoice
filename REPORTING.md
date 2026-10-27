# Reporting

Reports should read like a clear story, not a process audit. Start with the big picture and add detail only when it helps the user understand or act.

## Tell the story

Lead with what happened, whether the goal was achieved, and why the result matters. Then explain the important changes or findings and how you checked them. Finish with any remaining limitation, blocker or useful next step.

This is a natural progression, not a required set of headings. A small change may need one paragraph; substantial work may need a few paragraphs and a short list. Use plain language and connected prose. Do not start with a raw checklist, metrics table or execution metadata.

## Match the detail to the task

- Default to a concise answer. Add technical detail, metrics, tables or diagrams when they clarify the result or support a decision.
- Explain meaningful tradeoffs when a real choice matters. Do not invent competing explanations or alternatives to fill a template.
- Do not require seven sections, tournaments, hypothesis IDs, formal review labels or a fixed number of perspectives in ordinary reports.
- Keep hashes, timestamps, execution IDs, retry ledgers and implementation inventories in supporting records unless they matter to the user's decision.
- Answer direct questions directly. Progress updates should explain what was learned and what remains, without repeating the final report.

## Keep the evidence honest

Say exactly what was verified and what remains untested. Distinguish an implementation from a successful real integration, synthetic tests from real observations, and expected benefits from measured results. Make partial completion and blockers clear early; never let a passing test or finished edit imply an unverified outcome.

Include the few observations or checks that support the conclusion. Link relevant files or evidence for deeper inspection. Report material failures, recovery and costs when relevant, preserving actual attempt counts in the task record. Keep secrets and sensitive data out of every report.

When uncertainty affects the next action, explain it plainly and say what would resolve it. Do not add approval questions or expand scope just because an alternative exists.

## Save useful records

For substantive implementation, experiments or operational work, keep a durable results record with the important outcome, verification, remaining work and evidence needed to resume. A small change can use one concise completion record; routine questions and explanations do not need separate execution reports.

The conversation should stand on its own, but it does not need to reproduce the saved record in full. Give the user the story and link supporting detail. Preserve earlier published results; corrections or new evidence get a linked follow-up record rather than silently rewriting history.

Before claiming completion, inspect the actual work and evidence. Record who reviewed substantive conclusions and any important limits in the saved record. Do not imply independent review, live validation or successful execution that did not happen. Formal review states are useful only where the task actually needs them; they are not a required user-facing ceremony.
