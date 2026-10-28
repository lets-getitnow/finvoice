/**
 * Authenticated server tool API. Model hints interpret replies; source records and
 * actual user confirmation determine value disclosure. History/context travel with
 * each bounded request; no persistent transcript store is created by this module.
 */
import {normalize,money} from '../dist/lookup.mjs';
import {AddressConversation} from '../dist/resolver.mjs';
import {resolveAddress} from './address-resolver.mjs';
import {serverInfo,loadHouse,recommendRecords} from './server-data.mjs';
/**
 * Allow only the three protocol phases; the browser broker enforces their order.
 */
const TOOL_NAMES=['apply_address_reply','find_address_candidates','choose_clarification'];
/**
 * Return JSON with private no-store caching; default status is 200.
 */
const toolJson=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
/**
 * Recognize explicit affirmative utterances after address normalization.
 */
const isYes=value=>/^(?:yes|yeah|yep|correct|confirm|that s right|that s it|yes that s right|yes that s it)$/.test(normalize(value));
/**
 * Recognize explicit selection of one of the three displayed candidates.
 */
const ordinalReply=value=>/^(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?$/.test(normalize(value));
/**
 * Detect negative/rejection language before considering any model-provided hint.
 */
const isNo=value=>/\b(?:no|nope|neither|none|not that one|other one)\b/i.test(value);
/**
 * Identify uncertainty so the same unanswerable field need not be asked repeatedly.
 */
const isUnknown=value=>/\b(?:don'?t know|do not know|dunno|not sure|can'?t remember|no idea|unsure)\b/i.test(value);
/**
 * Allowed spoken-number words for trailing-number repair; arbitrary street words stay literal.
 */
const numberVocabulary='zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and';
/**
 * Repair hesitations, reversed number groups and self-corrections into at most 250 characters.
 * Preserve an established house number when only a street is corrected; other-one replies become
 * rejection.
 */
export function canonicalAddressReply(raw){
 if(/^(?:the )?other one$/i.test(raw.trim()))return 'no';
 const numericCorrection=new AddressConversation([]).parse(raw);
 if(numericCorrection.correction&&numericCorrection.house)return `the house number is ${numericCorrection.house}`;
 let value=raw.trim().replace(/(?<=[a-z])-(?=[a-z])/gi,' ').replace(/^(?:(?:um|uh|erm|okay|well|so)[, ]+)+/i,'');
 const repair=value.match(/^(.*?)\b(?:no|sorry|i meant)\b[, ]*(.+)$/i);
 if(repair&&!isYes(value)){
  const tail=repair[2].replace(/^(?:(?:actually|it is|it's|i said)[, ]*)/i,'').split(/\s+(?:not|instead of)\b/i)[0].trim().replace(/[, ]+$/,'');
  if(/^(?:the )?other one$/i.test(tail))return 'no';
  const parser=new AddressConversation([]),previous=parser.parse(repair[1]),corrected=parser.parse(tail);
  value=previous.house&&!corrected.house?`${previous.house} ${tail}`:`actually ${tail}`;
 }
 const trailing=value.match(new RegExp(`^(.+?)\\s+((?:(?:${numberVocabulary})(?:\\s+|$))+)$`,'i'));
 if(trailing&&/[a-z]/i.test(trailing[1]))value=`${normalize(trailing[2])} ${trailing[1]}`;
 return value.slice(0,250);
}
/**
 * Format nonempty source address components for tool evidence and speech.
 */
const label=r=>[r.street,r.city,r.state,r.postal_code].filter(Boolean).join(', ');
/**
 * Project a source record to public address fields and missing-field indicators. Include numeric
 * values only when confirmed; otherwise expose only the conflict flag.
 */
const publicRecord=(record,confirmed=false)=>({id:record.id,street:record.street,city:record.city,state:record.state,postal_code:record.postal_code,...(confirmed?{values:record.values}:{valuationConflict:record.values.length>1}),missingFields:['city','state','postal_code'].filter(k=>!record[k])});
/**
 * Permit immediate exact release only when the actual nonnegative, nonuncertain reply supplies
 * matching house/name and all street components, with compatible supplied locality; model
 * spelling hints cannot establish this.
 */
export function exactSourceReply(raw,record){
 if(!record||isUnknown(raw)||isNo(raw))return false;
 const parser=new AddressConversation([]);
 const supplied=parser.parse(canonicalAddressReply(raw),'source',[record.cityKey].filter(Boolean));
 const actual=parser.parse(record.street,'source',[record.cityKey].filter(Boolean));
 return !!supplied.house&&!!supplied.name&&['house','name','suffix','direction','postDirection','unit'].every(key=>supplied[key]===actual[key])&&(!supplied.city||supplied.city===record.cityKey)&&(!supplied.zip||supplied.zip===record.zipKey);
}
/**
 * Choose one useful question, avoiding unknown fields. Prefer single-candidate confirmation,
 * then distinguishing fields (or an available fallback); completed records need no question.
 */
function questionFor(result,context,preferred='auto'){
 const records=result.matches||[],unknown=new Set(context.unknown_fields||[]);
 if(['confirmed','exact'].includes(result.kind))return {field:null,text:''};
 if(records.length===1&&!unknown.has('confirm')){
  const r=records[0];const digits=r.street.replace(/^\d+/,number=>number.split('').join('-'));
  return {field:'confirm',text:`Did you mean ${[digits,r.city,r.postal_code].filter(Boolean).join(', ')}? Say yes or no.`};
 }
 if(!records.length){const field=['street','city','house'].find(f=>!unknown.has(f))||'street';return {field,text:({street:'What street name do you remember?',city:'What city do you remember?',house:'What part of the house number do you remember?'})[field]};}
 const parser=new AddressConversation([]);
 const values=Object.fromEntries(['city','suffix','direction','house','unit','zip'].map(field=>[field,[...new Set(records.map(r=>field==='city'?r.city:field==='zip'?r.postal_code:parser.parse(r.street,'source',[r.city].filter(Boolean))[field]||''))].filter(Boolean)]));
 const fields=['city','suffix','direction','house','unit','zip'].filter(f=>!unknown.has(f)&&values[f].length>1);
 const field=fields.includes(preferred)?preferred:fields[0];
 if(!field){const fallback=['city','street','house','unit','zip'].find(f=>!unknown.has(f));return fallback?{field:fallback,text:({city:'Which city do you remember?',street:'What street name do you remember?',house:'What part of the house number do you remember?',unit:'Do you know the unit number?',zip:'Do you know the ZIP code?'})[fallback]}:{field:null,text:'I cannot confirm the address from those details. Please check an address document, or say new search.'};}
 const options=values[field].slice(0,3).map(v=>field==='house'?v.split('').join('-'):v).join(' or ');
 const questions={city:`Is the property in ${options}?`,suffix:`Is the street type ${options}?`,direction:`Is the direction ${options}?`,house:`Is the house number ${options}?`,unit:`Is the unit ${options}?`,zip:`Is the ZIP code ${options}?`};
 return {field,text:questions[field]};
}
/**
 * Handle same-origin authenticated POST tools with bounded body/history/context. Apply
 * interpretations, retrieve source candidates and choose question/speech. Invalid input returns
 * 4xx; unexpected processing failures return sanitized 503. Source adapter injection is for
 * isolated tests.
 */
export async function addressTools(request,env,source={info:serverInfo,load:loadHouse,recommend:recommendRecords}){
 if(!request.headers.get('oai-authenticated-user-id'))return toolJson({error:'Sign in to resolve an address.'},401);
 if(request.method!=='POST')return toolJson({error:'Method not allowed.'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return toolJson({error:'Same-origin request required.'},403);
 try{
  const text=await request.text();if(text.length>20000)return toolJson({error:'Request too large.'},413);
  const b=JSON.parse(text);
  if(!TOOL_NAMES.includes(b.tool)||!Number.isSafeInteger(b.turn)||b.turn<=0||!Array.isArray(b.history)||b.history.length>24||!b.history.every(q=>typeof q==='string'&&q.length<=250))return toolJson({error:'Invalid tool request.'},400);
  const context={last_reply:typeof b.context?.last_reply==='string'?b.context.last_reply.slice(0,250):'',last_question:b.context?.last_question||null,rejected_ids:Array.isArray(b.context?.rejected_ids)?b.context.rejected_ids.filter(Number.isSafeInteger).slice(0,96):[],unknown_fields:Array.isArray(b.context?.unknown_fields)?b.context.unknown_fields.filter(f=>['confirm','house','street','city','zip','suffix','direction','unit'].includes(f)).slice(0,8):[]};
  if(b.tool==='apply_address_reply'){
   if(typeof b.utterance!=='string'||!b.utterance.trim()||b.utterance.length>250)return toolJson({error:'Start a new address search.'},400);
   const raw=b.utterance.trim();context.last_reply=raw;if(b.history.length>=24&&!/^(?:start over|new search|reset|clear)(?: please)?$/i.test(raw))return toolJson({error:'Say new search to start again.'},400);let history=[...b.history],intent='address';
   if(/^(?:start over|new search|reset|clear)(?: please)?$/i.test(raw)){history=[];context.unknown_fields=[];context.rejected_ids=[];context.last_question=null;intent='reset';}
   else if(isUnknown(raw)||(b.args?.intent==='unknown'&&!/\d/.test(normalize(raw))&&!isYes(raw)&&!isNo(raw))){
    intent='unknown';if(context.last_question?.field&&!context.unknown_fields.includes(context.last_question.field))context.unknown_fields.push(context.last_question.field);
   }else{
    let canonical=canonicalAddressReply(raw);
    intent=isNo(raw)?'reject':isYes(raw)?'confirm':/\b(?:actually|sorry|i meant|not)\b/i.test(raw)?'correction':'address';
    // Treat model normalization as an interpretation hint, never as evidence of consent or a source-exact reply.
    const hint=typeof b.args?.normalized_hint==='string'?b.args.normalized_hint.trim().slice(0,250):'';
    const rawParts=new AddressConversation([]).parse(canonical);
    const onlyReject=/^(?:no|nope|neither|none|not that one|the other one|yeah no|yes no)[,.! ]*$/i.test(raw);
    const controlHint=isYes(hint)||isNo(hint)||ordinalReply(hint)||/^(?:reset|clear|new search|start over)$/i.test(hint);
    if(hint&&!isYes(raw)&&!onlyReject&&!controlHint&&['address','correction'].includes(b.args?.intent)){
      const interpreted=canonicalAddressReply(hint),hintParts=new AddressConversation([]).parse(interpreted);
      // A reply to a detail question cannot invent a replacement full address.
      if(!context.last_question?.field||(rawParts.house&&rawParts.name)||!(hintParts.house&&hintParts.name))canonical=interpreted;
    }
    if(!isYes(raw)&&!onlyReject){
      const field=b.args?.intent==='correction'&&b.args?.detail!=='auto'?b.args?.detail:context.last_question?.field;
      const parts=new AddressConversation([]).parse(canonical);
      if(!(parts.house&&parts.name)&&!/^actually\b/i.test(canonical)){
        if(field==='house'&&/^\d+[a-z]?$/.test(normalize(canonical)))canonical=`the house number is ${normalize(canonical)}`;
        if(field==='zip'&&/^\d{5}$/.test(normalize(canonical)))canonical=`the ZIP is ${normalize(canonical)}`;
        if(field==='unit')canonical=`unit ${canonical.replace(/^(?:unit|apt|apartment|suite)\s+/i,'')}`;
        if(field==='city')canonical=`in ${canonical.replace(/^(?:in|the city is|city is)\s+/i,'')}`;
        if(field==='street'&&b.args?.intent==='correction')canonical=`actually ${canonical}`;
      }
    }
    // The model cannot turn an uncertain or negative reply into confirmation.
    if(intent==='reject'&&(canonical==='no'||/^(?:no|nope|neither|none|not that one)$/i.test(raw)))context.rejected_ids=[...new Set([...context.rejected_ids,...(context.last_question?.candidate_ids||[])])].slice(-96);
    history.push(intent==='reject'&&/^\s*(?:yeah|yes)[, ]+no\b/i.test(raw)?'no':canonical);
    if(intent==='correction'||intent==='address')context.unknown_fields=[];
   }
   return toolJson({tool:b.tool,turn:b.turn,history,context,intent});
  }
  // Replay server-backed history with implicit exact release disabled; actual-source matching below is the only automatic exception.
  let resolved=await resolveAddress(b.history,source,{requireConfirmation:true});
  const rejected=new Set(context.rejected_ids);const remaining=(resolved.matches||[]).filter(r=>!rejected.has(r.id));
  if(remaining.length!==(resolved.matches||[]).length)resolved={...resolved,kind:remaining.length?'choose':'none',matches:remaining,total:remaining.length};
  // A yes/ordinal only confirms a record that appeared in the prior question; model hints cannot create that user action.
  const explicitSelection=isYes(context.last_reply)||ordinalReply(context.last_reply);
  const wasOffered=(context.last_question?.candidate_ids||[]).includes(resolved.matches?.[0]?.id);
  if(resolved.kind==='confirmed'&&(!explicitSelection||!wasOffered))resolved={...resolved,kind:'choose',field:'confirm'};
  if(resolved.matches?.length===1&&exactSourceReply(context.last_reply,resolved.matches[0]))resolved={...resolved,kind:'exact'};
  // Redact values before returning either candidate evidence or an unresolved clarification.
  const confirmed=['confirmed','exact'].includes(resolved.kind);
  const records=(resolved.matches||[]).slice(0,3);
  const safeResult={...resolved,matches:records.map(r=>publicRecord(r,confirmed))};
  if(b.tool==='find_address_candidates'){
   const parser=new AddressConversation([]);const requested=parser.parse(b.history.at(-1)||'');
   return toolJson({tool:b.tool,turn:b.turn,result:safeResult,candidates:records.map(r=>({id:r.id,address:label(r),evidence:{housePrefix:!!requested.house&&parser.parse(r.street,'source',[r.city].filter(Boolean)).house!==requested.house,missingFields:['city','postal_code'].filter(k=>!r[k]),valuationConflict:r.values.length>1}})),context});
  }
  const question=questionFor(resolved,context,b.args?.preferred_detail);
  context.last_question={field:question.field,text:question.text,candidate_ids:records.map(r=>r.id)};
  let speech=question.text;
  if(confirmed){const r=records[0];speech=r.values.length===1?`The imported valuation for ${label(r)} is ${money(r.values[0])}.`:`The source has conflicting valuations for ${label(r)}. Please check the company records.`;}
  return toolJson({tool:b.tool,turn:b.turn,history:b.history,context,result:{...safeResult,field:question.field,prompt:question.text},speech});
 }catch{return toolJson({error:'Address tool could not complete. Please try again.'},503);}
}
