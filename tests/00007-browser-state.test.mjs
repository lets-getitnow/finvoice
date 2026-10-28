// Synthetic UI and browser speech doubles. No real audio or company data is used.
import test from 'node:test';
import assert from 'node:assert/strict';
/**
 * Minimal DOM double: retain text/children and control state; no layout, HTML parsing or real
 * event bubbling.
 */
class Element {
  /** Initialize mutable fields used by app.mjs; each element owns its own children. */
  constructor() {
    this.children = [];
    this.dataset = {};
    this.textContent = '';
    this.hidden = false;
    this.value = '';
    this.checked = true;
    this.disabled = false;
    this.files = [];
  }
  /** Append text/node doubles in order. */
  append(...items) {
    this.children.push(...items);
  }
  /** Replace the rendered subtree without emulating browser layout. */
  replaceChildren(...items) {
    this.children = items;
  }
  /** Expose attributes as properties for assertions. */
  setAttribute(key, value) {
    this[key] = value;
  }
  /** Return one stable child span, sufficient for the talk-button label. */
  querySelector() {
    this.span ??= new Element();
    return this.span;
  }
  /** Record requested focus without a real browser focus manager. */
  focus() {
    this.focused = true;
  }
  /** Dispatch the installed click handler synchronously if present. */
  click() {
    this.onclick?.();
  }
}
// Stable ID registry lets assertions inspect the same doubles the application changes.
const elements = new Map();
const getElementById = (turnId) => {
  if (!elements.has(turnId)) elements.set(turnId, new Element());
  return elements.get(turnId);
};
globalThis.document = {
  getElementById: getElementById,
  querySelector: () => getElementById('panel'),
  createElement: () => new Element(),
  createElementNS: () => new Element(),
  createTextNode: (value) => ({
    textContent: value,
  }),
};
let activeRecognition, utterance;
/** Deterministic speech double; tests manually deliver transcripts and error events. */
class SyntheticRecognition {
  /** Capture the latest instance so tests can inject events. */
  constructor() {
    activeRecognition = this;
  }
  /** Deliver the start event immediately, without microphone access. */
  start() {
    this.onstart?.();
  }
  /** Finish synchronously without manufacturing a transcript. */
  stop() {
    this.onend?.();
  }
  /** Emit end even on abort to exercise application callback invalidation. */
  abort() {
    this.onend?.();
  }
}
// Synthesis records the last utterance; cancel is inert and tests trigger completion explicitly.
const synthesis = {
  cancel() {},
  speak(spokenUtterance) {
    utterance = spokenUtterance;
  },
};
// Utterance constructor captures speech text; lifecycle/listener stubs perform no browser I/O.
globalThis.window = {
  SpeechRecognition: SyntheticRecognition,
  SpeechSynthesisUtterance: class {
    constructor(text) {
      this.text = text;
    }
  },
  speechSynthesis: synthesis,
  addEventListener() {},
};
globalThis.SpeechSynthesisUtterance = window.SpeechSynthesisUtterance;
globalThis.speechSynthesis = synthesis;
globalThis.location = {
  hostname: 'example.test',
};
const csv =
  'street,city,state,postal_code,property_value\n100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,123456\n';
// Fetch returns only the isolated CSV and tracks requests; no network is used.
let fetches = [];
globalThis.fetch = async (requestUrl) => {
  fetches.push(requestUrl);
  return {
    ok: true,
    text: async () => csv,
  };
};
await import('../dist/app.mjs');
// Drain startup promise work before inspecting the published-load UI.
await new Promise(setImmediate);
/** Drive the real file-change handler with an in-memory synthetic file and await completion. */
async function importFile(csvText) {
  getElementById('file').files = [
    {
      name: 'synthetic-example.csv',
      size: csvText.length,
      text: async () => csvText,
    },
  ];
  await getElementById('file').onchange({
    target: getElementById('file'),
  });
}
/**
 * Collect literal subtree text recursively; this cannot prove actual DOM markup safety or
 * layout.
 */
const collectElementText = (element) =>
  [
    element.textContent,
    ...element.children.map((childElement) =>
      typeof childElement === 'string' ? childElement : collectElementText(childElement),
    ),
  ].join(' ');
