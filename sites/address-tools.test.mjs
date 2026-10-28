/**
 * Isolated synthetic regression scenarios; these do not establish live audio or production
 * source accuracy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { addressTools, canonicalAddressReply } from './address-tools.mjs';
import { makeBroker, syntheticSource } from './tool-fixture.mjs';
const ORDER = ['apply_address_reply', 'find_address_candidates', 'choose_clarification'];
/**
 * Run and commit all three real broker phases for one synthetic turn, returning the final
 * response.
 */
async function runAddressToolTurn(createSyntheticBroker, turnId, utterance, toolArguments = {}) {
  let output;
  for (const tool of ORDER)
    output = await createSyntheticBroker.invoke({
      tool,
      turn: turnId,
      utterance,
      arguments: toolArguments,
    });
  createSyntheticBroker.commit(turnId);
  return output;
}
// Verify three-phase tools handle partial speech without leaking unconfirmed valuations.
test('three-phase tools handle partial speech without leaking unconfirmed valuations', async () => {
  const toolSession = makeBroker();
  await toolSession.invoke({
    tool: ORDER[0],
    turn: 1,
    utterance: 'Mint thirty two',
    arguments: {
      intent: 'address',
    },
  });
  const found = await toolSession.invoke({
    tool: ORDER[1],
    turn: 1,
  });
  assert.ok(found.candidates.length);
  assert.ok(found.result.matches.every((propertyRecord) => propertyRecord.values === undefined));
  const answer = await toolSession.invoke({
    tool: ORDER[2],
    turn: 1,
    arguments: {
      preferred_detail: 'auto',
    },
  });
  assert.equal(answer.result.kind, 'choose');
  assert.match(answer.speech, /Fixture/);
  assert.equal(answer.result.field, 'city');
  toolSession.commit(1);
});
// Verify model cannot invent yes; withdrawal and unknown replies preserve safety.
test('model cannot invent yes; withdrawal and unknown replies preserve safety', async () => {
  const toolSession = makeBroker();
  const first = await runAddressToolTurn(toolSession, 1, '50 Smyth Avenue Fixture City 00000');
  assert.equal(first.result.field, 'confirm');
  assert.equal(first.result.matches[0].values, undefined);
  const unknown = await runAddressToolTurn(toolSession, 2, "I don't know");
  assert.ok(unknown.context.unknown_fields.includes('confirm'));
  assert.notEqual(unknown.result.kind, 'confirmed');
  const reply = await runAddressToolTurn(toolSession, 3, 'yeah no, the other one', {
    intent: 'confirm',
  });
  assert.notEqual(reply.result.kind, 'confirmed');
  assert.ok(reply.result.matches.every((propertyRecord) => propertyRecord.values === undefined));
});
// Verify explicit confirmation permits source-backed valuation and keeps context.
test('explicit confirmation permits source-backed valuation and keeps context', async () => {
  const toolSession = makeBroker();
  await runAddressToolTurn(toolSession, 1, '50 Smyth Avenue Fixture City 00000');
  const yes = await runAddressToolTurn(toolSession, 2, 'yes', {
    intent: 'confirm',
  });
  assert.equal(yes.result.kind, 'confirmed');
  assert.equal(yes.result.matches[0].values[0], 300);
});
// Verify canonical repairs preserve house numbers and spoken number groups.
test('canonical repairs preserve house numbers and spoken number groups', () => {
  assert.equal(canonicalAddressReply('32 Main no Mint'), '32 Mint');
  assert.equal(canonicalAddressReply('Mint thirty two twenty'), '3220 Mint');
  assert.equal(canonicalAddressReply('no, thirty two, not twenty three'), 'the house number is 32');
});
// Verify broker enforces phase order and drops cancelled/old turns.
test('broker enforces phase order and drops cancelled/old turns', async () => {
  const toolSession = makeBroker();
  await assert.rejects(
    toolSession.invoke({
      tool: ORDER[1],
      turn: 1,
    }),
    /out of order/,
  );
  await toolSession.invoke({
    tool: ORDER[0],
    turn: 1,
    utterance: 'Mint 32',
  });
  toolSession.cancel();
  await assert.rejects(
    toolSession.invoke({
      tool: ORDER[1],
      turn: 1,
    }),
    /out of order/,
  );
  assert.deepEqual(toolSession.history, []);
  await runAddressToolTurn(toolSession, 2, '50 Smith Avenue Fixture City 00000');
  await assert.rejects(
    toolSession.invoke({
      tool: ORDER[0],
      turn: 1,
      utterance: 'yes',
    }),
    /Stale/,
  );
});
// Verify tool API requires authenticated same-origin requests.
test('tool API requires authenticated same-origin requests', async () => {
  const body = JSON.stringify({
    tool: ORDER[0],
    turn: 1,
    history: [],
    utterance: 'Mint 32',
  });
  assert.equal(
    (
      await addressTools(
        new Request('https://synthetic.example/api/address/tools', {
          method: 'POST',
          body,
        }),
        {},
        syntheticSource,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await addressTools(
        new Request('https://synthetic.example/api/address/tools', {
          method: 'POST',
          headers: {
            Origin: 'https://evil.example',
            'oai-authenticated-user-id': 'synthetic-user',
          },
          body,
        }),
        {},
        syntheticSource,
      )
    ).status,
    403,
  );
});
// Verify phonetic spelling and fragmented numbers remain confirmation-only.
test('phonetic spelling and fragmented numbers remain confirmation-only', async () => {
  const toolSession = makeBroker();
  const addressResult = await runAddressToolTurn(toolSession, 1, '50 Smyth Avenue');
  assert.equal(addressResult.result.kind, 'choose');
  assert.ok(addressResult.result.matches.length > 0);
  assert.ok(
    addressResult.result.matches.every((propertyRecord) => propertyRecord.values === undefined),
  );
  assert.equal(canonicalAddressReply('Mint thirty-two twenty'), '3220 Mint');
  assert.equal(canonicalAddressReply("32 Main no it's Mint, not Main"), '32 Mint');
});
// Verify a rejected candidate is not re-offered after an uncertain reply.
test('a rejected candidate is not re-offered after an uncertain reply', async () => {
  const toolSession = makeBroker();
  const first = await runAddressToolTurn(toolSession, 1, '50 Smith Avenue Fixture City 00000');
  const turnId = first.result.matches[0].id;
  await runAddressToolTurn(toolSession, 2, 'no');
  const again = await runAddressToolTurn(toolSession, 3, "I don't know");
  assert.ok(again.context.rejected_ids.includes(turnId));
  assert.ok(again.result.matches.every((propertyRecord) => propertyRecord.id !== turnId));
});
// Verify cancelled in-flight tool response cannot overwrite conversation state.
test('cancelled in-flight tool response cannot overwrite conversation state', async () => {
  let release;
  const response = new Promise((resolve) => {
    release = resolve;
  });
  const { AddressToolSession } = await import('../dist/address-tools.mjs');
  const toolSession = new AddressToolSession({
    request: () => response,
  });
  const pending = toolSession.invoke({
    tool: 'apply_address_reply',
    turn: 1,
    utterance: 'Mint 32',
  });
  toolSession.cancel();
  release(
    new Response(
      JSON.stringify({
        tool: 'apply_address_reply',
        turn: 1,
        history: ['Mint 32'],
        context: {},
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ),
  );
  await assert.rejects(pending, /Stale/);
  assert.deepEqual(toolSession.history, []);
});
// Verify semantic tool hints remain unconfirmed and cannot replace a detail with a new address.
test('semantic tool hints remain unconfirmed and cannot replace a detail with a new address', async () => {
  const toolSession = makeBroker();
  const first = await runAddressToolTurn(toolSession, 1, '50 Smith Avenue');
  assert.equal(first.result.field, 'city');
  const result = await runAddressToolTurn(toolSession, 2, 'the first city, Fixture City', {
    intent: 'address',
    normalized_hint: 'Fixture City',
    detail: 'city',
  });
  assert.equal(result.result.field, 'confirm');
  assert.equal(result.result.matches[0].values, undefined);
  const notYes = await runAddressToolTurn(toolSession, 3, 'maybe', {
    intent: 'confirm',
    normalized_hint: 'yes',
  });
  assert.notEqual(notYes.result.kind, 'confirmed');
});
// Verify model ordinal hint cannot manufacture confirmation for an uncertain actual reply.
test('model ordinal hint cannot manufacture confirmation for an uncertain actual reply', async () => {
  const toolSession = makeBroker();
  await runAddressToolTurn(toolSession, 1, '50 Smyth Avenue Fixture City 00000');
  const addressResult = await runAddressToolTurn(toolSession, 2, 'maybe', {
    intent: 'address',
    normalized_hint: 'the first',
  });
  assert.notEqual(addressResult.result.kind, 'confirmed');
  assert.equal(addressResult.result.matches[0]?.values, undefined);
});
