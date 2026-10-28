/**
 * Isolated synthetic regression scenarios; these do not establish live audio or production
 * source accuracy.
 */
// Synthetic DOM/voice doubles only. No microphone, company file or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountApp } from '../dist/app.mjs';
import { addressTools } from './address-tools.mjs';
import { properties } from './properties.mjs';
import { syntheticSource } from './tool-fixture.mjs';
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
/**
 * Minimal DOM double retains properties and children for controller assertions; it does not
 * render or implement browser layout.
 */
class Element {
  /** Initialize a node with mutable text, hidden state, children and data attributes. */
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.hidden = true;
    this.value = '';
    this.textContent = '';
  }
  /** Append child doubles or replaceChildren with a new subtree; neither method parses HTML. */
  append(...children) {
    this.children.push(...children);
  }
  replaceChildren(...children) {
    this.children = children;
  }
  /** Capture attributes as properties; querySelector returns a stable label-child double. */
  setAttribute(attributeName, attributeValue) {
    this[attributeName] = attributeValue;
  }
  querySelector() {
    return (this.span ??= new Element());
  }
}
/**
 * Install a fresh DOM and fetch adapter backed by synthetic source APIs. Inject voice methods
 * that record calls and emit lifecycle callbacks; toolTurn executes actual broker phases and
 * commits via controller delivery.
 */
