# Resolve Addresses Through LiveKit Tools

<a id="livekit-model-invoked-address-tools"></a>

Editorial revision: Codex, 2026-10-28. This owner-authorized rewrite clarifies the original requirements; acceptance IDs and intended behavior are preserved.

## Why this change was requested

The owner approved a three-tool design and explicitly required real LiveKit model function calls. Address clarification should understand imperfect speech while keeping property selection and valuation grounded in company records. A browser-only search wrapper would not meet that request.

For each submitted typed address or final voice transcript, the voice worker asks the model to invoke three functions in sequence: interpret the reply, find source candidates, then choose a useful question or result. The server decides which records and values may be returned; the model does not invent them.

## Relationship to earlier work

This supplies the tool system missing from [00009](00009-address-recommendations.md). Preserve the minimal public UI, server records and existing LiveKit transcript events. [00012](00012-match-price-submit.md) later allows a unique exact match verified against the actual reply to show a price without an extra confirmation; uncertain matches still need confirmation.

## Required outcome

- **AC-01:** Register `apply_address_reply`, `find_address_candidates` and `choose_clarification` as actual LiveKit Agents function tools, and execute them through model function calls. Emit start/completion/error events carrying the interaction ID and safe metadata.
- **AC-02:** Constrain model interpretation using the actual transcript, source records and deterministic confirmation rules. Handle reordered/grouped numbers, self-correction, similar-sounding streets, partial numbers, numbered choices, rejection and unknown details. Preserve established constraints and rejected candidates; never fabricate properties, values or confirmations.
- **AC-03:** Ask one useful, answerable question at a time. Prefer simpler distinguishing details over ZIP when useful, ask for another detail after “I don't know,” and require explicit confirmation for uncertain matches.
- **AC-04:** Share conversation state between submitted typed and voice turns. Keep typing previews silent and read-only. Reject calls with the wrong participant, obsolete interaction ID or incorrect phase order, and prevent delayed results/speech from replacing newer work.
- **AC-05:** Keep source data behind authenticated, same-origin server APIs. Relay the worker's narrow tool requests through the signed-in browser without sending browser cookies or secrets to the worker. Keep conversation state temporary and do not persist transcript logs.
- **AC-06:** Verify actual LiveKit model function-call support, tool schemas/order, server safety checks, browser remote-call transport, unclear-speech examples and the source-backed Mint flow. Deploy through the existing Site and authorized voice-worker slot, and disclose device-verification limits.

## Technical context and boundaries

The three phases are `apply_address_reply` (interpret without inventing confirmation), `find_address_candidates` (retrieve possible source records) and `choose_clarification` (return the next question or verified result). Only trusted tool output is spoken; a free-form model valuation is prohibited.

A “broker” is the browser component that relays a worker request to the authenticated web API. “RPC” means a remote procedure call between browser and worker. A “turn” is one user interaction; its ID prevents obsolete asynchronous work from being accepted.

Use existing LiveKit Inference project credentials, without adding a separate model-provider key/setup. Bound model/tool waiting and cancellation, and fail visibly rather than silently replacing the required tools with direct lookup.

## How to verify

Check real model tool invocation and argument schemas, ordered calls and failure events; exercise unclear/rejected/unknown replies; test authentication and value redaction; simulate wrong participant, wrong order and cancelled turns; verify source-backed Mint clarification. Report simulated browser/model checks separately from live model and real phone audio observations.
