# LiveKit model-invoked address tools

User approves the three-tool design and explicitly requires LiveKit tool calls. Implement actual LiveKit Agents function tools invoked through model function calls in the voice worker; browser-only search wrappers are insufficient. Preserve minimal public UI, source-backed server records and existing LiveKit transcript events.

AC-01: Worker registers find_address_candidates, choose_clarification and apply_address_reply using LiveKit function_tool. Model tool calls execute those implementations; emit start/completion/error tool events with turn IDs and safe metadata.
AC-02: Raw transcript, source records and deterministic confirmation rules constrain model interpretations. Handle reordered/grouped numbers, self-correction, phonetic streets, partial numbers, ordinal replies, rejection and unknown details. Preserve established constraints and rejected candidates. Never fabricate properties, values or confirmations.
AC-03: Ask one useful, answerable question at a time, prefer simpler discriminators over ZIP, offer a different detail after unknown replies, and require explicit confirmation for uncertain matches.
AC-04: Committed voice and typed turns share tool state; typing previews remain read-only and silent. Reject stale, out-of-order and wrong-participant tool calls and prevent delayed speech/results from replacing newer turns.
AC-05: Source data stays server-only behind authenticated same-origin API. Tool calls use the authenticated browser as a narrow RPC broker, never transmit its cookies/secrets to the worker. Conversation state is ephemeral; no persistent transcript log.
AC-06: Verify actual LiveKit inference function-call support, schemas, orchestration, tool/server safety, browser RPC transport, unclear-speech examples and source-backed Mint flow. Deploy the existing Site and existing authorized worker slot; disclose device verification limits.

Approach: constrained three-phase model function calls per turn; server validates and resolves each phase, and only trusted tool output is spoken. No free-form model valuation. Existing LiveKit Inference credentials fund the model through the configured project, without a separate API key/provider setup. Bound model/tool timeouts and cancellation; fail visibly instead of silently replacing tools with direct lookup.