function createTestHarness({ signedIn = true, connected = false, mount = true } = {}) {
  /** Resolve only IDs present in the actual page so missing required HTML nodes fail the test. */
  const nodes = new Map();
  const getElementById = (turnId) => {
    if (!ids.has(turnId)) return null;
    if (!nodes.has(turnId)) nodes.set(turnId, new Element());
    return nodes.get(turnId);
  };
  globalThis.document = {
    getElementById: getElementById,
    createElement: (tag) => new Element(tag),
  };
  globalThis.window = {
    addEventListener() {},
  };
  const requests = [];
  /**
   * Route search/tool HTTP requests to actual handlers with synthetic identity and source; never
   * use the network.
   */
  globalThis.fetch = async (path, requestOptions) => {
    requests.push({
      path,
      body: requestOptions?.body && JSON.parse(requestOptions.body),
    });
    if (path === '/api/address/tools' || path === '/api/search') {
      if (path === '/api/search' && !connected)
        return {
          ok: false,
        };
      const request = new Request('https://synthetic.example' + path, {
        ...requestOptions,
        headers: {
          ...requestOptions.headers,
          Origin: 'https://synthetic.example',
          'oai-authenticated-user-id': 'synthetic-user',
        },
      });
      return (path === '/api/address/tools' ? addressTools : properties)(
        request,
        {},
        syntheticSource,
      );
    }
    return {
      ok: path === '/api/me' || connected,
      json: async () =>
        path === '/api/me'
          ? {
              signedIn,
            }
          : connected
            ? {
                stats: {
                  searchable: 1,
                },
              }
            : {
                error: 'No records connected.',
              },
    };
  };
  let options,
    listens = 0,
    finishes = 0,
    stops = 0,
    spoken = [],
    resolved = [];
  /**
   * Voice double records stop/listen/finish/resolve/speak; disconnect is inert. Callbacks
   * exercise actual controller state.
   */
  if (mount)
    mountApp({
      voiceFactory: (voiceCallbacks) => {
        options = voiceCallbacks;
        return {
          stop() {
            stops++;
            voiceCallbacks.onCancel();
          },
          listen() {
            listens++;
            voiceCallbacks.onState('listening');
          },
          finish() {
            finishes++;
            voiceCallbacks.onState('processing');
          },
          resolve(text) {
            resolved.push(text);
            voiceCallbacks.onCancel();
            voiceCallbacks.onState('processing');
          },
          speak(text) {
            spoken.push(text);
            voiceCallbacks.onState('speaking');
          },
          disconnect() {},
        };
      },
    });
  return {
    get: getElementById,
    requests,
    spoken,
    resolved,
    async toolTurn(runAddressToolTurn, text) {
      let result;
      for (const tool of ['apply_address_reply', 'find_address_candidates', 'choose_clarification'])
        result = await options.onToolCall({
          tool,
          turn: runAddressToolTurn,
          utterance: text,
          arguments: {
            preferred_detail: 'auto',
          },
        });
      options.onAddressResult(result, runAddressToolTurn);
      spoken.push(result.speech);
      options.onState('speaking');
      return result;
    },
    get options() {
      return options;
    },
    get listens() {
      return listens;
    },
    get finishes() {
      return finishes;
    },
    get stops() {
      return stops;
    },
  };
}
// Verify minimal page contains a text input, Enter submit and Speak control.
test('minimal page contains a text input, Enter submit and Speak control', () => {
  assert.equal([...html.matchAll(/<button\b/g)].length, 2);
  assert.equal([...html.matchAll(/<input\b/g)].length, 1);
  assert.match(html, /id="address"[^>]*type="text"/);
  assert.doesNotMatch(html, /Import CSV|<header|<footer|<aside|orb-wrap|data-strip|speak-toggle/);
});
// Verify LiveKit capture preserves interim/final text events without records.
test('LiveKit capture preserves interim/final text events without records', async () => {
  const testHarness = createTestHarness();
  await new Promise(setImmediate);
  testHarness.get('talk').onclick();
  assert.equal(testHarness.listens, 1);
  assert.equal(testHarness.get('app').dataset.state, 'listening');
  assert.equal(testHarness.get('talk-label').textContent, 'Finish');
  testHarness.options.onTranscript('123 Synthetic', false);
  assert.equal(testHarness.get('transcript').hidden, false);
  assert.equal(testHarness.get('transcript').textContent, 'You said: “123 Synthetic”');
  testHarness.get('talk').onclick();
  assert.equal(testHarness.finishes, 1);
  testHarness.options.onTranscript('123 Synthetic Example Street', true);
  assert.equal(testHarness.get('address').value, '123 Synthetic Example Street');
  assert.equal(testHarness.get('talk-label').textContent, 'Stop');
  assert.equal(
    testHarness.requests.some((propertyRecord) => propertyRecord.path === '/api/search'),
    false,
    'worker runs tools after final transcription',
  );
  await new Promise(setImmediate);
  testHarness.options.onError(
    'Microphone access was blocked. Allow microphone access in site settings.',
  );
  assert.match(testHarness.get('status').textContent, /blocked.*site settings/);
  testHarness.get('talk').onclick();
  assert.equal(testHarness.listens, 2);
});
// Verify same button cancels connection or playback; sign-in errors remain recoverable.
test('same button cancels connection or playback; sign-in errors remain recoverable', async () => {
  const testHarness = createTestHarness({
    signedIn: false,
  });
  await new Promise(setImmediate);
  testHarness.options.onState('connecting');
  assert.equal(testHarness.get('talk-label').textContent, 'Stop');
  testHarness.get('talk').onclick();
  assert.equal(testHarness.stops, 1);
  testHarness.options.onError('Sign in to use voice.');
  assert.equal(testHarness.get('sign-in').hidden, false);
  assert.match(testHarness.get('status').textContent, /Sign in/);
  testHarness.get('talk').onclick();
  assert.equal(testHarness.listens, 1);
});
// Verify Enter invokes LiveKit resolve and a unique exact match displays its price.
test('Enter invokes LiveKit resolve and a unique exact match displays its price', async () => {
  const testHarness = createTestHarness({
    connected: true,
  });
  testHarness.get('address').value = '50 Smith Avenue Fixture City 00000';
  testHarness.get('search-form').onsubmit({
    preventDefault() {},
  });
  assert.equal(testHarness.resolved[0], '50 Smith Avenue Fixture City 00000');
  await testHarness.toolTurn(1, testHarness.resolved[0]);
  assert.match(testHarness.get('result').textContent, /50 Smith Avenue/);
  assert.match(testHarness.get('price').textContent, /\$300/);
  testHarness.get('address').value = 'yes';
  testHarness.get('search-form').onsubmit({
    preventDefault() {},
  });
  await testHarness.toolTurn(2, 'yes');
  assert.match(testHarness.get('price').textContent, /\$300/);
  assert.match(testHarness.spoken.at(-1), /valuation/);
});
// Verify published HTML entrypoint mounts the real controller and installs click handlers.
test('published HTML entrypoint mounts the real controller and installs click handlers', async () => {
  const testHarness = createTestHarness({
    mount: false,
  });
  const { default: worker } = await import('../sites-artifact/dist/server/index.js');
  const published = await (
    await worker.fetch(new Request('https://synthetic.example/'), {})
  ).text();
  const entry = published.match(/<script type="module" src="([^\"]+)"/)[1];
  await import('../dist/' + entry);
  await new Promise(setImmediate);
  assert.equal(typeof testHarness.get('talk').onclick, 'function');
  assert.equal(testHarness.get('talk').disabled, false);
  assert.equal(testHarness.get('submit').disabled, false);
  assert.equal(typeof testHarness.get('search-form').onsubmit, 'function');
  assert.equal(
    testHarness.requests.length,
    0,
    'startup does not gate voice or recommendations on metadata',
  );
});

