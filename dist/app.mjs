import {parseCSV,money} from './lookup.mjs';
import {AddressConversation} from './resolver.mjs';
const $=id=>document.getElementById(id);
let dataset=null,recognition=null,listening=false,currentUtterance=null,selected=null,loadVersion=0,voiceVersion=0;
let conversation=null,activePrompt='',publishedLoading=false;
const panel=document.querySelector('.voice-panel');
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
function text(tag,value,className){const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
function icon(name){const e=document.createElementNS('http://www.w3.org/2000/svg','svg');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href',`#${name}`);e.append(use);return e;}
function notice(message){$('notice').textContent=message;$('notice').hidden=!message;}
function state(name,heading,description){panel.dataset.state=name;$('voice-status').textContent=name.toUpperCase();$('voice-heading').textContent=heading;$('voice-description').textContent=description;}
function stopVoice(){voiceVersion++;if(recognition){const r=recognition;recognition=null;r.abort();}listening=false;currentUtterance=null;window.speechSynthesis?.cancel();$('stop-audio').hidden=true;$('talk').querySelector('span').textContent='Start talking';}
function ready(){state('ready',activePrompt?'One more detail.':'Just say the address.',activePrompt||'I’ll find the property and read its valuation back to you.');$('talk').querySelector('span').textContent=activePrompt?'Reply by voice':'Start talking';}
function updateContext(result){
  $('search-context').hidden=!result.context;$('context-value').textContent=result.context;
  $('reset-search').hidden=!result.context;
  const placeholders={zip:'Reply with the ZIP code',city:'Reply with the city',house:'Reply with the house number',unit:'Reply with the unit number',suffix:'Reply with the street type',direction:'Reply with the direction',confirm:'Say yes, no, or give a correction',street:'Reply with the street name or a correction'};
  $('address').placeholder=placeholders[result.field]||'Street address, city or ZIP code';
}
function say(message,force=false){
  if(!$('speak-toggle').checked&&!force)return;
  if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){notice('Speech playback isn’t available here. The valuation is shown on screen.');return;}
  stopVoice();const version=voiceVersion;
  const u=new SpeechSynthesisUtterance(message);currentUtterance=u;u.lang='en-US';u.rate=.96;
  state('speaking',activePrompt?'Let’s find the right house.':'Here’s what I found.',activePrompt||'Reading the imported property record.');$('stop-audio').hidden=false;
  u.onend=()=>{if(version===voiceVersion){currentUtterance=null;$('stop-audio').hidden=true;ready();}};
  u.onerror=e=>{if(version!==voiceVersion)return;currentUtterance=null;$('stop-audio').hidden=true;state('ready','Your answer is on screen.','Use the speaker button to try playback again.');if(!['canceled','interrupted'].includes(e.error))notice('Audio playback didn’t finish. Your result is still available below the search field.');};
  speechSynthesis.speak(u);
}
function empty(title,description){const box=text('div','','empty-result');const mark=text('span','','empty-icon');mark.append(icon('house'));const body=text('div','');body.append(text('h3',title),text('p',description));box.append(mark,body);$('result-area').replaceChildren(box);}
function showRecord(r){
  activePrompt='';selected=r;ready();const area=$('result-area');area.replaceChildren();
  const title=text('div','','result-heading');title.append(text('h3','Property found'),text('span',r.values.length===1?'MATCH CONFIRMED':'REVIEW REQUIRED'));area.append(title);
  const box=text('div','','valuation');box.append(text('div',r.street,'address'),text('div',[r.city,r.state,r.postal_code].filter(Boolean).join(', ')||'City and ZIP not provided','locality'));
  if(r.values.length>1){box.append(text('p',`This address has ${r.values.length} conflicting valuations in the export: ${r.values.map(money).join(', ')}. Check the source system before using a value.`,'error-text'));area.append(box);say(`I found ${r.street}, but the export has conflicting valuations for this address. Please check the source system.`);return;}
  const message=`The imported valuation for ${[r.street,r.city,r.state,r.postal_code].filter(Boolean).join(', ')} is ${money(r.values[0])}.`;
  const replay=text('button','','replay');replay.type='button';replay.setAttribute('aria-label','Read valuation aloud');replay.append(icon('audio'));replay.onclick=()=>say(message,true);
  box.append(replay,text('div',money(r.values[0]),'price'),text('div','IMPORTED PROPERTY VALUATION · USD','price-label'));
  if(!r.city||!r.postal_code)box.append(text('p','This source record is missing a city or ZIP code. Confirm the street address before using it.','error-text'));
  area.append(box);say(message);
}
function runSearch(alternatives=[]){
  stopVoice();ready();selected=null;notice('');
  if(!dataset){notice(publishedLoading?'The published records are loading. Your address is kept above. Try searching again in a moment.':'Records aren’t connected yet. Choose Retry loading, or import a CSV.');if(!publishedLoading)$('retry-data').focus();return;}
  const value=$('address').value;
  if(!value.trim()){empty('Start with a street address.','Include the house number and street name for the closest match.');$('address').focus();return;}
  const result=conversation.respond(value,alternatives);updateContext(result);activePrompt=result.prompt;ready();
  if(result.kind==='empty'){empty('Start with a street address.',result.prompt);return;}
  if(result.kind==='none'){empty('No matching address yet.',result.prompt);say(result.prompt);return;}
  if(['exact','confirmed'].includes(result.kind)){showRecord(result.matches[0]);return;}
  const head=text('div','','result-heading');head.append(text('h3',result.field==='confirm'?'Is this the property?':'Let’s narrow it down.'),text('span',result.matches.length?'CHOOSE OR REPLY':'REPLY TO CONTINUE'));
  const list=text('div','','match-list');
  for(const [i,r] of result.matches.entries()){const button=text('button','','match');button.type='button';const label=text('span','');label.append(text('strong',`${i+1}. ${r.street}`),text('small',[r.city,r.state,r.postal_code].filter(Boolean).join(', ')||'City and ZIP not provided'));button.append(label,icon('arrow'));button.onclick=()=>{stopVoice();updateContext(conversation.confirm(r));showRecord(r);};list.append(button);}
  $('result-area').replaceChildren(head,text('p',result.prompt,'clarification'),list);
  let spoken=result.prompt;
  if(result.matches.length>1)spoken+=' '+result.matches.map((r,i)=>`Option ${i+1}: ${[r.street,r.city,r.postal_code].filter(Boolean).join(', ')}.`).join(' ');
  say(spoken);
}
async function loadCSV(content,name,version){
  // Parse into a new dataset before replacing working records so a failed import is recoverable.
  const next=parseCSV(content);if(version!==loadVersion)return;
  stopVoice();activePrompt='';ready();dataset=next;selected=null;conversation=new AddressConversation(next.records);updateContext(conversation.reset());
  const s=next.stats;
  $('dataset-state').replaceChildren(text('span','','dot'),document.createTextNode('Records connected'));
  $('source-name').textContent=name;$('record-count').textContent=s.sourceRows.toLocaleString();$('city-count').textContent=s.cities.toLocaleString();
  $('source-note').textContent='Connected for this session';
  $('retry-data').hidden=true;
  $('quality').textContent=`User-provided company export; provenance reported by the file owner, not independently verified. ${s.searchable.toLocaleString()} distinct searchable addresses. ${s.missingStreet.toLocaleString()} rows without a street excluded; ${s.invalidValue.toLocaleString()} invalid valuations excluded; ${s.duplicates.toLocaleString()} repeated address/value rows combined; ${s.conflicts.toLocaleString()} addresses with conflicting valuations flagged.`;
  $('examples').replaceChildren();
  for(const r of next.records.filter(r=>r.city&&r.postal_code&&r.values.length===1).slice(0,2)){const b=text('button',r.street);b.type='button';b.onclick=()=>{$('address').value=[r.street,r.city,r.state,r.postal_code].filter(Boolean).join(', ');runSearch();};$('examples').append(b);}
  empty('Your next property starts here.','Search an address or tap an example from your imported records.');notice('');
}
$('search-form').onsubmit=e=>{e.preventDefault();runSearch();};
$('retry-data').onclick=init;
$('reset-search').onclick=()=>{stopVoice();activePrompt='';if(conversation)updateContext(conversation.reset());selected=null;$('address').value='';$('transcript').hidden=true;ready();empty('Start a new property search.','Say or type a house number and street name.');$('address').focus();};
$('import').onclick=()=>$('file').click();
$('file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const version=++loadVersion;notice('Reading your CSV…');$('import').disabled=true;
  try{if(file.size>25*1024*1024)throw new Error('Choose a CSV smaller than 25 MB.');await loadCSV(await file.text(),file.name,version);}
  catch(error){notice(`${error.message}${dataset?' Your previous dataset is still connected.':' Choose Retry loading to reconnect the published records.'}`);if(!dataset)$('retry-data').hidden=false;}
  finally{$('import').disabled=false;$('file').value='';}
};
$('talk').onclick=()=>{
  if(listening){const r=recognition;listening=false;$('talk').querySelector('span').textContent='Start talking';state('processing','Finding your property…','Finishing the address transcription.');r?.stop();return;}
  stopVoice();notice('');
  if(!dataset){notice(publishedLoading?'The published records are loading. Try Start talking again in a moment.':'Records aren’t connected yet. Choose Retry loading, then start talking.');if(!publishedLoading)$('retry-data').focus();return;}
  if(!Recognition){state('unavailable','Type an address to begin.','Voice input isn’t supported in this browser. Try Chrome with microphone access.');$('address').focus();return;}
  const version=voiceVersion;let gotResult=false,hadError=false;
  try{
    const r=new Recognition();recognition=r;r.lang='en-US';r.interimResults=true;r.continuous=false;r.maxAlternatives=3;
    state('connecting','Connecting your microphone…','Allow microphone access if your browser asks.');
    r.onstart=()=>{if(version!==voiceVersion)return;listening=true;state('listening','I’m listening.',activePrompt||'Say the street address, then the city or ZIP if you know it.');$('talk').querySelector('span').textContent='Finish speaking';};
    r.onresult=e=>{if(version!==voiceVersion)return;const transcripts=Array.from(e.results,result=>result[0].transcript);const transcript=transcripts.join(' ').trim();$('transcript').hidden=false;$('transcript').textContent=`You said: “${transcript}”`;$('address').value=transcript;const last=e.results[e.results.length-1];if(last.isFinal){gotResult=true;const prefix=transcripts.slice(0,-1).join(' ');const alternatives=Array.from(last).slice(1,3).map(a=>`${prefix} ${a.transcript}`.trim());runSearch(alternatives);}};
    r.onerror=e=>{if(version!==voiceVersion)return;hadError=true;listening=false;$('talk').querySelector('span').textContent='Start talking';const messages={'not-allowed':'Microphone access was blocked. Allow microphone access in your browser’s site settings, then try again. You can also type the address.','service-not-allowed':'This browser does not allow its speech service here. Try Chrome, or type the address.','audio-capture':'No microphone was found. Connect a microphone and try again, or type the address.','no-speech':'I didn’t hear an address. Try again, or type it below.','network':'The speech service couldn’t connect. Check your connection and try again, or type the address.','aborted':'Listening stopped. Start again when you’re ready.'};state('ready','Let’s try that again.',messages[e.error]||'Voice input didn’t finish. Try again or type your address.');};
    r.onend=()=>{if(version!==voiceVersion)return;recognition=null;listening=false;$('talk').querySelector('span').textContent='Start talking';if(!gotResult&&!hadError)state('ready','Ready when you are.','No complete address was heard. Start again, or search the transcript above.');};
    r.start();
  }catch{state('ready','Voice couldn’t start.','Try Chrome with microphone access, or type your address.');}
};
$('stop-audio').onclick=()=>{stopVoice();ready();};
$('speak-toggle').onchange=()=>{if(!$('speak-toggle').checked){stopVoice();ready();}};
window.addEventListener('pagehide',stopVoice);
if(!Recognition)$('voice-hint').textContent='Voice input unavailable here · Try Chrome or type an address';
async function init(){
  const version=++loadVersion;publishedLoading=true;$('retry-data').disabled=true;notice('');
  if(!dataset){$('dataset-state').textContent='Loading published records…';$('source-note').textContent='Connecting to the published property export…';}
  try{
    // Supply an authorized CSV through the local server or an explicitly configured deployment.
    const response=await fetch('./data/properties.csv',{cache:'no-cache'});
    if(version!==loadVersion)return;
    if(!response.ok)throw new Error('Published export unavailable.');
    await loadCSV(await response.text(),'Published Texas property export',version);
    if(version===loadVersion)$('source-note').textContent='Published records · ready to search';
  }catch{
    if(version!==loadVersion)return;
    if(!dataset){$('dataset-state').textContent='Records not connected';$('source-note').textContent='Retry loading to connect the published records.';}
    $('retry-data').hidden=false;notice('We couldn’t load the published records. Check your connection and choose Retry loading. You can also import a CSV.');
  }finally{publishedLoading=false;$('retry-data').disabled=false;}
}
init();
