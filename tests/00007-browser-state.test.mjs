// Synthetic UI and browser speech doubles. No real audio or company data is used.
import test from 'node:test';
import assert from 'node:assert/strict';
class Element {
  constructor(){this.children=[];this.dataset={};this.textContent='';this.hidden=false;this.value='';this.checked=true;this.disabled=false;this.files=[];}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=items;}
  setAttribute(key,value){this[key]=value;}
  querySelector(){this.span??=new Element();return this.span;}
  focus(){this.focused=true;}
  click(){this.onclick?.();}
}
const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
globalThis.document={getElementById:get,querySelector:()=>get('panel'),createElement:()=>new Element(),createElementNS:()=>new Element(),createTextNode:value=>({textContent:value})};
let activeRecognition,utterance;
class SyntheticRecognition {
  constructor(){activeRecognition=this;}
  start(){this.onstart?.();}
  stop(){this.onend?.();}
  abort(){this.onend?.();}
}
const synthesis={cancel(){},speak(u){utterance=u;}};
globalThis.window={SpeechRecognition:SyntheticRecognition,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:synthesis,addEventListener(){}};
globalThis.SpeechSynthesisUtterance=window.SpeechSynthesisUtterance;
globalThis.speechSynthesis=synthesis;
globalThis.location={hostname:'example.test'};
const csv='street,city,state,postal_code,property_value\n100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,123456\n';
let fetches=[];
globalThis.fetch=async url=>{fetches.push(url);return {ok:true,text:async()=>csv};};
await import('../dist/app.mjs');
await new Promise(setImmediate);
async function importFile(content){get('file').files=[{name:'synthetic-example.csv',size:content.length,text:async()=>content}];await get('file').onchange({target:get('file')});}
const allText=e=>[e.textContent,...e.children.map(c=>typeof c==='string'?c:allText(c))].join(' ');
test('00011 synthetic UI: fresh hosted visit loads published data without import',()=>{
  assert.deepEqual(fetches,['./data/properties.csv']);
  assert.equal(get('record-count').textContent,'1');assert.equal(get('source-name').textContent,'Published Texas property export');
  assert.equal(get('retry-data').hidden,true);
  get('speak-toggle').checked=false;get('address').value='100 Example Street';get('search-form').onsubmit({preventDefault(){}});
  assert.match(allText(get('result-area')),/\$123,456/);get('speak-toggle').checked=true;
});
test('00007 synthetic UI: import, exact lookup and spoken response lifecycle',async()=>{
  await importFile(csv);assert.equal(get('record-count').textContent,'1');
  get('address').value='100 Example Street';get('search-form').onsubmit({preventDefault(){}});
  assert.match(allText(get('result-area')),/\$123,456/);
  assert.match(utterance.text,/100 EXAMPLE ST.*\$123,456/);
  assert.equal(get('panel').dataset.state,'speaking');
  utterance.onend();assert.equal(get('panel').dataset.state,'ready');
});
test('00007 synthetic UI: speech transcript routes through the same actual lookup',()=>{
  get('talk').onclick();assert.equal(get('panel').dataset.state,'listening');
  const result=[{transcript:'What is the valuation of one hundred Example Street?'}];result.isFinal=true;
  activeRecognition.onresult({results:[result]});
  assert.match(allText(get('result-area')),/\$123,456/);
  assert.match(get('transcript').textContent,/one hundred/);
  assert.equal(get('panel').dataset.state,'speaking');
  get('stop-audio').onclick();assert.equal(get('panel').dataset.state,'ready');
});
test('00007 synthetic UI: permission denial, retry, no-result and typed recovery',()=>{
  get('talk').onclick();activeRecognition.onerror({error:'not-allowed'});activeRecognition.onend();
  assert.match(get('voice-description').textContent,/blocked.*site settings/);
  get('talk').onclick();assert.equal(get('panel').dataset.state,'listening');
  activeRecognition.onerror({error:'no-speech'});activeRecognition.onend();assert.match(get('voice-description').textContent,/didn’t hear/);
  get('speak-toggle').checked=false;get('address').value='999 EXAMPLE ST';get('search-form').onsubmit({preventDefault(){}});
  assert.match(allText(get('result-area')),/No matching address/);assert.equal(get('address').value,'999 EXAMPLE ST');
  get('address').value='100 EXAMPLE ST';get('search-form').onsubmit({preventDefault(){}});assert.match(allText(get('result-area')),/\$123,456/);
});
test('00007 synthetic UI: bad import preserves working data and source markup stays text',async()=>{
  await importFile('wrong,columns\n1,2');assert.match(get('notice').textContent,/previous dataset is still connected/);
  get('address').value='100 EXAMPLE ST';get('search-form').onsubmit({preventDefault(){}});assert.match(allText(get('result-area')),/\$123,456/);
  await importFile('street,city,state,postal_code,property_value\n1 <script>example</script>,EXAMPLE CITY,Texas,00000,100');
  get('address').value='1 <script>example</script>';get('search-form').onsubmit({preventDefault(){}});assert.match(allText(get('result-area')),/<script>example<\/script>/);
});
test('00007 synthetic UI: conflicting import never speaks a chosen valuation',async()=>{
  await importFile(csv+'100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,200000\n');
  get('address').value='100 EXAMPLE ST';get('search-form').onsubmit({preventDefault(){}});
  assert.match(allText(get('result-area')),/conflicting valuations/);assert.doesNotMatch(allText(get('result-area')),/IMPORTED PROPERTY VALUATION/);
});
test('00009 synthetic UI: fuzzy voice clarification, confirmation, reset and rejected-match correction',async()=>{
  await importFile('street,city,state,postal_code,property_value\n50 SMITH AVE,EXAMPLE CITY,TX,00000,400\n50 SMITH AVE,OTHER EXAMPLE,TX,00001,450\n');
  get('speak-toggle').checked=true;
  const submit=value=>{get('address').value=value;get('search-form').onsubmit({preventDefault(){}});};
  submit('50 Smyth Avenue');assert.match(allText(get('result-area')),/ZIP code/);assert.doesNotMatch(allText(get('result-area')),/\$400/);
  get('talk').onclick();
  const result=[{transcript:'00000'}];result.isFinal=true;activeRecognition.onresult({results:[result]});
  assert.match(allText(get('result-area')),/Did you mean/);assert.match(get('context-value').textContent,/50.*00000/);
  assert.doesNotMatch(utterance.text,/valuation/);
  submit('no');assert.doesNotMatch(allText(get('result-area')),/\$400/);
  submit('actually Smith Avenue');submit('yes');assert.match(allText(get('result-area')),/\$400/);
  get('reset-search').onclick();assert.equal(get('address').value,'');assert.equal(get('search-context').hidden,true);
  submit('50 Smyth Avenue 99999');assert.match(allText(get('result-area')),/ZIP 99999/);
  submit('the ZIP is 00001');assert.match(allText(get('result-area')),/Did you mean/);
  submit('yes');assert.match(allText(get('result-area')),/\$450/);
});
test('00011 synthetic UI: failed published load offers retry and preserves input',async()=>{
  let attempts=0;globalThis.fetch=async()=>++attempts===1?{ok:false,status:503}:{ok:true,text:async()=>csv};
  await import('../dist/app.mjs?published-retry');await new Promise(setImmediate);
  assert.equal(get('retry-data').hidden,false);assert.match(get('notice').textContent,/couldn’t load.*Retry/i);
  get('address').value='100 Example Street';await get('retry-data').onclick();
  assert.equal(attempts,2);assert.equal(get('retry-data').hidden,true);assert.equal(get('address').value,'100 Example Street');
  get('search-form').onsubmit({preventDefault(){}});assert.match(allText(get('result-area')),/\$123,456/);
});
test('00011 synthetic UI: late published response cannot replace a newer imported dataset',async()=>{
  let resolveFetch;globalThis.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
  await import('../dist/app.mjs?published-race');
  await importFile('street,city,state,postal_code,property_value\n200 OTHER EXAMPLE ST,EXAMPLE CITY,TX,00000,200\n');
  get('address').value='200 Other Example Street';resolveFetch({ok:true,text:async()=>csv});await new Promise(setImmediate);
  assert.equal(get('source-name').textContent,'synthetic-example.csv');assert.equal(get('source-note').textContent,'Connected for this session');
  get('search-form').onsubmit({preventDefault(){}});assert.match(allText(get('result-area')),/\$200/);
  globalThis.fetch=async()=>({ok:true,text:async()=>csv});
});
test('00007 synthetic UI: unsupported recognition keeps typed lookup available',async()=>{
  window.SpeechRecognition=undefined;
  await import('../dist/app.mjs?unsupported-speech-test');
  await importFile(csv);
  get('talk').onclick();
  assert.equal(get('panel').dataset.state,'unavailable');
  assert.match(get('voice-description').textContent,/Try Chrome/);
  get('address').value='100 EXAMPLE ST';get('search-form').onsubmit({preventDefault(){}});
  assert.match(allText(get('result-area')),/\$123,456/);
});
