// Synthetic DOM/voice doubles only. No microphone, company file or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountApp} from '../dist/app.mjs';
import {addressTools} from './address-tools.mjs';
import {syntheticSource} from './tool-fixture.mjs';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
class Element{
 constructor(){this.children=[];this.dataset={};this.hidden=true;this.value='';this.textContent='';}
 append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}
 setAttribute(k,v){this[k]=v;}querySelector(){return this.span??=new Element();}
}
function setup({signedIn=true,connected=false,mount=true}={}){
 const nodes=new Map();const get=id=>{if(!ids.has(id))return null;if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 globalThis.document={getElementById:get};globalThis.window={addEventListener(){}};
 const requests=[];
 globalThis.fetch=async(path,init)=>{requests.push({path,body:init?.body&&JSON.parse(init.body)});if(path==='/api/address/tools')return addressTools(new Request('https://synthetic.example'+path,{...init,headers:{...init.headers,Origin:'https://synthetic.example','oai-authenticated-user-id':'synthetic-user'}}),{},syntheticSource);return {ok:path==='/api/me'||connected,json:async()=>path==='/api/me'?{signedIn}:path==='/api/search'?{kind:'exact',matches:[{street:'123 Synthetic Example Street',city:'Fixture City',state:'TX',postal_code:'00000',values:[123456]}]}:connected?{stats:{searchable:1}}:{error:'No records connected.'}};};
 let options,listens=0,finishes=0,stops=0,spoken=[],resolved=[];
 if(mount)mountApp({voiceFactory:o=>{options=o;return {stop(){stops++;o.onCancel();},listen(){listens++;o.onState('listening');},finish(){finishes++;o.onState('processing');},resolve(text){resolved.push(text);o.onCancel();o.onState('processing');},speak(text){spoken.push(text);o.onState('speaking');},disconnect(){}};}});
 return {get,requests,spoken,resolved,async toolTurn(turn,text){let result;for(const tool of ['apply_address_reply','find_address_candidates','choose_clarification'])result=await options.onToolCall({tool,turn,utterance:text,arguments:{preferred_detail:'auto'}});options.onAddressResult(result,turn);spoken.push(result.speech);options.onState('speaking');return result;},get options(){return options;},get listens(){return listens;},get finishes(){return finishes;},get stops(){return stops;}};
}
test('minimal page contains a text input, Enter submit and Speak control',()=>{
 assert.equal([...html.matchAll(/<button\b/g)].length,2);
 assert.equal([...html.matchAll(/<input\b/g)].length,1);
 assert.match(html,/id="address"[^>]*type="text"/);
 assert.doesNotMatch(html,/Import CSV|<header|<footer|<aside|orb-wrap|data-strip|speak-toggle/);
});
test('LiveKit capture preserves interim/final text events without records',async()=>{
 const h=setup();await new Promise(setImmediate);
 h.get('talk').onclick();assert.equal(h.listens,1);assert.equal(h.get('app').dataset.state,'listening');assert.equal(h.get('talk-label').textContent,'Finish');
 h.options.onTranscript('123 Synthetic',false);assert.equal(h.get('transcript').hidden,false);assert.equal(h.get('transcript').textContent,'You said: “123 Synthetic”');
 h.get('talk').onclick();assert.equal(h.finishes,1);
 h.options.onTranscript('123 Synthetic Example Street',true);
 assert.equal(h.get('address').value,'123 Synthetic Example Street');assert.equal(h.get('talk-label').textContent,'Stop');
 assert.equal(h.requests.some(r=>r.path==='/api/search'),false,'worker runs tools after final transcription');
 await new Promise(setImmediate);
 h.options.onError('Microphone access was blocked. Allow microphone access in site settings.');
 assert.match(h.get('status').textContent,/blocked.*site settings/);
 h.get('talk').onclick();assert.equal(h.listens,2);
});
test('same button cancels connection or playback; sign-in errors remain recoverable',async()=>{
 const h=setup({signedIn:false});await new Promise(setImmediate);
 h.options.onState('connecting');assert.equal(h.get('talk-label').textContent,'Stop');h.get('talk').onclick();assert.equal(h.stops,1);
 h.options.onError('Sign in to use voice.');assert.equal(h.get('sign-in').hidden,false);assert.match(h.get('status').textContent,/Sign in/);
 h.get('talk').onclick();assert.equal(h.listens,1);
});
test('Enter invokes LiveKit resolve and a unique exact match displays its price',async()=>{
 const h=setup({connected:true});h.get('address').value='50 Smith Avenue Fixture City 00000';h.get('search-form').onsubmit({preventDefault(){}});
 assert.equal(h.resolved[0],'50 Smith Avenue Fixture City 00000');await h.toolTurn(1,h.resolved[0]);assert.match(h.get('result').textContent,/50 Smith Avenue/);assert.match(h.get('price').textContent,/\$300/);
 h.get('address').value='yes';h.get('search-form').onsubmit({preventDefault(){}});await h.toolTurn(2,'yes');assert.match(h.get('price').textContent,/\$300/);assert.match(h.spoken.at(-1),/valuation/);
});
test('published HTML entrypoint mounts the real controller and installs click handlers',async()=>{
 const h=setup({mount:false});
 const {default:worker}=await import('../sites-artifact/dist/server/index.js');
 const published=await (await worker.fetch(new Request('https://synthetic.example/'),{})).text();
 const entry=published.match(/<script type="module" src="([^\"]+)"/)[1];
 await import('../dist/'+entry);await new Promise(setImmediate);
 assert.equal(typeof h.get('talk').onclick,'function');assert.equal(h.get('talk').disabled,false);assert.equal(h.get('submit').disabled,false);
 assert.equal(typeof h.get('search-form').onsubmit,'function');assert.equal(h.requests.length,0,'startup does not gate voice or recommendations on metadata');
});

test('typing previews recommendations without speech and keeps context for a choice',async()=>{
 const h=setup({connected:true});
 h.get('address').value='Mint 32';h.get('address').oninput();await new Promise(resolve=>setTimeout(resolve,300));
 assert.match(h.get('result').textContent,/Possible matches/);assert.doesNotMatch(h.get('result').textContent,/\$123/);assert.equal(h.spoken.length,0);
 h.get('address').value='yes';h.get('search-form').onsubmit({preventDefault(){}});await new Promise(setImmediate);
 assert.equal(h.resolved.at(-1),'yes');await h.toolTurn(1,'yes');const applied=h.requests.find(r=>r.body?.tool==='apply_address_reply');assert.deepEqual(applied.body.history,['Mint 32']);
});

test('query changes clear the price and zero-valued matches remain visible',async()=>{
 const h=setup();await h.toolTurn(1,'70 Zero Way Fixture City 00000');assert.equal(h.get('price').hidden,false);assert.match(h.get('price').textContent,/\$0/);
 h.get('address').value='Mint';h.get('address').oninput();assert.equal(h.get('price').hidden,true);h.get('address').value='';h.get('address').oninput();
});
test('conflicting source prices are shown as a conflict without a chosen headline price',async()=>{
 const h=setup();await h.toolTurn(1,'80 Conflict Road Fixture City 00000');assert.equal(h.get('price').hidden,true);assert.match(h.get('result').textContent,/Conflicting valuations.*\$100.*\$200/);
});
