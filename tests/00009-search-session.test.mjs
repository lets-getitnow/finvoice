// Synthetic, isolated address/session fixtures; never operational records.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV} from '../dist/lookup.mjs';
import {AddressConversation} from '../dist/resolver.mjs';
// Shared immutable input; each test constructs fresh mutable conversation state.
const records=parseCSV(`street,city,state,postal_code,property_value
50 SMITH AVE,EXAMPLE CITY,TX,00000,100
300 MINT DR,OTHER EXAMPLE,TX,00001,200
300 MINT DR,THIRD EXAMPLE,TX,00002,300
`).records;
// Verify street keyword after exact completion starts a fresh search.
test('00009 street keyword after exact completion starts a fresh search',()=>{
  const c=new AddressConversation(records);
  assert.equal(c.respond('50 Smith Avenue Example City 00000').kind,'exact');
  const r=c.respond('mint');assert.equal(r.kind,'choose');assert.equal(r.field,'house');assert.equal(r.total,2);
  assert.equal(r.context,'mint');assert.match(r.prompt,/house number/);
});
// Verify street keyword after fuzzy confirmation clears old house and locality.
test('00009 street keyword after fuzzy confirmation clears old house and locality',()=>{
  const c=new AddressConversation(records);assert.equal(c.respond('50 Smyth Avenue 00000').field,'confirm');
  assert.equal(c.respond('yes').kind,'confirmed');
  const r=c.respond('Mint Drive');assert.equal(r.total,2);assert.equal(r.context,'mint dr');assert.equal(r.field,'house');
});
// Verify active clarification retains address and locality constraints.
test('00009 active clarification retains address and locality constraints',()=>{
  const c=new AddressConversation(records);assert.equal(c.respond('300 Mint').field,'zip');
  const r=c.respond('00001');assert.equal(r.total,1);assert.equal(r.matches[0].postal_code,'00001');assert.match(r.context,/300 mint 00001/);
});
// Verify explicit street or number correction after completion retains other slots.
test('00009 explicit street or number correction after completion retains other slots',()=>{
  const c=new AddressConversation(records);c.respond('50 Smith Avenue 00000');
  const r=c.respond('Actually Mint Drive');assert.equal(r.kind,'none');assert.match(r.context,/50 mint dr.*00000/);
  c.reset();c.respond('50 Smith Avenue 00000');const corrected=c.respond('No, sixty, not fifty');
  assert.equal(corrected.kind,'none');assert.match(corrected.context,/60 smith ave.*00000/);
});