// Verify typing previews recommendations without speech and keeps context for a choice.
test('typing previews recommendations without speech and keeps context for a choice', async () => {
  const testHarness = createTestHarness({
    connected: true,
  });
  testHarness.get('address').value = 'Mint 32';
  testHarness.get('address').oninput();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(testHarness.get('choices-panel').hidden, false);
  assert.equal(testHarness.get('choices').children.length, 2);
  assert.equal(testHarness.get('price').hidden, true);
  assert.equal(testHarness.spoken.length, 0);
  testHarness.get('address').value = 'option 1';
  testHarness.get('search-form').onsubmit({
    preventDefault() {},
  });
  await new Promise(setImmediate);
  assert.equal(testHarness.resolved.at(-1), 'option 1');
  await testHarness.toolTurn(1, 'option 1');
  const applied = testHarness.requests.find(
    (propertyRecord) => propertyRecord.body?.tool === 'apply_address_reply',
  );
  assert.deepEqual(applied.body.history, ['Mint 32']);
});

// Verify query changes clear the price and zero-valued matches remain visible.
test('query changes clear the price and zero-valued matches remain visible', async () => {
  const testHarness = createTestHarness();
  await testHarness.toolTurn(1, '70 Zero Way Fixture City 00000');
  assert.equal(testHarness.get('price').hidden, false);
  assert.match(testHarness.get('price').textContent, /\$0/);
  testHarness.get('address').value = 'Mint';
  testHarness.get('address').oninput();
  assert.equal(testHarness.get('price').hidden, true);
  testHarness.get('address').value = '';
  testHarness.get('address').oninput();
});
// Verify conflicting source prices are shown as a conflict without a chosen headline price.
test('conflicting source prices are shown as a conflict without a chosen headline price', async () => {
  const testHarness = createTestHarness();
  await testHarness.toolTurn(1, '80 Conflict Road Fixture City 00000');
  assert.equal(testHarness.get('price').hidden, true);
  assert.match(testHarness.get('result').textContent, /Conflicting valuations.*\$100.*\$200/);
});

/** Recursively collect literal subtree text for card-content assertions. */
const collectElementText = (node) =>
  [node.textContent, ...node.children.map(collectElementText)].join(' ');
/**
 * Drive input and wait beyond its 250 ms debounce; return the currently rendered synthetic
 * cards.
 */
