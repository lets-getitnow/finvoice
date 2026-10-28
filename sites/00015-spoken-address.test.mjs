// Explicitly synthetic fixtures, isolated from production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV} from '../dist/lookup.mjs';
import {AddressConversation} from '../dist/resolver.mjs';
import {canonicalAddressReply,addressTools} from './address-tools.mjs';
import {AddressToolSession} from '../dist/address-tools.mjs';
const records=parseCSV('street,city,state,postal_code,property_value\n320 Mint,Fixture City,TX,00000,123\n3200 Mint,Fixture City,TX,00000,456\n1220 Example Road,Fixture City,TX,00000,789').records;
const source={info:()=>({}),load:async house=>records.filter(r=>r.streetKey.split(' ')[0]===house),recommend:async({house,name})=>records.filter(r=>(!house||r.streetKey.split(' ')[0].startsWith(house))&&new AddressConversation([]).parse(r.street).name===name)};
function broker(){return new AddressToolSession({request:async(path,init)=>addressTools(new Request('https://synthetic.example'+path,{...init,headers:{...init.headers,Origin:'https://synthetic.example','oai-authenticated-user-id':'synthetic-user'}}),{},source)});}
async function turn(b,id,utterance,args={}){let r;for(const tool of ['apply_address_reply','find_address_candidates','choose_clarification'])r=await b.invoke({tool,turn:id,utterance,arguments:args});b.commit(id);return r;}
test('00015: spoken forms match the numeric address',async()=>{
 for(const text of ['Three twenty mint','three hundred and twenty mint','three two zero mint','Mint three twenty','320 Mint']){const r=await turn(broker(),1,text);assert.equal(r.result.kind,'exact',text);assert.equal(r.result.matches[0].values[0],123);}
});
test('00015: number-only replies are not rearranged as street-first addresses',async()=>{
 for(const text of ['three twenty','three hundred twenty','three two zero','twelve twenty'])assert.equal(new AddressConversation([]).parse(canonicalAddressReply(text)).house,text==='twelve twenty'?'1220':'320');
 const b=broker();await turn(b,1,'Mint');const r=await turn(b,2,'three twenty');assert.equal(r.result.matches[0].street,'320 Mint');assert.notEqual(r.result.kind,'none');
});
test('00015: supplied numbers and streets survive conflicting model hints',async()=>{
 for(const args of [{intent:'address',normalized_hint:'3 Twenty Mint'},{intent:'address',normalized_hint:'3200 Mint'},{intent:'address',normalized_hint:'320 Missing'},{intent:'unknown'}]){const r=await turn(broker(),1,'Three twenty mint',args);assert.equal(r.result.kind,'exact',JSON.stringify(args));assert.equal(r.result.matches[0].street,'320 Mint');}
});
test('00015: literal numbered street names and uncertain matches stay safe',async()=>{
 assert.deepEqual(new AddressConversation([]).parse('320 Twenty Oaks Road'),{house:'320',name:'twenty oaks',suffix:'rd'});
 const r=await turn(broker(),1,'32 Mint');assert.equal(r.result.kind,'choose');assert.ok(r.result.matches.every(r=>r.values===undefined));
});