// Verify fresh hosted visit loads published data without import.
test('00011 synthetic UI: fresh hosted visit loads published data without import', () => {
  assert.deepEqual(fetches, ['./data/properties.csv']);
  assert.equal(getElementById('record-count').textContent, '1');
  assert.equal(getElementById('source-name').textContent, 'Published Texas property export');
  assert.equal(getElementById('retry-data').hidden, true);
  getElementById('speak-toggle').checked = false;
  getElementById('address').value = '100 Example Street';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /\$123,456/);
  getElementById('speak-toggle').checked = true;
});
// Verify import, exact lookup and spoken response lifecycle.
test('00007 synthetic UI: import, exact lookup and spoken response lifecycle', async () => {
  await importFile(csv);
  assert.equal(getElementById('record-count').textContent, '1');
  getElementById('address').value = '100 Example Street';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /\$123,456/);
  assert.match(utterance.text, /100 EXAMPLE ST.*\$123,456/);
  assert.equal(getElementById('panel').dataset.state, 'speaking');
  utterance.onend();
  assert.equal(getElementById('panel').dataset.state, 'ready');
});
// Verify speech transcript routes through the same actual lookup.
test('00007 synthetic UI: speech transcript routes through the same actual lookup', () => {
  getElementById('talk').onclick();
  assert.equal(getElementById('panel').dataset.state, 'listening');
  const result = [
    {
      transcript: 'What is the valuation of one hundred Example Street?',
    },
  ];
  result.isFinal = true;
  activeRecognition.onresult({
    results: [result],
  });
  assert.match(collectElementText(getElementById('result-area')), /\$123,456/);
  assert.match(getElementById('transcript').textContent, /one hundred/);
  assert.equal(getElementById('panel').dataset.state, 'speaking');
  getElementById('stop-audio').onclick();
  assert.equal(getElementById('panel').dataset.state, 'ready');
});
// Verify permission denial, retry, no-result and typed recovery.
test('00007 synthetic UI: permission denial, retry, no-result and typed recovery', () => {
  getElementById('talk').onclick();
  activeRecognition.onerror({
    error: 'not-allowed',
  });
  activeRecognition.onend();
  assert.match(getElementById('voice-description').textContent, /blocked.*site settings/);
  getElementById('talk').onclick();
  assert.equal(getElementById('panel').dataset.state, 'listening');
  activeRecognition.onerror({
    error: 'no-speech',
  });
  activeRecognition.onend();
  assert.match(getElementById('voice-description').textContent, /didn’t hear/);
  getElementById('speak-toggle').checked = false;
  getElementById('address').value = '999 EXAMPLE ST';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /No matching address/);
  assert.equal(getElementById('address').value, '999 EXAMPLE ST');
  getElementById('address').value = '100 EXAMPLE ST';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /\$123,456/);
});
// Verify bad import preserves working data and source markup stays text.
test('00007 synthetic UI: bad import preserves working data and source markup stays text', async () => {
  await importFile('wrong,columns\n1,2');
  assert.match(getElementById('notice').textContent, /previous dataset is still connected/);
  getElementById('address').value = '100 EXAMPLE ST';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /\$123,456/);
  await importFile(
    'street,city,state,postal_code,property_value\n1 <script>example</script>,EXAMPLE CITY,Texas,00000,100',
  );
  getElementById('address').value = '1 <script>example</script>';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /<script>example<\/script>/);
});
// Verify conflicting import never speaks a chosen valuation.
test('00007 synthetic UI: conflicting import never speaks a chosen valuation', async () => {
  await importFile(csv + '100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,200000\n');
  getElementById('address').value = '100 EXAMPLE ST';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /conflicting valuations/);
  assert.doesNotMatch(
    collectElementText(getElementById('result-area')),
    /IMPORTED PROPERTY VALUATION/,
  );
});
// Verify fuzzy voice clarification, confirmation, reset and rejected-match correction.
test('00009 synthetic UI: fuzzy voice clarification, confirmation, reset and rejected-match correction', async () => {
  await importFile(
    'street,city,state,postal_code,property_value\n50 SMITH AVE,EXAMPLE CITY,TX,00000,400\n50 SMITH AVE,OTHER EXAMPLE,TX,00001,450\n',
  );
  getElementById('speak-toggle').checked = true;
  // Submit a clarification through the same form handler as typed user input.
  const submit = (value) => {
    getElementById('address').value = value;
    getElementById('search-form').onsubmit({
      preventDefault() {},
    });
  };
  submit('50 Smyth Avenue');
  assert.match(collectElementText(getElementById('result-area')), /ZIP code/);
  assert.doesNotMatch(collectElementText(getElementById('result-area')), /\$400/);
  getElementById('talk').onclick();
  const result = [
    {
      transcript: '00000',
    },
  ];
  result.isFinal = true;
  activeRecognition.onresult({
    results: [result],
  });
  assert.match(collectElementText(getElementById('result-area')), /Did you mean/);
  assert.match(getElementById('context-value').textContent, /50.*00000/);
  assert.doesNotMatch(utterance.text, /valuation/);
  submit('no');
  assert.doesNotMatch(collectElementText(getElementById('result-area')), /\$400/);
  submit('actually Smith Avenue');
  submit('yes');
  assert.match(collectElementText(getElementById('result-area')), /\$400/);
  getElementById('reset-search').onclick();
  assert.equal(getElementById('address').value, '');
  assert.equal(getElementById('search-context').hidden, true);
  submit('50 Smyth Avenue 99999');
  assert.match(collectElementText(getElementById('result-area')), /ZIP 99999/);
  submit('the ZIP is 00001');
  assert.match(collectElementText(getElementById('result-area')), /Did you mean/);
  submit('yes');
  assert.match(collectElementText(getElementById('result-area')), /\$450/);
});
// Verify failed published load offers retry and preserves input.
test('00011 synthetic UI: failed published load offers retry and preserves input', async () => {
  let attempts = 0;
  globalThis.fetch = async () =>
    ++attempts === 1
      ? {
          ok: false,
          status: 503,
        }
      : {
          ok: true,
          text: async () => csv,
        };
  await import('../dist/app.mjs?published-retry');
  await new Promise(setImmediate);
  assert.equal(getElementById('retry-data').hidden, false);
  assert.match(getElementById('notice').textContent, /couldn’t load.*Retry/i);
  getElementById('address').value = '100 Example Street';
  await getElementById('retry-data').onclick();
  assert.equal(attempts, 2);
  assert.equal(getElementById('retry-data').hidden, true);
  assert.equal(getElementById('address').value, '100 Example Street');
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /\$123,456/);
});
// Verify late published response cannot replace a newer imported dataset.
test('00011 synthetic UI: late published response cannot replace a newer imported dataset', async () => {
  let resolveFetch;
  globalThis.fetch = () =>
    new Promise((resolve) => {
      resolveFetch = resolve;
    });
  await import('../dist/app.mjs?published-race');
  await importFile(
    'street,city,state,postal_code,property_value\n200 OTHER EXAMPLE ST,EXAMPLE CITY,TX,00000,200\n',
  );
  getElementById('address').value = '200 Other Example Street';
  resolveFetch({
    ok: true,
    text: async () => csv,
  });
  await new Promise(setImmediate);
  assert.equal(getElementById('source-name').textContent, 'synthetic-example.csv');
  assert.equal(getElementById('source-note').textContent, 'Connected for this session');
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /\$200/);
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => csv,
  });
});
// Verify unsupported recognition keeps typed lookup available.
test('00007 synthetic UI: unsupported recognition keeps typed lookup available', async () => {
  window.SpeechRecognition = undefined;
  await import('../dist/app.mjs?unsupported-speech-test');
  await importFile(csv);
  getElementById('talk').onclick();
  assert.equal(getElementById('panel').dataset.state, 'unavailable');
  assert.match(getElementById('voice-description').textContent, /Try Chrome/);
  getElementById('address').value = '100 EXAMPLE ST';
  getElementById('search-form').onsubmit({
    preventDefault() {},
  });
  assert.match(collectElementText(getElementById('result-area')), /\$123,456/);
});
