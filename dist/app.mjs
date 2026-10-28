/**
 * DOM controller for the current hosted UI. Resolving and speech use an injected
 * VoiceSession; data and confirmation decisions remain server-owned. Text rendering
 * keeps source markup inert. Debounced previews never reveal a headline valuation.
 */
import {money} from './lookup.mjs';
import {VoiceSession} from './voice-session.mjs';
import {AddressToolSession} from './address-tools.mjs';

/**
 * Mount against index.html IDs and enable controls. voiceFactory permits isolated tests; the
 * default creates a LiveKit session. Installs page handlers and owns state until page exit.
 */
export function mountApp({voiceFactory=options=>new VoiceSession(options)}={}){
 /**
  * Resolve the required static DOM contract by ID.
  */
 const $=id=>document.getElementById(id);
 const tools=new AddressToolSession();
 /**
  * Track UI mode, preview generations and displayed/pending/selected card identity; generations
  * suppress stale HTTP previews.
  */
 let mode='ready',suggestionHistory=[],requestVersion=0,previewTimer=null,presented=null,pendingId=null,selectedId=null;
 /**
  * Recognize short yes/no and ordinal replies that retain the displayed choices.
  */
 const selection=value=>/^(?:yes|yeah|correct|confirm|no|nope|(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?)$/i.test(value.trim());
 /**
  * Assign literal text and hide an element when that text is empty.
  */
 const show=(id,value)=>{$(id).textContent=value;$(id).hidden=!value;};
 /**
  * Synchronize app mode, action label, pressed state and recoverable status/error text.
  */
 function state(next,message='',error=false){
  mode=next;$('app').dataset.state=next;
  $('talk-label').textContent=next==='listening'?'Finish':['connecting','processing','speaking'].includes(next)?'Stop':'Speak';
  $('talk').setAttribute('aria-pressed',String(next==='listening'));
  $('status').dataset.error=String(error);show('status',message);
 }
 /**
  * Create a text-only DOM element with an optional CSS class; never interpret source strings as
  * HTML.
  */
 const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
 /**
  * Discard the card snapshot and selection identities, clear nodes and hide the choices panel.
  */
 function clearChoices(){presented=null;pendingId=null;selectedId=null;$('choices').replaceChildren();$('choices-panel').hidden=true;}
 /**
  * Render answer visibility, matched styling and label separately from the price output.
  */
 function answer(message,matched=false){$('answer').hidden=!message;$('answer').dataset.matched=String(matched);$('answer-label').hidden=!matched;show('result',message);}
 /**
  * Reflect pending and selected IDs in accessible button state, action text and loading
  * indicators.
  */
 function updateCards(){
  if(!presented)return;
  $('choices').setAttribute('aria-busy',String(pendingId!==null));
  for(const card of presented.cards){
   const selected=card.record.id===selectedId,loading=card.record.id===pendingId;
   card.button.setAttribute('aria-pressed',String(selected));card.button.dataset.loading=String(loading);
   card.action.textContent=loading?'Loading…':selected?'Selected':'View price';card.arrow.textContent=selected?'✓':'→';
  }
 }
 /**
  * Render at most three safe-integer-ID candidates. Capture their history/result snapshot so
  * card clicks resolve an explicit ordinal through the same tool protocol; removed snapshots
  * cannot act.
  */
 function renderChoices(result,history){
  const records=(result.matches||[]).slice(0,3).filter(r=>Number.isSafeInteger(r.id));
  if(!records.length){clearChoices();return;}
  const snapshot={result,history:[...history],cards:[]};presented=snapshot;pendingId=null;selectedId=null;
  $('choices').replaceChildren();$('choices-panel').hidden=false;
  $('choices-heading').textContent='Possible matches';
  $('choices-hint').textContent=[(result.prompt||'').replace(/You can also choose an address below.*$/,'').trim(),'Select an address to see its price.'].filter(Boolean).join('\n');
  for(const [index,record] of records.entries()){
   const card=text('button','','address-choice');card.type='button';
   card.setAttribute('aria-label',`Option ${index+1}: ${[record.street,record.city,record.state,record.postal_code].filter(Boolean).join(', ')}. Show price.`);
   const number=text('span',String(index+1),'choice-number');number.setAttribute('aria-hidden','true');
   const body=text('span','','choice-copy');body.append(text('strong',record.street,'choice-street'),text('span',[record.city,record.state,record.postal_code].filter(Boolean).join(' · ')||'Locality not provided','choice-locality'));
   if(record.valuationConflict)body.append(text('span','Source values need review','choice-warning'));
   const tail=text('span','','choice-action'),action=text('span','View price','choice-action-label'),arrow=text('span','→','choice-arrow');arrow.setAttribute('aria-hidden','true');tail.append(action,arrow);
   card.append(number,body,tail);
   card.onclick=()=>{
    if(presented!==snapshot)return;
    clearTimeout(previewTimer);++requestVersion;show('price','');answer('');
    pendingId=record.id;selectedId=null;updateCards();
    tools.seedPreview(snapshot.history,snapshot.result);
    $('address').value=[record.street,record.city,record.state,record.postal_code].filter(Boolean).join(', ');
    state('processing','Getting this property’s price…');
    void voice.resolve(`option ${index+1}`);
   };
   snapshot.cards.push({button:card,record,action,arrow});$('choices').append(card);
  }
  updateCards();
 }
 /**
  * Display a committed result. Only exact/confirmed records can show a single finite USD value;
  * preserve zero, disclose conflicts and never choose one conflicting price.
  */
 function render(result){
  show('price','');pendingId=null;
  if(['confirmed','exact'].includes(result.kind)){
   const record=result.matches[0],address=[record.street,record.city,record.state,record.postal_code].filter(Boolean).join(', ');
   const values=Array.isArray(record.values)?record.values.filter(Number.isFinite):[];
   selectedId=record.id;updateCards();
   if(presented)$('choices-hint').textContent='Choose another address to compare.';
   let message=address;
   if(values.length===1)show('price',money(values[0]));
   else message+=values.length>1?`\nConflicting valuations: ${values.map(money).join(', ')}. Check the source records.`:'\nNo valuation is available for this address.';
   answer(message,true);
  }else if(result.matches?.length){answer('');renderChoices(result,tools.history);}
  else{clearChoices();answer(result.prompt||'');}
 }
 const voice=voiceFactory({
  /**
   * Render interim/final text; invalidate pending previews. Interim transcripts debounce read-
   * only suggestions, while final text waits for the worker tool turn.
   */
  onTranscript(value,final){show('price','');if(!selection(value)){clearChoices();answer('');}show('transcript',`You said: “${value}”`);$('address').value=value;if(final){clearTimeout(previewTimer);++requestVersion;state('processing','Understanding your address…');}else{clearTimeout(previewTimer);++requestVersion;previewTimer=setTimeout(()=>void preview(),300);}},
  /**
   * Delegate worker tool RPCs to the broker; the transport validates current agent and turn.
   */
  onToolCall:payload=>tools.invoke(payload),
  /**
   * Show progress for each server tool phase without inventing a lookup result.
   */
  onToolEvent(event){
   if(event.status==='started')state('processing',({apply_address_reply:'Understanding your reply…',find_address_candidates:'Finding possible addresses…',choose_clarification:'Choosing the next question…'})[event.name]||'Working…');
  },
  /**
   * Commit only a completed matching broker turn; return false to reject stale/incomplete
   * delivery.
   */
  onAddressResult(result,turn){const committed=tools.commit(turn);if(!committed)return false;suggestionHistory=[];render(committed.result);state('processing','Preparing reply…');return true;},
  /**
   * Invalidate the broker draft whenever voice work is interrupted.
   */
  onCancel(){tools.cancel();},
  /**
   * Translate transport lifecycle state into the action/status UI.
   */
  onState(name){state(name,({connecting:'Connecting…',listening:'Listening…',processing:'Working…',speaking:'Speaking…',ready:''})[name]||'');},
  /**
   * Cancel pending tool state, release card loading state and expose sign-in recovery when
   * needed.
   */
  onError(message){tools.cancel();pendingId=null;updateCards();state('ready',message,true);$('sign-in').hidden=!/sign in/i.test(message);}
 });
 /**
  * POST bounded history and rejected IDs to read-only search. Ignore obsolete responses and
  * failures, seed candidate history for follow-ups, and render choices without speaking or
  * showing a headline price.
  */
 async function preview(){
  const value=$('address').value.trim();if(!value)return;
  const version=++requestVersion;
  const followup=selection(value)||/^\d+[a-z]?$/.test(value)||/^(?:the )?(?:zip|city|house number|unit)\b/i.test(value);
  const history=[...(followup&&suggestionHistory.length?suggestionHistory:tools.history),value];
  try{
   const response=await fetch('/api/search',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({history,rejected_ids:tools.rejected})});
   if(!response.ok)return;const result=await response.json();if(version!==requestVersion)return;
   if(result.matches?.length&&!selection(value)){suggestionHistory=history;tools.seedPreview(history,result);}
   show('price','');answer('');
   if(result.matches?.length)renderChoices(result,history);else{clearChoices();answer(result.prompt||'');}
  }catch{/* Read-only preview failure must not interrupt voice; committed tool failures are visible. */}
 }
 /**
  * Typing cancels active voice and tool work, clears obsolete prices/cards and debounces
  * recommendations by 250 ms.
  */
 $('address').oninput=()=>{tools.cancel();if(mode!=='ready'){voice.stop();state('ready');}show('price','');clearChoices();answer('');clearTimeout(previewTimer);++requestVersion;if(!$('address').value.trim()){show('result','');return;}previewTimer=setTimeout(()=>void preview(),250);};
 /**
  * Enter cancels preview work and resolves typed text through LiveKit; it does not bypass server
  * confirmation.
  */
 $('search-form').onsubmit=event=>{event.preventDefault();show('price','');clearChoices();answer('');clearTimeout(previewTimer);++requestVersion;const text=$('address').value.trim();if(text)void voice.resolve(text);};
 /**
  * One control finishes capture, stops active work, or starts a fresh listen according to the UI
  * mode.
  */
 $('talk').onclick=()=>{
  if(mode==='listening'){void voice.finish();return;}
  if(['connecting','processing','speaking'].includes(mode)){voice.stop();pendingId=null;updateCards();state('ready');return;}
  clearTimeout(previewTimer);++requestVersion;void voice.listen();
 };
 /**
  * Release debounce timers and disconnect transport when the document leaves.
  */
 window.addEventListener('pagehide',()=>{clearTimeout(previewTimer);void voice.disconnect();});
 $('talk').disabled=false;
 $('submit').disabled=false;
}
