# Start LiveKit voice before connecting records

2026-10-28 user report: Start talking lights up but does not work. Production evidence shows dataset 404 and no voice session request; click handler exits before invoking LiveKit when no dataset exists. This corrects the public voice-start behavior in 00003; property valuation still requires an authorized dataset.

AC-01: Start talking invokes LiveKit regardless of CSV availability. Keep authentication and microphone-error handling.
AC-02: Retain a captured address without fabricating a valuation; explain the CSV requirement beside voice controls and expose import/sign-in recovery there.
AC-03: Preserve private storage and lookup boundaries, test the reproduction and recovery, and publish the correction to the existing public Site.

Checks: synthetic UI reproduction before fix; start/finish with no dataset; captured transcript and no search request; permission-error retry; sign-in error display; existing server/property/session tests; native publication result. Real iPhone audio remains device verification, not covered by doubles.
