# Retain LiveKit voice

User steering received 2026-10-28: retain LiveKit rather than browser speech. Supersedes browser speech requirement in 00002 AC-01; other requirements remain.

AC-01: LiveKit handles microphone transcription and spoken replies; no browser speech recognition/synthesis fallback. Typed lookup stays available.
AC-02: Voice session creation requires authenticated, same-origin requests and issues short-lived grants scoped to one private room. Cloud API secrets remain server-only.
AC-03: Publish on the existing public Site without changing private property data or schema. Verify available worker readiness independently of frontend publication and disclose missing infrastructure.

Checks: auth/origin/method failures; token scope/expiry; frontend module validity and transport asset routes; property regression; bounded cloud dispatch readiness.
