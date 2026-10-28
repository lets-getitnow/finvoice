import {money} from './lookup.mjs';
import {VoiceSession} from './voice-session.mjs';
import {AddressToolSession} from './address-tools.mjs';

export function mountApp({voiceFactory=options=>new VoiceSession(options)}={}){
 const $=id=>document.getElementById(id);
 const tools=new AddressToolSession();
 let mode='ready',suggestionHistory=[],requestVersion=0,previewTimer=null;
 const selection=value=>/^(?:yes|yeah|correct|confirm|no|nope|(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?)$/i.test(value.trim());
 const show=(id,value)=>{$(id).textContent=value;$(id).hidden=!value;};
 function state(next,message='',error=false){
  mode=next;$('app').dataset.state=next;
  $('talk-label').textContent=next==='listening'?'Finish':['connecting','processing','speaking'].includes(next)?'Stop':'Speak';
  $('talk').setAttribute('aria-pressed',String(next==='listening'));
  $('status').dataset.error=String(error);show('status',message);
 }
 function render(result){
  let message=result.prompt||'';
  if(result.kind==='confirmed'){
   const record=result.matches[0],address=[record.street,record.city,record.state,record.postal_code].filter(Boolean).join(', ');
   message=record.values.length===1?`${address}\n${money(record.values[0])}`:`${address}\nConflicting valuations: ${record.values.map(money).join(', ')}. Check the source records.`;
  }else if(result.matches?.length){
   message+='\n'+result.matches.map((record,i)=>`${i+1}. ${[record.street,record.city,record.postal_code].filter(Boolean).join(', ')}`).join('\n');
  }
  show('result',message);
 }
 const voice=voiceFactory({
  onTranscript(value,final){show('transcript',`You said: “${value}”`);$('address').value=value;if(final){clearTimeout(previewTimer);++requestVersion;state('processing','Understanding your address…');}else{clearTimeout(previewTimer);++requestVersion;previewTimer=setTimeout(()=>void preview(),300);}},
  onToolCall:payload=>tools.invoke(payload),
  onToolEvent(event){
   if(event.status==='started')state('processing',({apply_address_reply:'Understanding your reply…',find_address_candidates:'Finding possible addresses…',choose_clarification:'Choosing the next question…'})[event.name]||'Working…');
  },
  onAddressResult(result,turn){const committed=tools.commit(turn);if(!committed)return false;suggestionHistory=[];render(committed.result);state('processing','Preparing reply…');return true;},
  onCancel(){tools.cancel();},
  onState(name){state(name,({connecting:'Connecting…',listening:'Listening…',processing:'Working…',speaking:'Speaking…',ready:''})[name]||'');},
  onError(message){tools.cancel();state('ready',message,true);$('sign-in').hidden=!/sign in/i.test(message);}
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
   const choices=(result.matches||[]).slice(0,3).map((record,i)=>`${i+1}. ${[record.street,record.city,record.postal_code].filter(Boolean).join(', ')}`);
   show('result',choices.length?'Possible matches — say first, second or third, or add more detail.\n'+choices.join('\n'):result.prompt||'');
  }catch{/* Read-only preview failure must not interrupt voice; committed tool failures are visible. */}
 }
 $('address').oninput=()=>{clearTimeout(previewTimer);++requestVersion;if(!$('address').value.trim()){show('result','');return;}previewTimer=setTimeout(()=>void preview(),250);};
 $('search-form').onsubmit=event=>{event.preventDefault();clearTimeout(previewTimer);++requestVersion;const text=$('address').value.trim();if(text)void voice.resolve(text);};
 $('talk').onclick=()=>{
  if(mode==='listening'){void voice.finish();return;}
  if(['connecting','processing','speaking'].includes(mode)){voice.stop();state('ready');return;}
  clearTimeout(previewTimer);++requestVersion;void voice.listen();
 };
 window.addEventListener('pagehide',()=>{clearTimeout(previewTimer);void voice.disconnect();});
 $('talk').disabled=false;
}
