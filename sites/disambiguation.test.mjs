// Isolated synthetic address fixtures; never production data.
import test from 'node:test';import assert from 'node:assert/strict';
import {parseCSV} from '../dist/lookup.mjs';import {AddressConversation} from '../dist/resolver.mjs';
const records=parseCSV('street,city,state,postal_code,property_value\n3220 Mint Drive,Fixture City,TX,00000,100\n45 Mint Lane,Other Fixture,TX,00001,200\n68 Mint Street,Third Fixture,TX,00002,300\n99 Mint Court,Fourth Fixture,TX,00003,400').records;
test('Mint 32 recommends a longer house number but never confirms it automatically',()=>{
 const c=new AddressConversation(records,{allowHousePrefix:true});const r=c.respond('Mint 32');assert.equal(r.kind,'choose');assert.equal(r.field,'confirm');assert.equal(r.matches[0].street,'3220 Mint Drive');
 const confirmed=c.respond('yes');assert.equal(confirmed.kind,'confirmed');assert.match(confirmed.context,/3220/);
});
test('partial street shows bounded recommendations even without house number',()=>{
 const c=new AddressConversation(records,{allowHousePrefix:true});const r=c.respond('Mint');assert.equal(r.field,'house');assert.equal(r.matches.length,3);assert.equal(r.total,4);
 const chosen=c.respond('the first');assert.equal(chosen.kind,'confirmed');assert.equal(chosen.matches[0].street,'3220 Mint Drive');
});
test('default strict resolver never silently substitutes a different house number',()=>{
 const c=new AddressConversation(records);assert.equal(c.respond('32 Mint').kind,'none');
});
test('explicit ZIP reply narrows street recommendations',()=>{
 const c=new AddressConversation(records,{allowHousePrefix:true});c.respond('Mint');const r=c.respond('the ZIP is 00001');assert.equal(r.matches.length,1);assert.equal(r.matches[0].postal_code,'00001');
});
