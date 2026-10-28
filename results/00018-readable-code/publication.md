# Readability source published

Codex, 2026-10-28. Self-review.

The source refactor is published to `lets-getitnow/finvoice` main as [1a83a9a2222dd14e8558ee75a250b1a7abb3b69b](https://github.com/lets-getitnow/finvoice/commit/1a83a9a2222dd14e8558ee75a250b1a7abb3b69b), directly following the pinned starting commit e3f0847693f94a62f25f783ae5317de91d1087b9. The non-force branch update required that exact previous head, preserving concurrent-work protection. No branch history, repository visibility or deployment access was changed.

GitHub's commit tree is `28b5ce9c1f2c43bdf4498a54e6a9bad3bfbc0677`, identical to the locally committed, reviewed source tree. The local implementation commit ad7a394 and the API-created GitHub commit have different commit metadata but identical file contents. A subsequent GitHub read verified main points to the published source commit and confirmed descriptive names in dist/app.mjs, including getElementById, addressToolSession, interfaceState, previewRequestVersion and pendingPropertyId.

All four acceptance criteria in spec 00018 are satisfied within the checks documented in execution-report.md: policy/source changes, structural preservation, the actual generated-server assembly with isolated synthetic data and 44 passing active JavaScript tests, seven passing Python tests, and verified source publication. No original company input, deployment artifact or temporary tooling was committed. No real-device audio, real-source valuation validation or live redeployment is claimed. This evidence-only follow-up does not alter runtime code or stale the tested source.
