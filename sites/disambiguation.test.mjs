/**
 * Isolated synthetic regression scenarios; these do not establish live audio or production
 * source accuracy.
 */
// Isolated synthetic address fixtures; never production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../dist/lookup.mjs';
import { AddressConversation } from '../dist/resolver.mjs';
const records = parseCSV(
  'street,city,state,postal_code,property_value\n3220 Mint Drive,Fixture City,TX,00000,100\n45 Mint Lane,Other Fixture,TX,00001,200\n68 Mint Street,Third Fixture,TX,00002,300\n99 Mint Court,Fourth Fixture,TX,00003,400',
).records;
// Verify Mint 32 recommends a longer house number but never confirms it automatically.
test('Mint 32 recommends a longer house number but never confirms it automatically', () => {
  const conversation = new AddressConversation(records, {
    allowHousePrefix: true,
  });
  const addressResult = conversation.respond('Mint 32');
  assert.equal(addressResult.kind, 'choose');
  assert.equal(addressResult.field, 'confirm');
  assert.equal(addressResult.matches[0].street, '3220 Mint Drive');
  const confirmed = conversation.respond('yes');
  assert.equal(confirmed.kind, 'confirmed');
  assert.match(confirmed.context, /3220/);
});
// Verify partial street shows bounded recommendations even without house number.
test('partial street shows bounded recommendations even without house number', () => {
  const conversation = new AddressConversation(records, {
    allowHousePrefix: true,
  });
  const addressResult = conversation.respond('Mint');
  assert.equal(addressResult.field, 'house');
  assert.equal(addressResult.matches.length, 3);
  assert.equal(addressResult.total, 4);
  const chosen = conversation.respond('the first');
  assert.equal(chosen.kind, 'confirmed');
  assert.equal(chosen.matches[0].street, '3220 Mint Drive');
});
// Verify default strict resolver never silently substitutes a different house number.
test('default strict resolver never silently substitutes a different house number', () => {
  const conversation = new AddressConversation(records);
  assert.equal(conversation.respond('32 Mint').kind, 'none');
});
// Verify explicit ZIP reply narrows street recommendations.
test('explicit ZIP reply narrows street recommendations', () => {
  const conversation = new AddressConversation(records, {
    allowHousePrefix: true,
  });
  conversation.respond('Mint');
  const addressResult = conversation.respond('the ZIP is 00001');
  assert.equal(addressResult.matches.length, 1);
  assert.equal(addressResult.matches[0].postal_code, '00001');
});
