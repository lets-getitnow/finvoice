# Finvoice

A browser voice assistant that looks up Texas property addresses and reads back valuations from a company export. Speak or type an address; the assistant retains details across clarification turns, normalizes address forms, asks for missing information and flags conflicting valuations.

## Run

Requires Python 3. No runtime package installation or model API key is needed.

```sh
python3 server.py --csv '/absolute/path/to/company-export.csv'
```

Open http://127.0.0.1:8787. Click **Start talking**, allow microphone access and say an address. You can type instead, reply to clarifying questions, stop audio or reset the search.

The company dataset is intentionally excluded from Git. Supply your authorized export using `--csv`, use **Import CSV** in the browser, or place it at ignored `dist/data/properties.csv` for the default startup path. Expected columns:

```text
street,city,state,postal_code,property_value
```

An omitted or unavailable file produces a visible loading error with retry/import recovery. No sample valuations are silently substituted. Browser imports are session-local and cleared on reload.

## What is included

- The complete portable workflow kernel: `KERNEL.MD` and its ten explicit dependencies.
- The property lookup frontend, speech controls, CSV parser, conversational address resolver and local server.
- Isolated synthetic engineering tests and this project's own bootstrap evidence.

This is a new Git history. Source repository analysis, simulations, vendor documentation, historical reports, cloud project identities, credentials, local environments and company records are not included.

## Voice, data and access

Voice uses browser speech recognition and synthesis; support varies by browser. Try Chrome if unavailable. Recognition may send audio to the browser's speech provider. No microphone recording or transcript history is persisted by this application. Tests simulate speech APIs and do not establish real microphone-to-speaker performance.

Use only exports you are authorized to access. Values reflect the source file, assume USD and are not independently verified. Missing source fields stay missing; no-street rows and invalid values are excluded, while conflicting values are flagged. The application's dataset and matches are available to its browser: this remains a trusted local prototype, without server-side user authentication or property authorization. A shared deployment needs those controls. The server binds to loopback only.

## Verify

Node.js is required only for the tests:

```sh
npm test
```

Tests use explicitly synthetic in-memory records, never the company's export. The local-only `/__qa/mobile` route previews the real UI at 390px width. Read [bootstrap verification](results/00001-bootstrap-finvoice/verification.md) for the copied source identities, actual checks and limitations.

Development rules begin with [AGENTS.md](AGENTS.md); [KERNEL.MD](KERNEL.MD) lists the portable dependency set.
