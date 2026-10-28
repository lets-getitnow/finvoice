import {money} from './lookup.mjs';
import {VoiceSession} from './voice-session.mjs';
import {AddressToolSession} from './address-tools.mjs';

export function mountApp({voiceFactory=options=>new VoiceSession(options)}={}){
 const $=id=>document.getElementById(id);
 const tools=new AddressToolSession();
 let mode='ready',suggestionHistory=[],requestVersion=0,previewTimer=null,presented=null,pendingId=null,selectedId=null;
 const selection=value=>/^(?:yes|yeah|correct|confirm|no|nope|(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?)$/i.test(value.trim());
 const show=(id,value)=>{$(id).textContent=value;$(id).hidden=!value;};
 function state(next,message='',error=false){
  mode=next;$('app').dataset.state=next;
  $('talk-label').textContent=next==='listening'?'Finish':['connecting','processing','speaking'].includes(next)?'Stop':'Speak';
  $('talk').setAttribute('aria-pressed',String(next==='listening'));
  $('status').dataset.error=String(error);show('status',message);
 }
 const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
 function clearChoices(){presented=null;pendingId=null;selectedId=null;$('choices').replaceChildren();$('choices-panel').hidden=true;}
 function answer(message,matched=false){$('answer').hidden=!message;$('answer').dataset.matched=String(matched);$('answer-label').hidden=!matched;show('result',message);}
 function updateCards(){
  if(!presented)return;
  $('choices').setAttribute('aria-busy',String(pendingId!==null));
  for(const card of presented.cards){
   const selected=card.record.id===selectedId,loading=card.record.id===pendingId;
   card.button.setAttribute('aria-pressed',String(selected));card.button.dataset.loading=String(loading);
   card.action.textContent=loading?'Loading…':selected?'Selected':'View price';card.arrow.textContent=selected?'✓':'→';
  }
 }
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
  onTranscript(value,final){show('price','');if(!selection(value)){clearChoices();answer('');}show('transcript',`You said: “${value}”`);$('address').value=value;if(final){clearTimeout(previewTimer);++requestVersion;state('processing','Understanding your address…');}else{clearTimeout(previewTimer);++requestVersion;previewTimer=setTimeout(()=>void preview(),300);}},
  onToolCall:payload=>tools.invoke(payload),
  onToolEvent(event){
   if(event.status==='started')state('processing',({apply_address_reply:'Understanding your reply…',find_address_candidates:'Finding possible addresses…',choose_clarification:'Choosing the next question…'})[event.name]||'Working…');
  },
  onAddressResult(result,turn){const committed=tools.commit(turn);if(!committed)return false;suggestionHistory=[];render(committed.result);state('processing','Preparing reply…');return true;},
  onCancel(){tools.cancel();},
  onState(name){state(name,({connecting:'Connecting…',listening:'Listening…',processing:'Working…',speaking:'Speaking…',ready:''})[name]||'');},
  onError(message){tools.cancel();pendingId=null;updateCards();state('ready',message,true);$('sign-in').hidden=!/sign in/i.test(message);}
 });
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
 $('address').oninput=()=>{tools.cancel();if(mode!=='ready'){voice.stop();state('ready');}show('price','');clearChoices();answer('');clearTimeout(previewTimer);++requestVersion;if(!$('address').value.trim()){show('result','');return;}previewTimer=setTimeout(()=>void preview(),250);};
 $('search-form').onsubmit=event=>{event.preventDefault();show('price','');clearChoices();answer('');clearTimeout(previewTimer);++requestVersion;const text=$('address').value.trim();if(text)void voice.resolve(text);};
 $('talk').onclick=()=>{
  if(mode==='listening'){void voice.finish();return;}
  if(['connecting','processing','speaking'].includes(mode)){voice.stop();pendingId=null;updateCards();state('ready');return;}
  clearTimeout(previewTimer);++requestVersion;void voice.listen();
 };
 window.addEventListener('pagehide',()=>{clearTimeout(previewTimer);void voice.disconnect();});
 $('talk').disabled=false;
 $('submit').disabled=false;
}
