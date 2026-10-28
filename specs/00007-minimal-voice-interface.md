# Simplify the Voice Interface

<a id="minimal-voice-interface"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

The owner requested a page focused on a text input and a Speak button, removing decorative and secondary UI. The goal was to make speaking or typing an address easy while preserving the existing LiveKit conversation.

The same voice control should change purpose with the conversation: start listening, finish capture, or stop connection/playback. Necessary progress, transcript and error information must remain understandable.

## Relationship to earlier work

This replaces earlier page-layout, decorative-copy and CSV-import UI requirements. Keep public hosting, protected data/APIs and LiveKit processing. Later requests deliberately add controls back: [00012](00012-match-price-submit.md) adds the Enter button and prominent price, while [00013](00013-selectable-address-choices.md) adds selectable address cards. The original single-button restriction must not be used to remove those later features.

## Required outcome

- **AC-01:** Provide one text field and one primary Speak control. Remove the header, hero, map, cards, dataset statistics, import controls, toggles and footer. Support narrow screens and accessible touch targets.
- **AC-02:** Preserve interim/final transcript events, connection/error feedback and microphone start/finish. Reuse the voice button to stop playback or connection work. Show sign-in recovery only when needed.
- **AC-03:** Keep keyboard Enter lookup against private records and the existing spoken-result behavior when records are connected. Do not remove backend data or alter voice processing. Publish through the existing public Site.

## How to verify

Count controls in the actual HTML; initialize the controller using only DOM elements present in that HTML. Exercise capture, transcript updates, errors, retry, stop, typed lookup and spoken replies. Rerun server/privacy/session checks. Report browser/device layout inspection as unperformed unless an actual supported preview was inspected.
