// Synthetic in-memory fixtures only. Reserved example ZIPs; never operational data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV} from '../dist/lookup.mjs';
import {AddressConversation} from '../dist/resolver.mjs';
const csv=`street,city,state,postal_code,property_value
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
const make=()=>new AddressConversation(parseCSV(csv).records);
// Verify ZIP anchors constrain spelling/phonetic recovery and require confirmation.
test('00009 ZIP anchors constrain spelling/phonetic recovery and require confirmation',()=>{
  const c=make();let r=c.respond('1240 beach nut street ZIP zero zero zero zero zero');
  assert.equal(r.kind,'choose');assert.equal(r.total,1);assert.equal(r.matches[0].postal_code,'00000');
  assert.match(r.prompt,/Did you mean/);assert.equal(c.respond('yes').kind,'confirmed');
  r=make().respond('50 Smyth Avenue 00000');assert.equal(r.kind,'choose');assert.equal(r.matches[0].street,'50 SMITH AVE');
  assert.equal(make().respond('1240 beach nut 99999').kind,'none');
  assert.equal(make().respond('1241 Beechnut 00000').kind,'none');
  assert.equal(make().respond('50 Completelyunrelated 00000').kind,'none');
});
// Verify keeps address context across ZIP follow-up, correction and reset.
test('00009 keeps address context across ZIP follow-up, correction and reset',()=>{
  const c=make();let r=c.respond('1240 beach nut');assert.equal(r.field,'zip');
  r=c.respond('00000');assert.equal(r.total,1);assert.match(r.context,/1240.*00000/);
  assert.equal(c.respond('yes').matches[0].values[0],100);
  c.respond('15 Smith Avenue 00000');r=c.respond('No, fifty, not fifteen');
  assert.equal(r.matches[0].street,'50 SMITH AVE');assert.equal(r.kind,'choose');
  assert.equal(c.respond('yes').kind,'confirmed');
  r=c.respond('start over');assert.equal(r.kind,'empty');assert.equal(r.context,'');
});
// Verify asks one distinguishing detail and accepts suffix/unit/direction and ordinal answers.
test('00009 asks one distinguishing detail and accepts suffix/unit/direction and ordinal answers',()=>{
  const c=make();let r=c.respond('100 Maple 00000');assert.equal(r.field,'suffix');
  r=c.respond('Lane');assert.equal(r.kind,'exact');assert.equal(r.matches[0].street,'100 MAPLE LN');
  r=c.respond('500 Elm 00000');assert.equal(r.field,'unit');
  r=c.respond('2B');assert.equal(r.matches[0].street,'500 ELM ST APT 2B');
  r=c.respond('200 Example 00000');assert.equal(r.field,'direction');
  r=c.respond('south');assert.equal(r.matches[0].street,'200 S EXAMPLE ST');
  c.respond('100 Maple 00000');r=c.respond('the second one');assert.equal(r.kind,'confirmed');
  assert.equal(r.matches[0].street,'100 MAPLE LN');
});
// Verify joined words, spoken numbers and missing house number recover without automatic fuzzy release.
test('00009 joined words, spoken numbers and missing house number recover without automatic fuzzy release',()=>{
  let r=make().respond('twenty one forty West Brook Drive 00000');
  assert.equal(r.total,1);assert.equal(r.kind,'choose');assert.equal(r.matches[0].street,'2140 WESTBROOK DR');
  const c=make();r=c.respond('Maple Lane 00000');assert.equal(r.field,'house');
  r=c.respond('one hundred');assert.equal(r.matches[0].street,'100 MAPLE LN');
  r=make().respond('50 Smith Avenue Example City 00000');assert.equal(r.kind,'exact');
});
// Verify negative confirmation never releases a value; locality corrections preserve street.
test('00009 negative confirmation never releases a value; locality corrections preserve street',()=>{
  const c=make();c.respond('1240 beach nut 00000');let r=c.respond('no');
  assert.notEqual(r.kind,'confirmed');assert.equal(r.matches.length,0);
  r=c.respond('actually Beechnut Street');assert.equal(r.matches[0].street,'1240 BEECHNUT ST');
  r=c.respond('the ZIP is 00001');assert.equal(r.matches[0].postal_code,'00001');
});
// Verify large sets ask for detail without presenting hidden ordinal choices.
test('00009 large sets ask for detail without presenting hidden ordinal choices',()=>{
  const records=parseCSV('street,city,state,postal_code,property_value\n'+Array.from({length:20},(_,i)=>`${i+1} SAMPLE ST,EXAMPLE CITY,TX,00000,100`).join('\n')).records;
  const c=new AddressConversation(records);const r=c.respond('Sample Street 00000');
  assert.equal(r.field,'house');assert.equal(r.matches.length,0);assert.equal(r.total,20);
  assert.notEqual(c.respond('the second one').kind,'confirmed');
});
// Verify conflicting values stay attached; explicit unknown city and units never disappear.
test('00009 conflicting values stay attached; explicit unknown city and units never disappear',()=>{
  const records=parseCSV(csv+'50 SMITH AVE,EXAMPLE CITY,TX,00000,450\n').records;
  const c=new AddressConversation(records);assert.equal(c.respond('50 Smith Avenue 00000').matches[0].values.length,2);
  assert.equal(make().respond('50 Smith Avenue in Unknown Example').kind,'none');
  assert.equal(make().respond('500 Elm St apt 9B 00000').kind,'none');
});
// Verify five-digit house numbers are distinct from trailing ZIP and ZIP+4.
test('00009 five-digit house numbers are distinct from trailing ZIP and ZIP+4',()=>{
  const records=parseCSV('street,city,state,postal_code,property_value\n12345 EXAMPLE DR,EXAMPLE CITY,TX,00000,100\n').records;
  const c=new AddressConversation(records);
  assert.equal(c.respond('12345 Example Drive Example City 00000').kind,'exact');
  assert.equal(c.respond('12345 Example Drive 00000-1234').kind,'exact');
  c.reset();assert.equal(c.respond('Example Drive ZIP 00000').field,'house');
  assert.equal(c.respond('12345').kind,'exact');
});
// Verify locality embedded in source street is parsed without corrupting units or Texas street names.
test('00009 locality embedded in source street is parsed without corrupting units or Texas street names',()=>{
  const records=parseCSV('street,city,state,postal_code,property_value\n"12345 EXAMPLE HWY UNIT 2B, EXAMPLE CITY, TX 00000",EXAMPLE CITY,TX,00000,100\n50 TEXAS AVE,EXAMPLE CITY,TX,00000,200\n').records;
  const c=new AddressConversation(records);
  assert.equal(c.respond('12345 Example Highway unit 2B Example City TX 00000').kind,'exact');
  assert.equal(c.respond('50 Texas Avenue 00000').kind,'exact');
});
// Verify broadens locality only on an explicit request and confirms the recovered address.
test('00009 broadens locality only on an explicit request and confirms the recovered address',()=>{
  const c=make();assert.equal(c.respond('50 Smyth Avenue 99999').kind,'none');
  const r=c.respond('search everywhere');assert.equal(r.kind,'choose');assert.equal(r.field,'confirm');
  assert.equal(r.matches[0].street,'50 SMITH AVE');assert.doesNotMatch(r.context,/99999/);
});
// Verify recognition alternatives stay within supplied locality and require confirmation.
test('00009 recognition alternatives stay within supplied locality and require confirmation',()=>{
  const c=make();const r=c.respond('50 Unrelated 00000',['50 Smith Avenue 00001','50 Smith Avenue 00000']);
  assert.equal(r.kind,'choose');assert.equal(r.matches[0].postal_code,'00000');
  assert.equal(c.respond('yes').kind,'confirmed');
});
