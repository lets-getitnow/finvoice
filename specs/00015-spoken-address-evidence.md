# Preserve spoken address evidence

Author: Codex. Date: 2026-10-28.

Prompt: “Should have found 320 Mint....generalized solution” with screenshot of “Three twenty mint” receiving a street-name question.

Extends specifications 00009, 00010 and 00012. Supersedes permission for model hints to replace a deterministically parsed house number and street; all confirmation, data and access safeguards remain.

AC-01: Spoken grouped, digit-by-digit and cardinal house numbers resolve consistently with numeric input, including number-only follow-ups and street-first input. Preserve literal street names.
AC-02: Model interpretations cannot discard or replace a supplied house number/full address or classify a numeric address as unknown. Ambiguous, prefix and phonetic matches retain confirmation safeguards.
AC-03: Verify isolated synthetic regressions and relevant existing checks. Publish to the existing Site when its original build input is available; otherwise preserve the patch and identify the build/publishing blocker without fabricating data.

Scope excludes changes to property data, microphone infrastructure and visual layout. Original owner export remains unverified; synthetic fixtures are test evidence only.

Verification ideas: grouped/cardinal/digit inputs; street-first inputs; number-only continuation; conflicting model house/street hints; model unknown intent; prefix/phonetic uncertainty. Actual phone audio remains a separate verification limit.
