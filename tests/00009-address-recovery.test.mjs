// Synthetic in-memory fixtures only. Reserved example ZIPs; never operational data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV } from '../dist/lookup.mjs';
import { AddressConversation } from '../dist/resolver.mjs';
const csv = `street,city,state,postal_code,property_value
1240 BEECHNUT ST,EXAMPLE CITY,TX,00000,100
1240 BEECHNUT ST,OTHER EXAMPLE,TX,00001,200
2140 WESTBROOK DR,EXAMPLE CITY,TX,00000,300
50 SMITH AVE,EXAMPLE CITY,TX,00000,400
100 MAPLE DR,EXAMPLE CITY,TX,00000,500
100 MAPLE LN,EXAMPLE CITY,TX,00000,600
500 ELM ST APT 2B,EXAMPLE CITY,TX,00000,700
500 ELM ST APT 3B,EXAMPLE CITY,TX,00000,800
200 N EXAMPLE ST,EXAMPLE CITY,TX,00000,900
200 S EXAMPLE ST,EXAMPLE CITY,TX,00000,1000
`;
/** Create an isolated conversation per scenario so retained slots never leak between tests. */
const createConversation = () => new AddressConversation(parseCSV(csv).records);
// Verify ZIP anchors constrain spelling/phonetic recovery and require confirmation.
test('00009 ZIP anchors constrain spelling/phonetic recovery and require confirmation', () => {
  const conversation = createConversation();
  let addressResult = conversation.respond('1240 beach nut street ZIP zero zero zero zero zero');
  assert.equal(addressResult.kind, 'choose');
  assert.equal(addressResult.total, 1);
  assert.equal(addressResult.matches[0].postal_code, '00000');
  assert.match(addressResult.prompt, /Did you mean/);
  assert.equal(conversation.respond('yes').kind, 'confirmed');
  addressResult = createConversation().respond('50 Smyth Avenue 00000');
  assert.equal(addressResult.kind, 'choose');
  assert.equal(addressResult.matches[0].street, '50 SMITH AVE');
  assert.equal(createConversation().respond('1240 beach nut 99999').kind, 'none');
  assert.equal(createConversation().respond('1241 Beechnut 00000').kind, 'none');
  assert.equal(createConversation().respond('50 Completelyunrelated 00000').kind, 'none');
});
// Verify keeps address context across ZIP follow-up, correction and reset.
test('00009 keeps address context across ZIP follow-up, correction and reset', () => {
  const conversation = createConversation();
  let addressResult = conversation.respond('1240 beach nut');
  assert.equal(addressResult.field, 'zip');
  addressResult = conversation.respond('00000');
  assert.equal(addressResult.total, 1);
  assert.match(addressResult.context, /1240.*00000/);
  assert.equal(conversation.respond('yes').matches[0].values[0], 100);
  conversation.respond('15 Smith Avenue 00000');
  addressResult = conversation.respond('No, fifty, not fifteen');
  assert.equal(addressResult.matches[0].street, '50 SMITH AVE');
  assert.equal(addressResult.kind, 'choose');
  assert.equal(conversation.respond('yes').kind, 'confirmed');
  addressResult = conversation.respond('start over');
  assert.equal(addressResult.kind, 'empty');
  assert.equal(addressResult.context, '');
});
// Verify asks one distinguishing detail and accepts suffix/unit/direction and ordinal answers.
test('00009 asks one distinguishing detail and accepts suffix/unit/direction and ordinal answers', () => {
  const conversation = createConversation();
  let addressResult = conversation.respond('100 Maple 00000');
  assert.equal(addressResult.field, 'suffix');
  addressResult = conversation.respond('Lane');
  assert.equal(addressResult.kind, 'exact');
  assert.equal(addressResult.matches[0].street, '100 MAPLE LN');
  addressResult = conversation.respond('500 Elm 00000');
  assert.equal(addressResult.field, 'unit');
  addressResult = conversation.respond('2B');
  assert.equal(addressResult.matches[0].street, '500 ELM ST APT 2B');
  addressResult = conversation.respond('200 Example 00000');
  assert.equal(addressResult.field, 'direction');
  addressResult = conversation.respond('south');
  assert.equal(addressResult.matches[0].street, '200 S EXAMPLE ST');
  conversation.respond('100 Maple 00000');
  addressResult = conversation.respond('the second one');
  assert.equal(addressResult.kind, 'confirmed');
  assert.equal(addressResult.matches[0].street, '100 MAPLE LN');
});
// Verify joined words, spoken numbers and missing house number recover without automatic fuzzy release.
test('00009 joined words, spoken numbers and missing house number recover without automatic fuzzy release', () => {
  let addressResult = createConversation().respond('twenty one forty West Brook Drive 00000');
  assert.equal(addressResult.total, 1);
  assert.equal(addressResult.kind, 'choose');
  assert.equal(addressResult.matches[0].street, '2140 WESTBROOK DR');
  const conversation = createConversation();
  addressResult = conversation.respond('Maple Lane 00000');
  assert.equal(addressResult.field, 'house');
  addressResult = conversation.respond('one hundred');
  assert.equal(addressResult.matches[0].street, '100 MAPLE LN');
  addressResult = createConversation().respond('50 Smith Avenue Example City 00000');
  assert.equal(addressResult.kind, 'exact');
});
// Verify negative confirmation never releases a value; locality corrections preserve street.
test('00009 negative confirmation never releases a value; locality corrections preserve street', () => {
  const conversation = createConversation();
  conversation.respond('1240 beach nut 00000');
  let addressResult = conversation.respond('no');
  assert.notEqual(addressResult.kind, 'confirmed');
  assert.equal(addressResult.matches.length, 0);
  addressResult = conversation.respond('actually Beechnut Street');
  assert.equal(addressResult.matches[0].street, '1240 BEECHNUT ST');
  addressResult = conversation.respond('the ZIP is 00001');
  assert.equal(addressResult.matches[0].postal_code, '00001');
});
// Verify large sets ask for detail without presenting hidden ordinal choices.
test('00009 large sets ask for detail without presenting hidden ordinal choices', () => {
  const records = parseCSV(
    'street,city,state,postal_code,property_value\n' +
      Array.from(
        {
          length: 20,
        },
        (_, recordIndex) => `${recordIndex + 1} SAMPLE ST,EXAMPLE CITY,TX,00000,100`,
      ).join('\n'),
  ).records;
  const conversation = new AddressConversation(records);
  const addressResult = conversation.respond('Sample Street 00000');
  assert.equal(addressResult.field, 'house');
  assert.equal(addressResult.matches.length, 0);
  assert.equal(addressResult.total, 20);
  assert.notEqual(conversation.respond('the second one').kind, 'confirmed');
});
// Verify conflicting values stay attached; explicit unknown city and units never disappear.
test('00009 conflicting values stay attached; explicit unknown city and units never disappear', () => {
  const records = parseCSV(csv + '50 SMITH AVE,EXAMPLE CITY,TX,00000,450\n').records;
  const conversation = new AddressConversation(records);
  assert.equal(conversation.respond('50 Smith Avenue 00000').matches[0].values.length, 2);
  assert.equal(createConversation().respond('50 Smith Avenue in Unknown Example').kind, 'none');
  assert.equal(createConversation().respond('500 Elm St apt 9B 00000').kind, 'none');
});
// Verify five-digit house numbers are distinct from trailing ZIP and ZIP+4.
test('00009 five-digit house numbers are distinct from trailing ZIP and ZIP+4', () => {
  const records = parseCSV(
    'street,city,state,postal_code,property_value\n12345 EXAMPLE DR,EXAMPLE CITY,TX,00000,100\n',
  ).records;
  const conversation = new AddressConversation(records);
  assert.equal(conversation.respond('12345 Example Drive Example City 00000').kind, 'exact');
  assert.equal(conversation.respond('12345 Example Drive 00000-1234').kind, 'exact');
  conversation.reset();
  assert.equal(conversation.respond('Example Drive ZIP 00000').field, 'house');
  assert.equal(conversation.respond('12345').kind, 'exact');
});
// Verify locality embedded in source street is parsed without corrupting units or Texas street names.
test('00009 locality embedded in source street is parsed without corrupting units or Texas street names', () => {
  const records = parseCSV(
    'street,city,state,postal_code,property_value\n"12345 EXAMPLE HWY UNIT 2B, EXAMPLE CITY, TX 00000",EXAMPLE CITY,TX,00000,100\n50 TEXAS AVE,EXAMPLE CITY,TX,00000,200\n',
  ).records;
  const conversation = new AddressConversation(records);
  assert.equal(
    conversation.respond('12345 Example Highway unit 2B Example City TX 00000').kind,
    'exact',
  );
  assert.equal(conversation.respond('50 Texas Avenue 00000').kind, 'exact');
});
// Verify broadens locality only on an explicit request and confirms the recovered address.
test('00009 broadens locality only on an explicit request and confirms the recovered address', () => {
  const conversation = createConversation();
  assert.equal(conversation.respond('50 Smyth Avenue 99999').kind, 'none');
  const addressResult = conversation.respond('search everywhere');
  assert.equal(addressResult.kind, 'choose');
  assert.equal(addressResult.field, 'confirm');
  assert.equal(addressResult.matches[0].street, '50 SMITH AVE');
  assert.doesNotMatch(addressResult.context, /99999/);
});
// Verify recognition alternatives stay within supplied locality and require confirmation.
test('00009 recognition alternatives stay within supplied locality and require confirmation', () => {
  const conversation = createConversation();
  const addressResult = conversation.respond('50 Unrelated 00000', [
    '50 Smith Avenue 00001',
    '50 Smith Avenue 00000',
  ]);
  assert.equal(addressResult.kind, 'choose');
  assert.equal(addressResult.matches[0].postal_code, '00000');
  assert.equal(conversation.respond('yes').kind, 'confirmed');
});
