# Finvoice

Public minimal interface: one text field, one Speak/Finish/Stop button and LiveKit text output. Signed-in visitors automatically use the original company export on the server. Visitors never upload a CSV. Enter submits typed lookup; microphone transcripts use the same server lookup.

The original CSV lives at ignored `private-data/properties.csv` during builds. Its identity is pinned by `.openai/property-source.json`; missing or mismatched input fails the build. Never commit the CSV or generated deployment artifact. `npm run build` validates and indexes it into compressed house-number groups embedded only in the server Worker. The browser receives relevant matches, never the CSV or complete index. A small bounded group cache avoids loading the full dataset into a 128 MB Worker. Existing D1 tables remain intact but are no longer the source of visitor data; obsolete upload routes are disabled.

Run `npm run build` and `npm test`. Fixtures are isolated test doubles, never production records. The real source is an owner-provided company export and has not been independently verified. Updates require replacing the deployment's server input and its reviewed fingerprint, not a visitor upload.

LiveKit uses the bundled browser SDK, authenticated session API and a separate cloud worker. Runtime secrets: LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET. Agent CA_azDo7whJaK6Q registers as finvoice; LIVEKIT_AGENT_NAME can override token dispatch if that changes. Code and Dockerfile are under livekit-agent/. No browser speech fallback. Real microphone/device behavior requires live validation.

Typing shows up to three address recommendations after a short pause. Street-first input and partial house numbers are supported; a longer house number remains a suggestion until explicitly confirmed. Reply by voice/text with yes, an ordinal choice or a clarifying ZIP/city. The LiveKit worker currently provides speech RPC controls; deterministic address resolution runs on the server. Earlier proposed agent-tool definitions were not present in the recovered source.

## LiveKit disambiguation tool calls

Committed typed or final voice turns now run through actual LiveKit Agents `@llm.function_tool` calls in `livekit-agent/address_agent.py`, using LiveKit Inference `openai/gpt-4.1-mini` with existing project credentials. The model must invoke `apply_address_reply`, `find_address_candidates`, then `choose_clarification`. No browser-only substitute or free-form model valuation is used. Each call emits turn-scoped start/completion/error events.

The worker calls the authenticated participant's narrow `finvoice.address_tool` RPC. Its browser broker invokes `/api/address/tools` with same-origin credentials, fixed tool names, locally owned history and the actual utterance. Cookies and API keys are never transferred to the worker. The server recomputes candidates from the original CSV, withholds unconfirmed valuations and decides the question/result that will be spoken. The model can classify a reply and suggest a question field; it cannot manufacture confirmation or record values.

State stays in browser memory and the active worker room. Calls and results are checked for turn, participant and phase. Interruption cancels unfinished work; only a completed, current result commits state. Previews remain read-only and do not invoke the model. Unknown details select another question; rejected records remain excluded until reset. A question asks for one detail, preferring short choices/city over ZIP where useful. All uncertain and exact tool-path candidates require explicit confirmation.

Run Python checks with `python -m unittest discover -s livekit-agent -p 'test_*.py'`. The explicit manual `livekit-agent/probe_tools.py` uses the real LiveKit model but an isolated synthetic address source; it is excluded from routine tests. Real phone audio/RTC remains a separate live check. No raw utterance, model arguments or valuations are printed to application logs.

## Repository and checks

This GitHub repository includes the deployed cloud implementation and the portable workflow kernel (`AGENTS.md`, `WORKFLOW.md`, `REPORTING.md`, `KERNEL.MD`). Active cloud checks live under `sites/` and `livekit-agent/`; use the commands above. The original `tests/` browser-speech checks, `server.py` and bootstrap results describe the earlier local prototype and are retained as historical source. They do not validate the current LiveKit UI. Deployment provenance is in `results/0010-plan.md` and GitHub synchronization evidence in `results/00011-github-sync/`.
