# Initialize the Hosted Page

<a id="initialize-the-hosted-entrypoint"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

After the previous voice-start fix, the owner still reported an unresponsive button. Tests that mounted the controller directly had missed the actual startup path: the hosted HTML loads a JavaScript entry module, and that module must initialize the controller before any button handler exists.

The required experience is straightforward: the page either becomes usable or explains how to recover from a startup failure. It must not present an apparently active button that has no handler.

## Relationship to earlier work

This closes a startup gap left by [00004](00004-start-voice-without-data.md); it does not replace its voice-without-data requirement. Existing LiveKit and private-data requirements remain. “Mount” means initialize the controller against the page and attach its event handlers. The “generated Worker” is the built server application that serves the hosted HTML and assets.

## Required outcome

- **AC-01:** Make the JavaScript module loaded by the hosted HTML initialize the controller and attach voice/search handlers. Keep Start talking disabled until initialization completes.
- **AC-02:** If startup fails, display an actionable recovery message beside the controls instead of leaving an active-looking, unresponsive button.
- **AC-03:** Verify startup beginning with the generated server's actual HTML, preserve existing checks and publish through the same public Site.

## How to verify

Follow the entry-module path found in the generated HTML and reproduce the missing click handler before correction. After correction, check the installed handler, enabled control and the then-required sign-in startup request. Rerun property and voice API checks and inspect native deployment success. This historical sign-in check describes the startup design at this stage; it is not evidence of later startup behavior or real phone audio.
