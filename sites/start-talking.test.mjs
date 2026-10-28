/**
 * Isolated synthetic regression scenarios; these do not establish live audio or production
 * source accuracy.
 */
// Synthetic DOM/voice doubles only. No microphone, company file or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountApp} from '../dist/app.mjs';
import {addressTools} from './address-tools.mjs';
import {properties} from './properties.mjs';
import {syntheticSource} from './tool-fixture.mjs';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
/**
 * Minimal DOM double retains properties and children for controller assertions; it does not
 * render or implement browser layout.
 */
class Element{
 /** Initialize a node with mutable text, hidden state, children and data attributes. */
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.hidden=true;this.value='';this.textContent='';}
 /** Append child doubles or replaceChildren with a new subtree; neither method parses HTML. */
 append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}
 /** Capture attributes as properties; querySelector returns a stable label-child double. */
 setAttribute(k,v){this[k]=v;}querySelector(){return this.span??=new Element();}
}
/**
 * Install a fresh DOM and fetch adapter backed by synthetic source APIs. Inject voice methods
 * that record calls and emit lifecycle callbacks; toolTurn executes actual broker phases and
 * commits via controller delivery.
 */
function setup({signedIn=true,connected=false,mount=true}={}){
 /** Resolve only IDs present in the actual page so missing required HTML nodes fail the test. */
 const nodes=new Map();const get=id=>{if(!ids.has(id))return null;if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 globalThis.document={getElementById:get,createElement:tag=>new Element(tag)};globalThis.window={addEventListener(){}};
 const requests=[];
 /**
  * Route search/tool HTTP requests to actual handlers with synthetic identity and source; never
  * use the network.
  */
 globalThis.fetch=async(path,init)=>{
  requests.push({path,body:init?.body&&JSON.parse(init.body)});
  if(path==='/api/address/tools'||path==='/api/search'){
   if(path==='/api/search'&&!connected)return {ok:false};
   const request=new Request('https://synthetic.example'+path,{...init,headers:{...init.headers,Origin:'https://synthetic.example','oai-authenticated-user-id':'synthetic-user'}});
   return (path==='/api/address/tools'?addressTools:properties)(request,{},syntheticSource);
  }
  return {ok:path==='/api/me'||connected,json:async()=>path==='/api/me'?{signedIn}:connected?{stats:{searchable:1}}:{error:'No records connected.'}};
 };
 let options,listens=0,finishes=0,stops=0,spoken=[],resolved=[];
 /**
  * Voice double records stop/listen/finish/resolve/speak; disconnect is inert. Callbacks
  * exercise actual controller state.
  */
 if(mount)mountApp({voiceFactory:o=>{options=o;return {stop(){stops++;o.onCancel();},listen(){listens++;o.onState('listening');},finish(){finishes++;o.onState('processing');},resolve(text){resolved.push(text);o.onCancel();o.onState('processing');},speak(text){spoken.push(text);o.onState('speaking');},disconnect(){}};}});
 return {get,requests,spoken,resolved,async toolTurn(turn,text){let result;for(const tool of ['apply_address_reply','find_address_candidates','choose_clarification'])result=await options.onToolCall({tool,turn,utterance:text,arguments:{preferred_detail:'auto'}});options.onAddressResult(result,turn);spoken.push(result.speech);options.onState('speaking');return result;},get options(){return options;},get listens(){return listens;},get finishes(){return finishes;},get stops(){return stops;}};
}
// Verify minimal page contains a text input, Enter submit and Speak control.
test('minimal page contains a text input, Enter submit and Speak control',()=>{
 assert.equal([...html.matchAll(/<button\b/g)].length,2);
 assert.equal([...html.matchAll(/<input\b/g)].length,1);
 assert.match(html,/id="address"[^>]*type="text"/);
 assert.doesNotMatch(html,/Import CSV|<header|<footer|<aside|orb-wrap|data-strip|speak-toggle/);
});
// Verify LiveKit capture preserves interim/final text events without records.
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
// Verify same button cancels connection or playback; sign-in errors remain recoverable.
test('same button cancels connection or playback; sign-in errors remain recoverable',async()=>{
 const h=setup({signedIn:false});await new Promise(setImmediate);
 h.options.onState('connecting');assert.equal(h.get('talk-label').textContent,'Stop');h.get('talk').onclick();assert.equal(h.stops,1);
 h.options.onError('Sign in to use voice.');assert.equal(h.get('sign-in').hidden,false);assert.match(h.get('status').textContent,/Sign in/);
 h.get('talk').onclick();assert.equal(h.listens,1);
});
// Verify Enter invokes LiveKit resolve and a unique exact match displays its price.
test('Enter invokes LiveKit resolve and a unique exact match displays its price',async()=>{
 const h=setup({connected:true});h.get('address').value='50 Smith Avenue Fixture City 00000';h.get('search-form').onsubmit({preventDefault(){}});
 assert.equal(h.resolved[0],'50 Smith Avenue Fixture City 00000');await h.toolTurn(1,h.resolved[0]);assert.match(h.get('result').textContent,/50 Smith Avenue/);assert.match(h.get('price').textContent,/\$300/);
 h.get('address').value='yes';h.get('search-form').onsubmit({preventDefault(){}});await h.toolTurn(2,'yes');assert.match(h.get('price').textContent,/\$300/);assert.match(h.spoken.at(-1),/valuation/);
});
// Verify published HTML entrypoint mounts the real controller and installs click handlers.
test('published HTML entrypoint mounts the real controller and installs click handlers',async()=>{
 const h=setup({mount:false});
 const {default:worker}=await import('../sites-artifact/dist/server/index.js');
 const published=await (await worker.fetch(new Request('https://synthetic.example/'),{})).text();
 const entry=published.match(/<script type="module" src="([^\"]+)"/)[1];
 await import('../dist/'+entry);await new Promise(setImmediate);
 assert.equal(typeof h.get('talk').onclick,'function');assert.equal(h.get('talk').disabled,false);assert.equal(h.get('submit').disabled,false);
 assert.equal(typeof h.get('search-form').onsubmit,'function');assert.equal(h.requests.length,0,'startup does not gate voice or recommendations on metadata');
});

// Verify typing previews recommendations without speech and keeps context for a choice.
test('typing previews recommendations without speech and keeps context for a choice',async()=>{
 const h=setup({connected:true});
 h.get('address').value='Mint 32';h.get('address').oninput();await new Promise(resolve=>setTimeout(resolve,300));
 assert.equal(h.get('choices-panel').hidden,false);assert.equal(h.get('choices').children.length,2);assert.equal(h.get('price').hidden,true);assert.equal(h.spoken.length,0);
 h.get('address').value='option 1';h.get('search-form').onsubmit({preventDefault(){}});await new Promise(setImmediate);
 assert.equal(h.resolved.at(-1),'option 1');await h.toolTurn(1,'option 1');const applied=h.requests.find(r=>r.body?.tool==='apply_address_reply');assert.deepEqual(applied.body.history,['Mint 32']);
});

// Verify query changes clear the price and zero-valued matches remain visible.
test('query changes clear the price and zero-valued matches remain visible',async()=>{
 const h=setup();await h.toolTurn(1,'70 Zero Way Fixture City 00000');assert.equal(h.get('price').hidden,false);assert.match(h.get('price').textContent,/\$0/);
 h.get('address').value='Mint';h.get('address').oninput();assert.equal(h.get('price').hidden,true);h.get('address').value='';h.get('address').oninput();
});
// Verify conflicting source prices are shown as a conflict without a chosen headline price.
test('conflicting source prices are shown as a conflict without a chosen headline price',async()=>{
 const h=setup();await h.toolTurn(1,'80 Conflict Road Fixture City 00000');assert.equal(h.get('price').hidden,true);assert.match(h.get('result').textContent,/Conflicting valuations.*\$100.*\$200/);
});

/** Recursively collect literal subtree text for card-content assertions. */
const content=node=>[node.textContent,...node.children.map(content)].join(' ');
/**
 * Drive input and wait beyond its 250 ms debounce; return the currently rendered synthetic
 * cards.
 */
const previewChoices=async(h,value='Mint 32')=>{h.get('address').value=value;h.get('address').oninput();await new Promise(resolve=>setTimeout(resolve,300));return [...h.get('choices').children];};
// Verify 00013: address cards select through LiveKit tools and switch prices without another submit.
test('00013: address cards select through LiveKit tools and switch prices without another submit',async()=>{
 const h=setup({connected:true}),cards=await previewChoices(h);
 assert.equal(cards.length,2);assert.match(h.get('choices-hint').textContent,/ZIP code.*\nSelect an address/);assert.equal(cards[0].tagName,'BUTTON');assert.equal(cards[0].type,'button');
 assert.match(content(cards[0]),/3220 Mint Drive.*Fixture City.*00000.*View price/);
 assert.match(cards[0]['aria-label'],/Option 1.*3220 Mint Drive.*Show price/);
 assert.equal(h.get('price').hidden,true);assert.equal(h.resolved.length,0);
 cards[0].onclick();assert.deepEqual(h.resolved,['option 1']);assert.equal(cards[0].dataset.loading,'true');assert.equal(h.get('choices')['aria-busy'],'true');
 await h.toolTurn(1,h.resolved.at(-1));assert.equal(h.get('price').textContent,'$100');assert.equal(h.get('price').hidden,false);
 assert.equal(cards[0]['aria-pressed'],'true');assert.equal(cards[0].dataset.loading,'false');assert.match(content(cards[0]),/Selected/);
 assert.equal(h.get('answer').dataset.matched,'true');assert.match(h.get('result').textContent,/3220 Mint Drive/);
 cards[1].onclick();assert.equal(h.resolved.at(-1),'option 2');assert.equal(h.get('price').hidden,true);
 await h.toolTurn(2,h.resolved.at(-1));assert.equal(h.get('price').textContent,'$200');assert.match(h.get('result').textContent,/3221 Mint Drive/);
 assert.equal(cards[0]['aria-pressed'],'false');assert.equal(cards[1]['aria-pressed'],'true');
 const starts=h.requests.filter(r=>r.body?.tool==='apply_address_reply');assert.deepEqual(starts.map(r=>r.body.history),[['Mint 32'],['Mint 32']]);
});
// Verify 00013: removed cards and cancelled tool results cannot price a newer query.
test('00013: removed cards and cancelled tool results cannot price a newer query',async()=>{
 const h=setup({connected:true}),cards=await previewChoices(h);cards[0].onclick();
 await h.options.onToolCall({tool:'apply_address_reply',turn:1,utterance:'option 1',arguments:{}});
 await h.options.onToolCall({tool:'find_address_candidates',turn:1,utterance:'option 1',arguments:{}});
 const oldResult=await h.options.onToolCall({tool:'choose_clarification',turn:1,utterance:'option 1',arguments:{}});
 h.get('address').value='';h.get('address').oninput();
 assert.equal(h.get('choices-panel').hidden,true);cards[1].onclick();assert.equal(h.resolved.length,1);
 assert.equal(h.options.onAddressResult(oldResult,1),false);assert.equal(h.get('price').hidden,true);assert.equal(h.get('answer').hidden,true);
});
// Verify 00013: a failed selection is retryable and source conflicts never get a headline price.
test('00013: a failed selection is retryable and source conflicts never get a headline price',async()=>{
 const h=setup({connected:true}),cards=await previewChoices(h);cards[0].onclick();
 h.options.onError('Address tools timed out. Please try again.');assert.equal(cards[0].dataset.loading,'false');assert.match(h.get('status').textContent,/try again/);
 cards[0].onclick();await h.toolTurn(2,h.resolved.at(-1));assert.equal(h.get('price').textContent,'$100');
 const conflict=await previewChoices(h,'80 Conflict');conflict[0].onclick();await h.toolTurn(3,h.resolved.at(-1));
 assert.equal(h.get('price').hidden,true);assert.match(h.get('result').textContent,/Conflicting valuations.*\$100.*\$200/);
});
