# Readability plan

Source: GitHub main e3f0847693f94a62f25f783ae5317de91d1087b9, freshly cloned to /workspace/finvoice-readable. User scope: descriptive intentional names and understandable code, plus AGENTS guidance. No unrelated working-tree changes were present.

Use lexical-binding-aware renaming and format ordinary source. This preserves the existing architecture and public contracts while directly removing confusing names. A manual rewrite of algorithms would add unnecessary behavioral risk; formatting alone would leave the naming problem unresolved. Reconsider only if syntax-tree comparison or regression checks expose a semantic change.

Dependencies/tasks:

1. Record requirements and baseline behavior; inventory bindings and protected interfaces (AC-01–AC-04).
2. Update AGENTS and refactor local names/internal helpers and formatting, including tests (depends on 1; AC-01–AC-03).
3. Compare binding-normalized JavaScript/Python syntax and run existing tests, including isolated synthetic generated-server assembly (depends on 2; AC-03/AC-04).
4. Inspect documentation and precise diff scope, commit and publish with current-head protection (depends on 3; AC-04).

Stop if a rename changes a wire key, export, tool schema or runtime decision; correct the transformation rather than broadening the task. Temporary tools live outside the repository. Real company CSV/build data is absent from this checkout; synthetic integration inputs and artifacts must remain under /tmp, clearly labeled and never published as operational evidence. No deployment or real-device audio is authorized by this source refactor.
