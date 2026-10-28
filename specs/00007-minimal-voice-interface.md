# Minimal voice interface

User requests only text input and speak button, retaining existing LiveKit text events, removing unnecessary UI. Supersedes prior page-layout, CSV-import UI and decorative copy requirements. Public hosting, private data/API and LiveKit transport remain effective.

AC-01: One text field and one primary speak control; remove header, hero, map, cards, data statistics, import controls, toggles and footer. Adapt to narrow screens with accessible touch targets.
AC-02: Preserve LiveKit interim/final transcript events, connection/error feedback and microphone start/finish. Reuse the single button to stop playback/connection. Show sign-in recovery only when needed.
AC-03: Keep Enter-based private lookup and existing spoken result behavior when records are connected; do not remove backend data or change voice processing. Publish on the existing public Site.

Checks: actual HTML control count; strict HTML-derived DOM startup; capture/transcript events; error/retry/stop; typed lookup/TTS; server/privacy/session regressions. Browser/device layout inspection remains a limitation unless supported preview is available.