const previewChoices = async (testHarness, value = 'Mint 32') => {
  testHarness.get('address').value = value;
  testHarness.get('address').oninput();
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [...testHarness.get('choices').children];
};
// Verify 00013: address cards select through LiveKit tools and switch prices without another submit.
test('00013: address cards select through LiveKit tools and switch prices without another submit', async () => {
  const testHarness = createTestHarness({
      connected: true,
    }),
    cards = await previewChoices(testHarness);
  assert.equal(cards.length, 2);
  assert.match(testHarness.get('choices-hint').textContent, /ZIP code.*\nSelect an address/);
  assert.equal(cards[0].tagName, 'BUTTON');
  assert.equal(cards[0].type, 'button');
  assert.match(collectElementText(cards[0]), /3220 Mint Drive.*Fixture City.*00000.*View price/);
  assert.match(cards[0]['aria-label'], /Option 1.*3220 Mint Drive.*Show price/);
  assert.equal(testHarness.get('price').hidden, true);
  assert.equal(testHarness.resolved.length, 0);
  cards[0].onclick();
  assert.deepEqual(testHarness.resolved, ['option 1']);
  assert.equal(cards[0].dataset.loading, 'true');
  assert.equal(testHarness.get('choices')['aria-busy'], 'true');
  await testHarness.toolTurn(1, testHarness.resolved.at(-1));
  assert.equal(testHarness.get('price').textContent, '$100');
  assert.equal(testHarness.get('price').hidden, false);
  assert.equal(cards[0]['aria-pressed'], 'true');
  assert.equal(cards[0].dataset.loading, 'false');
  assert.match(collectElementText(cards[0]), /Selected/);
  assert.equal(testHarness.get('answer').dataset.matched, 'true');
  assert.match(testHarness.get('result').textContent, /3220 Mint Drive/);
  cards[1].onclick();
  assert.equal(testHarness.resolved.at(-1), 'option 2');
  assert.equal(testHarness.get('price').hidden, true);
  await testHarness.toolTurn(2, testHarness.resolved.at(-1));
  assert.equal(testHarness.get('price').textContent, '$200');
  assert.match(testHarness.get('result').textContent, /3221 Mint Drive/);
  assert.equal(cards[0]['aria-pressed'], 'false');
  assert.equal(cards[1]['aria-pressed'], 'true');
  const starts = testHarness.requests.filter(
    (propertyRecord) => propertyRecord.body?.tool === 'apply_address_reply',
  );
  assert.deepEqual(
    starts.map((propertyRecord) => propertyRecord.body.history),
    [['Mint 32'], ['Mint 32']],
  );
});
// Verify 00013: removed cards and cancelled tool results cannot price a newer query.
test('00013: removed cards and cancelled tool results cannot price a newer query', async () => {
  const testHarness = createTestHarness({
      connected: true,
    }),
    cards = await previewChoices(testHarness);
  cards[0].onclick();
  await testHarness.options.onToolCall({
    tool: 'apply_address_reply',
    turn: 1,
    utterance: 'option 1',
    arguments: {},
  });
  await testHarness.options.onToolCall({
    tool: 'find_address_candidates',
    turn: 1,
    utterance: 'option 1',
    arguments: {},
  });
  const oldResult = await testHarness.options.onToolCall({
    tool: 'choose_clarification',
    turn: 1,
    utterance: 'option 1',
    arguments: {},
  });
  testHarness.get('address').value = '';
  testHarness.get('address').oninput();
  assert.equal(testHarness.get('choices-panel').hidden, true);
  cards[1].onclick();
  assert.equal(testHarness.resolved.length, 1);
  assert.equal(testHarness.options.onAddressResult(oldResult, 1), false);
  assert.equal(testHarness.get('price').hidden, true);
  assert.equal(testHarness.get('answer').hidden, true);
});
// Verify 00013: a failed selection is retryable and source conflicts never get a headline price.
test('00013: a failed selection is retryable and source conflicts never get a headline price', async () => {
  const testHarness = createTestHarness({
      connected: true,
    }),
    cards = await previewChoices(testHarness);
  cards[0].onclick();
  testHarness.options.onError('Address tools timed out. Please try again.');
  assert.equal(cards[0].dataset.loading, 'false');
  assert.match(testHarness.get('status').textContent, /try again/);
  cards[0].onclick();
  await testHarness.toolTurn(2, testHarness.resolved.at(-1));
  assert.equal(testHarness.get('price').textContent, '$100');
  const conflict = await previewChoices(testHarness, '80 Conflict');
  conflict[0].onclick();
  await testHarness.toolTurn(3, testHarness.resolved.at(-1));
  assert.equal(testHarness.get('price').hidden, true);
  assert.match(testHarness.get('result').textContent, /Conflicting valuations.*\$100.*\$200/);
});
