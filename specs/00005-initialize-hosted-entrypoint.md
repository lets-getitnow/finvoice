# Initialize the hosted entrypoint

User reports the same inert button after 00004. Correct the actual hosted HTML-to-controller startup chain; controller unit tests alone did not cover it. Prior private-data and LiveKit requirements remain effective.

AC-01: The HTML module entrypoint mounts the controller and attaches voice/search handlers. Keep Start talking disabled until mounting completes.
AC-02: A bootstrap failure displays actionable inline recovery instead of an inert active button.
AC-03: Verify initialization starting from the generated Worker's actual HTML, preserve existing checks, publish to the same public Site.

Checks: reproduce missing onclick using the generated HTML module path, show pass after entrypoint correction, verify sign-in startup request and enabled handler; property/voice API regressions; native deployment success. DOM doubles do not establish real phone audio.
