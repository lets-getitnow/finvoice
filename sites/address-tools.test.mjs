import test from 'node:test';import assert from 'node:assert/strict';
import {addressTools,canonicalAddressReply} from './address-tools.mjs';
import {makeBroker,syntheticSource} from './tool-fixture.mjs';
const ORDER=['apply_address_reply','find_address_candidates','choose_clarification'];
async function turn(broker,id,utterance,args={}){let output;for(const tool of ORDER)output=await broker.invoke({tool,turn:id,utterance,arguments:args});broker.commit(id);return output;}
test('three-phase tools handle partial speech without leaking unconfirmed valuations',async()=>{
 const b=makeBroker();await b.invoke({tool:ORDER[0],turn:1,utterance:'Mint thirty two',arguments:{intent:'address'}});
 const found=await b.invoke({tool:ORDER[1],turn:1});assert.ok(found.candidates.length);assert.ok(found.result.matches.every(r=>r.values===undefined));
 const answer=await b.invoke({tool:ORDER[2],turn:1,arguments:{preferred_detail:'auto'}});assert.equal(answer.result.kind,'choose');assert.match(answer.speech,/Fixture/);assert.equal(answer.result.field,'city');b.commit(1);
});
test('model cannot invent yes; withdrawal and unknown replies preserve safety',async()=>{
 const b=makeBroker();const first=await turn(b,1,'50 Smith Avenue Fixture City 00000');assert.equal(first.result.field,'confirm');assert.equal(first.result.matches[0].values,undefined);
 const unknown=await turn(b,2,"I don't know");assert.ok(unknown.context.unknown_fields.includes('confirm'));assert.notEqual(unknown.result.kind,'confirmed');
 const reply=await turn(b,3,'yeah no, the other one',{intent:'confirm'});assert.notEqual(reply.result.kind,'confirmed');assert.ok(reply.result.matches.every(r=>r.values===undefined));
});
test('explicit confirmation permits source-backed valuation and keeps context',async()=>{
 const b=makeBroker();await turn(b,1,'50 Smith Avenue Fixture City 00000');const yes=await turn(b,2,'yes',{intent:'confirm'});assert.equal(yes.result.kind,'confirmed');assert.equal(yes.result.matches[0].values[0],300);
});
test('canonical repairs preserve house numbers and spoken number groups',()=>{
 assert.equal(canonicalAddressReply('32 Main no Mint'),'32 Mint');assert.equal(canonicalAddressReply('Mint thirty two twenty'),'3220 Mint');assert.equal(canonicalAddressReply('no, thirty two, not twenty three'),'the house number is 32');
});
test('broker enforces phase order and drops cancelled/old turns',async()=>{
 const b=makeBroker();await assert.rejects(b.invoke({tool:ORDER[1],turn:1}),/out of order/);
 await b.invoke({tool:ORDER[0],turn:1,utterance:'Mint 32'});b.cancel();await assert.rejects(b.invoke({tool:ORDER[1],turn:1}),/out of order/);assert.deepEqual(b.history,[]);
 await turn(b,2,'50 Smith Avenue Fixture City 00000');await assert.rejects(b.invoke({tool:ORDER[0],turn:1,utterance:'yes'}),/Stale/);
});
test('tool API requires authenticated same-origin requests',async()=>{
 const body=JSON.stringify({tool:ORDER[0],turn:1,history:[],utterance:'Mint 32'});
 assert.equal((await addressTools(new Request('https://synthetic.example/api/address/tools',{method:'POST',body}),{},syntheticSource)).status,401);
 assert.equal((await addressTools(new Request('https://synthetic.example/api/address/tools',{method:'POST',headers:{Origin:'https://evil.example','oai-authenticated-user-id':'synthetic-user'},body}),{},syntheticSource)).status,403);
});
test('phonetic spelling and fragmented numbers remain confirmation-only',async()=>{
 const b=makeBroker();const r=await turn(b,1,'50 Smyth Avenue');assert.equal(r.result.kind,'choose');assert.ok(r.result.matches.length>0);assert.ok(r.result.matches.every(r=>r.values===undefined));
 assert.equal(canonicalAddressReply('Mint thirty-two twenty'),'3220 Mint');assert.equal(canonicalAddressReply("32 Main no it's Mint, not Main"),'32 Mint');
});
test('a rejected candidate is not re-offered after an uncertain reply',async()=>{
 const b=makeBroker();const first=await turn(b,1,'50 Smith Avenue Fixture City 00000');const id=first.result.matches[0].id;
 await turn(b,2,'no');const again=await turn(b,3,"I don't know");assert.ok(again.context.rejected_ids.includes(id));assert.ok(again.result.matches.every(r=>r.id!==id));
});
test('cancelled in-flight tool response cannot overwrite conversation state',async()=>{
 let release;const response=new Promise(resolve=>{release=resolve;});
 const {AddressToolSession}=await import('../dist/address-tools.mjs');const b=new AddressToolSession({request:()=>response});
 const pending=b.invoke({tool:'apply_address_reply',turn:1,utterance:'Mint 32'});b.cancel();release(new Response(JSON.stringify({tool:'apply_address_reply',turn:1,history:['Mint 32'],context:{}}),{headers:{'Content-Type':'application/json'}}));
 await assert.rejects(pending,/Stale/);assert.deepEqual(b.history,[]);
});
test('semantic tool hints remain unconfirmed and cannot replace a detail with a new address',async()=>{
 const b=makeBroker();const first=await turn(b,1,'50 Smith Avenue');assert.equal(first.result.field,'city');
 const result=await turn(b,2,'the first city, Fixture City',{intent:'address',normalized_hint:'Fixture City',detail:'city'});assert.equal(result.result.field,'confirm');assert.equal(result.result.matches[0].values,undefined);
 const notYes=await turn(b,3,'maybe',{intent:'confirm',normalized_hint:'yes'});assert.notEqual(notYes.result.kind,'confirmed');
});
test('model ordinal hint cannot manufacture confirmation for an uncertain actual reply',async()=>{
 const b=makeBroker();await turn(b,1,'50 Smith Avenue Fixture City 00000');const r=await turn(b,2,'maybe',{intent:'address',normalized_hint:'the first'});assert.notEqual(r.result.kind,'confirmed');assert.equal(r.result.matches[0]?.values,undefined);
});
