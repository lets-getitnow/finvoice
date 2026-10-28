/**
 * Isolated synthetic regression scenarios; these do not establish live audio or production
 * source accuracy.
 */
// Synthetic source only. No operational data or network.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {makeBroker} from './tool-fixture.mjs';
/** Complete an isolated three-phase tool turn and commit it before checking price disclosure. */
async function turn(b,id,utterance,args={}){let output;for(const tool of ['apply_address_reply','find_address_candidates','choose_clarification'])output=await b.invoke({tool,turn:id,utterance,arguments:args});b.commit(id);return output;}
// Verify unique exact actual address returns its source price immediately.
test('unique exact actual address returns its source price immediately',async()=>{
 const result=await turn(makeBroker(),1,'50 Smith Avenue Fixture City 00000');assert.equal(result.result.kind,'exact');assert.equal(result.result.matches[0].values[0],300);assert.match(result.speech,/\$300/);
});
// Verify explicit Enter submit control is present.
test('explicit Enter submit control is present',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');assert.match(html,/<button[^>]+id="submit"[^>]+type="submit"[^>]*>Enter<\/button>/);
});
// Verify prefix and phonetic suggestions still do not expose a valuation.
test('prefix and phonetic suggestions still do not expose a valuation',async()=>{
 for(const text of ['Mint 32','50 Smyth Avenue Fixture City 00000']){const r=await turn(makeBroker(),1,text);assert.equal(r.result.kind,'choose');assert.ok(r.result.matches.every(r=>r.values===undefined));}
});
// Verify a model-normalized spelling guess cannot become an automatic exact match.
test('a model-normalized spelling guess cannot become an automatic exact match',async()=>{
 const r=await turn(makeBroker(),1,'50 Smyth Avenue Fixture City 00000',{intent:'address',normalized_hint:'50 Smith Avenue Fixture City 00000'});assert.equal(r.result.kind,'choose');assert.equal(r.result.matches[0].values,undefined);
});
