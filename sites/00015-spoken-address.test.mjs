// Explicitly synthetic fixtures, isolated from production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../dist/lookup.mjs';
import { AddressConversation } from '../dist/resolver.mjs';
import { canonicalAddressReply, addressTools } from './address-tools.mjs';
import { AddressToolSession } from '../dist/address-tools.mjs';
const syntheticPropertyRecords = parseCSV(
  'street,city,state,postal_code,property_value\n320 Mint,Fixture City,TX,00000,123\n3200 Mint,Fixture City,TX,00000,456\n1220 Example Road,Fixture City,TX,00000,789',
).records;
const syntheticPropertySource = {
  info: () => ({}),
  load: async (houseNumber) =>
    syntheticPropertyRecords.filter(
      (propertyRecord) => propertyRecord.streetKey.split(' ')[0] === houseNumber,
    ),
  recommend: async ({ house: houseNumber, name: streetName }) =>
    syntheticPropertyRecords.filter(
      (propertyRecord) =>
        (!houseNumber || propertyRecord.streetKey.split(' ')[0].startsWith(houseNumber)) &&
        new AddressConversation([]).parse(propertyRecord.street).name === streetName,
    ),
};
/** Relay browser tool calls to the actual API handler with isolated synthetic records and identity. */
function createSyntheticBroker() {
  return new AddressToolSession({
    request: async (path, requestOptions) =>
      addressTools(
        new Request('https://synthetic.example' + path, {
          ...requestOptions,
          headers: {
            ...requestOptions.headers,
            Origin: 'https://synthetic.example',
            'oai-authenticated-user-id': 'synthetic-user',
          },
        }),
        {},
        syntheticPropertySource,
      ),
  });
}
/** Execute and commit the ordered three-tool transaction for a synthetic utterance. */
async function runAddressToolTurn(toolSession, turnId, utterance, toolArguments = {}) {
  let addressResult;
  for (const tool of ['apply_address_reply', 'find_address_candidates', 'choose_clarification'])
    addressResult = await toolSession.invoke({
      tool,
      turn: turnId,
      utterance,
      arguments: toolArguments,
    });
  toolSession.commit(turnId);
  return addressResult;
}
test('00015: spoken forms match the numeric address', async () => {
  for (const text of [
    'Three twenty mint',
    'three hundred and twenty mint',
    'three two zero mint',
    'Mint three twenty',
    '320 Mint',
  ]) {
    const addressResult = await runAddressToolTurn(createSyntheticBroker(), 1, text);
    assert.equal(addressResult.result.kind, 'exact', text);
    assert.equal(addressResult.result.matches[0].values[0], 123);
  }
});
test('00015: number-only replies are not rearranged as street-first addresses', async () => {
  for (const text of ['three twenty', 'three hundred twenty', 'three two zero', 'twelve twenty'])
    assert.equal(
      new AddressConversation([]).parse(canonicalAddressReply(text)).house,
      text === 'twelve twenty' ? '1220' : '320',
    );
  const toolSession = createSyntheticBroker();
  await runAddressToolTurn(toolSession, 1, 'Mint');
  const addressResult = await runAddressToolTurn(toolSession, 2, 'three twenty');
  assert.equal(addressResult.result.matches[0].street, '320 Mint');
  assert.notEqual(addressResult.result.kind, 'none');
});
test('00015: supplied numbers and streets survive conflicting model hints', async () => {
  for (const toolArguments of [
    {
      intent: 'address',
      normalized_hint: '3 Twenty Mint',
    },
    {
      intent: 'address',
      normalized_hint: '3200 Mint',
    },
    {
      intent: 'address',
      normalized_hint: '320 Missing',
    },
    {
      intent: 'unknown',
    },
  ]) {
    const addressResult = await runAddressToolTurn(
      createSyntheticBroker(),
      1,
      'Three twenty mint',
      toolArguments,
    );
    assert.equal(addressResult.result.kind, 'exact', JSON.stringify(toolArguments));
    assert.equal(addressResult.result.matches[0].street, '320 Mint');
  }
});
test('00015: literal numbered street names and uncertain matches stay safe', async () => {
  assert.deepEqual(new AddressConversation([]).parse('320 Twenty Oaks Road'), {
    house: '320',
    name: 'twenty oaks',
    suffix: 'rd',
  });
  const addressResult = await runAddressToolTurn(createSyntheticBroker(), 1, '32 Mint');
  assert.equal(addressResult.result.kind, 'choose');
  assert.ok(
    addressResult.result.matches.every((propertyRecord) => propertyRecord.values === undefined),
  );
});
