// Synthetic, isolated address/session fixtures; never operational records.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../dist/lookup.mjs';
import { AddressConversation } from '../dist/resolver.mjs';
// Shared immutable input; each test constructs fresh mutable conversation state.
const records = parseCSV(`street,city,state,postal_code,property_value
50 SMITH AVE,EXAMPLE CITY,TX,00000,100
300 MINT DR,OTHER EXAMPLE,TX,00001,200
300 MINT DR,THIRD EXAMPLE,TX,00002,300
`).records;
// Verify street keyword after exact completion starts a fresh search.
test('00009 street keyword after exact completion starts a fresh search', () => {
  const conversation = new AddressConversation(records);
  assert.equal(conversation.respond('50 Smith Avenue Example City 00000').kind, 'exact');
  const addressResult = conversation.respond('mint');
  assert.equal(addressResult.kind, 'choose');
  assert.equal(addressResult.field, 'house');
  assert.equal(addressResult.total, 2);
  assert.equal(addressResult.context, 'mint');
  assert.match(addressResult.prompt, /house number/);
});
// Verify street keyword after fuzzy confirmation clears old house and locality.
test('00009 street keyword after fuzzy confirmation clears old house and locality', () => {
  const conversation = new AddressConversation(records);
  assert.equal(conversation.respond('50 Smyth Avenue 00000').field, 'confirm');
  assert.equal(conversation.respond('yes').kind, 'confirmed');
  const addressResult = conversation.respond('Mint Drive');
  assert.equal(addressResult.total, 2);
  assert.equal(addressResult.context, 'mint dr');
  assert.equal(addressResult.field, 'house');
});
// Verify active clarification retains address and locality constraints.
test('00009 active clarification retains address and locality constraints', () => {
  const conversation = new AddressConversation(records);
  assert.equal(conversation.respond('300 Mint').field, 'zip');
  const addressResult = conversation.respond('00001');
  assert.equal(addressResult.total, 1);
  assert.equal(addressResult.matches[0].postal_code, '00001');
  assert.match(addressResult.context, /300 mint 00001/);
});
// Verify explicit street or number correction after completion retains other slots.
test('00009 explicit street or number correction after completion retains other slots', () => {
  const conversation = new AddressConversation(records);
  conversation.respond('50 Smith Avenue 00000');
  const addressResult = conversation.respond('Actually Mint Drive');
  assert.equal(addressResult.kind, 'none');
  assert.match(addressResult.context, /50 mint dr.*00000/);
  conversation.reset();
  conversation.respond('50 Smith Avenue 00000');
  const corrected = conversation.respond('No, sixty, not fifty');
  assert.equal(corrected.kind, 'none');
  assert.match(corrected.context, /60 smith ave.*00000/);
});
