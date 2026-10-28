import {normalize,addressQuery,displayAddress} from './lookup.mjs';

const suffixes=new Set('st ave dr rd blvd ln ct cir pl pkwy hwy ter trl'.split(' '));
const directions=new Set('n s e w ne nw se sw'.split(' '));
const longDirections={n:'north',s:'south',e:'east',w:'west',ne:'northeast',nw:'northwest',se:'southeast',sw:'southwest'};
const longSuffixes={st:'Street',ave:'Avenue',dr:'Drive',rd:'Road',blvd:'Boulevard',ln:'Lane',ct:'Court',cir:'Circle',pl:'Place',pkwy:'Parkway',hwy:'Highway',ter:'Terrace',trl:'Trail'};
const digits={zero:'0',oh:'0',one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9'};
const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function parts(street){
  const tokens=normalize(street).split(' ').filter(Boolean),result={};
  if(tokens.length>1&&!/^\d/.test(tokens[0])&&/^\d+[a-z]?$/.test(tokens.at(-1)))tokens.unshift(tokens.pop());
  const unitAt=tokens.findIndex(t=>['apt','ste','#','unit'].includes(t));
  if(unitAt>=0){result.unit=tokens.slice(unitAt+1).join('');tokens.splice(unitAt);}
  if(/^\d+[a-z]?$/.test(tokens[0]))result.house=tokens.shift();
  if(directions.has(tokens[0])&&tokens.length>1)result.direction=tokens.shift();
  if(directions.has(tokens.at(-1))&&tokens.length>1)result.postDirection=tokens.pop();
  if(suffixes.has(tokens.at(-1)))result.suffix=tokens.pop();
  if(tokens.length)result.name=tokens.join(' ');
  return result;
}
// Soundex is an uncalibrated retrieval signal, never a disclosure decision.
function soundKey(value){
  const letters=value.replace(/[^a-z]/g,'');if(!letters)return '';
  const groups=['bfpv','cgjkqsxz','dt','l','mn','r'];
  const code=c=>String(groups.findIndex(g=>g.includes(c))+1);
  let out=letters[0],last=code(letters[0]);
  for(const c of letters.slice(1)){const next=code(c);if(next!=='0'&&next!==last)out+=next;if(!'hw'.includes(c))last=next;}
  return (out+'000').slice(0,4);
}
function editDistance(a,b){
  let row=Array.from({length:b.length+1},(_,i)=>i),previous=null;
  for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++){
    next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])next[j]=Math.min(next[j],previous[j-2]+1);
  }previous=row;row=next;}
  return row[b.length];
}
function lexicalName(p){return [longDirections[p.direction],p.name,longDirections[p.postDirection]].filter(Boolean).join('').replace(/\s/g,'');}
function similarity(a,b){
  if(a===b)return 1;if(!a||!b)return 0;
  const length=Math.max(a.length,b.length),ratio=1-editDistance(a,b)/length;
  if(a.length>=3&&b.startsWith(a))return Math.max(.78,ratio);
  if(Math.min(a.length,b.length)>=4&&soundKey(a)===soundKey(b)&&ratio>=.45)return Math.max(.78,ratio);
  return ratio>=.70?ratio:0;
}
function contextLabel(s){return [s.house,s.direction,s.name,s.suffix,s.postDirection,s.unit?`unit ${s.unit}`:'',s.city,s.zip].filter(Boolean).join(' ');}

export class AddressConversation {
  constructor(records,{allowHousePrefix=false}={}){
    this.allowHousePrefix=allowHousePrefix;
    this.slots={};this.cities=[...new Set(records.map(r=>r.cityKey).filter(Boolean))].sort((a,b)=>b.length-a.length);
    this.entries=records.map(record=>({record,p:this.parse(record.street,'source',[record.cityKey].filter(Boolean))}));
    this.byZip=new Map();this.byCity=new Map();
    for(const e of this.entries){for(const [map,key] of [[this.byZip,e.record.zipKey],[this.byCity,e.record.cityKey]]){if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(e);}}
    this.cities=[...this.byCity.keys()].sort((a,b)=>b.length-a.length);this.reset();
  }
  reset(){this.slots={};this.pending=null;this.rejected=new Set();this.mustConfirm=false;return {kind:'empty',matches:[],total:0,context:'',prompt:'Say or type a house number and street name.'};}
  parse(raw,field,knownCities=this.cities){
    let value=raw.toLowerCase().trim().replace(/[?.!]+$/,'');const update={};
    value=value.replace(/\b(?:zip(?:\s*code)?|postal code)(?:\s+is)?\s*[:,-]?\s*((?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\s*){5}|\d{5}(?:-\d{4})?)\b/g,(_,zip)=>{update.zip=/^\d/.test(zip)?zip.slice(0,5):zip.trim().split(/\s+/).map(w=>digits[w]).join('');return ' ';});
    const correction=value.match(/^(?:no[, ]+)?(?:actually[, ]+)?(?:the )?(?:house |street )?number(?: is)?\s+(.+)$|^(?:no[, ]+)(.+?)(?:[, ]+not\b.*)?$/);
    if(correction){const n=normalize(correction[1]||correction[2]);if(/^\d+[a-z]?$/.test(n))return {...update,house:n,correction:true};}
    value=value.replace(/^(?:(?:actually|no|sorry|i meant)[, ]+)+/,'').replace(/^the (?:one|property) in\s+/,'in ').replace(/^(?:the )?(?:city|zip(?: code)?)(?: is)?\s+/,'');
    value=normalize(addressQuery(value));
    if(update.zip&&/^(?:the|is|the is)$/.test(value))value='';
    // Some exports repeat locality inside street. Peel only trailing components,
    // retaining the last supplied ZIP/city and never treating a leading house as ZIP.
    for(let pass=0;pass<3;pass++){
      const before=value,zip=value.match(/(?:^|\s)(\d{5})(?:\s\d{4})?$/);
      if(zip&&(value!==zip[1]||field==='zip'||!this.slots.name)){update.zip??=zip[1];value=value.replace(zip[0],' ').trim();}
      value=value.replace(/(?:^|\s)(?:tx|usa|us)$/,'').trim();
      const inCity=value.match(/\bin\s+(.+)$/);
      if(inCity){update.city??=inCity[1].trim();value=value.slice(0,inCity.index).trim();}
      else for(const city of knownCities){const re=new RegExp(`(?:^|\\s)${escapeRE(city)}$`);if(re.test(value)){update.city??=city;value=value.replace(re,'').trim();break;}}
      if(before===value)break;
    }
    if(field==='city'&&value&&!/^\d/.test(value)&&!update.city){update.city=value;value='';}
    if(!value)return update;
    if(field==='unit'&&/^(?:(?:apt|ste|unit|#)\s*)?[a-z0-9 -]+$/.test(value)&&!/^\d+\s+[a-z]{3}/.test(value)){update.unit=value.replace(/^(?:apt|ste|unit|#)\s*/,'').replace(/\s/g,'');return update;}
    if(suffixes.has(value))return {...update,suffix:value};
    if(directions.has(value))return {...update,direction:value};
    const p=parts(value);return {...update,...p};
  }
  respond(raw,alternatives=[]){
    raw=String(raw).trim().slice(0,250);if(!raw)return this.pending||this.reset();
    const simple=normalize(raw);
    if(/^(?:start over|new search|reset|clear)(?: please)?$/.test(simple))return this.reset();
    const prior=this.pending;
    if(prior?.matches.length===1&&prior.field==='confirm'&&/^(?:yes|yeah|yep|correct|confirm|that s (?:right|it)|yes that s (?:right|it))$/.test(simple))return this.confirm(prior.matches[0]);
    const ordinals={first:0,second:1,third:2,'1':0,'2':1,'3':2,one:0,two:1,three:2};
    const ordinal=simple.match(/^(?:the |option |number )?(first|second|third|[123]|one|two|three)(?: one| option)?$/);
    if(prior?.matches.length&&ordinal&&prior.field!=='unit'&&(prior.field!=='house'||/^(?:the )?(?:first|second|third|option |number )/.test(simple))){
      const r=prior.matches[ordinals[ordinal[1]]];if(r)return this.confirm(r);
    }
    if(prior&&/^(?:no|nope|neither|none|none of those|not that one)$/.test(simple)){
      prior.matches.forEach(r=>this.rejected.add(r.id));this.mustConfirm=true;
      return this.finish({kind:'none',matches:[],total:0,field:'street',prompt:'What street name should I use instead? I’ve kept the house number and locality.'});
    }
    if(/^(?:search|try|check) (?:all zip codes|other zip codes|all cities|everywhere)$/.test(simple)){
      if(simple.includes('cities')||simple.includes('everywhere'))delete this.slots.city;
      delete this.slots.zip;this.mustConfirm=true;this.rejected.clear();
    }else{
      const update=this.parse(raw,prior?.field);
      // Completed results end a lookup. A subsequent street request starts clean;
      // active clarification and explicitly worded corrections retain other slots.
      const completed=prior&&['exact','confirmed'].includes(prior.kind);
      const explicitCorrection=/^(?:actually|no|sorry|i meant)\b/i.test(raw);
      const newStreet=update.name&&(update.house||completed&&!explicitCorrection);
      if(newStreet){this.slots={};this.mustConfirm=false;}
      if(update.name){delete this.slots.suffix;delete this.slots.direction;delete this.slots.postDirection;}
      if(update.correction){delete update.correction;this.mustConfirm=true;}
      this.slots={...this.slots,...update};this.rejected.clear();
    }
    let candidates=this.retrieve(this.slots);
    // Recognizer alternatives only add candidates. They never auto-confirm a transcription.
    if(!candidates.length&&alternatives.length){
      for(const alternate of alternatives.slice(0,2)){const s={...this.slots,...this.parse(alternate,prior?.field)};if(this.slots.zip)s.zip=this.slots.zip;if(this.slots.city)s.city=this.slots.city;
        for(const c of this.retrieve(s))if(!candidates.some(v=>v.record.id===c.record.id))candidates.push({...c,recovered:true});}
      if(candidates.length)this.mustConfirm=true;
    }
    if(!candidates.length){
      const locality=this.slots.zip?` in ZIP ${this.slots.zip}`:this.slots.city?` in ${this.slots.city}`:'';
      return this.finish({kind:'none',matches:[],total:0,field:this.slots.zip?'zip':this.slots.city?'city':'street',prompt:`No matching address yet${locality}. ${locality?'Check that locality, give a correction, or say “search everywhere”.':'Check the house number or street name; you can correct just that detail.'}`});
    }
    const total=candidates.length;
    if(!this.slots.house)return this.finish({kind:'choose',matches:candidates.slice(0,3).map(c=>c.record),total,field:'house',prompt:`What is the house number${this.slots.name?` on ${this.slots.name}`:''}?`});
    if(!this.slots.name)return this.finish({kind:'choose',matches:[],total,field:'street',prompt:'What is the street name?'});
    if(total===1){const c=candidates[0];if(c.exact&&!this.mustConfirm)return this.finish({kind:'exact',matches:[c.record],total,field:null,prompt:''});
      return this.finish({kind:'choose',matches:[c.record],total,field:'confirm',prompt:`Did you mean ${displayAddress(c.record)}? Say yes, no, or give a correction.`});}
    let field=null;
    for(const key of ['zip','city','suffix','direction','unit','house']){
      const values=new Set(candidates.map(c=>key==='zip'?c.record.zipKey:key==='city'?c.record.cityKey:c.p[key]||''));
      if(values.size>1){field=key;break;}
    }
    const questions={zip:'What is the ZIP code?',city:'Which city is the property in?',suffix:'Is it '+[...new Set(candidates.map(c=>longSuffixes[c.p.suffix]||'a street without a suffix'))].slice(0,3).join(' or ')+'?',direction:'Which direction is part of the address: north, south, east, or west?',unit:'What is the apartment or unit number?',house:'What is the house number?',street:'Can you give the full street name?'};
    // Show bounded recommendations while continuing to ask for the missing detail.
    const matches=candidates.slice(0,3).map(c=>c.record);
    const choices=matches.length===2?'first or second':'first, second, or third';
    return this.finish({kind:'choose',matches,total,field:field||'street',prompt:questions[field||'street']+(matches.length?` You can also choose an address below or say the ${choices} one.`:'')});
  }
  retrieve(s,prefix=false){
    let entries=s.zip?(this.byZip.get(s.zip)||[]):s.city?(this.byCity.get(s.city)||[]):this.entries;
    const found=[];
    for(const e of entries){const {record:r,p}=e;
      if(this.rejected.has(r.id)||s.city&&r.cityKey!==s.city||s.house&&(prefix?!p.house?.startsWith(s.house):s.house!==p.house)||s.unit&&s.unit!==p.unit)continue;
      if(s.direction&&p.direction&&s.direction!==p.direction||s.postDirection&&p.postDirection&&s.postDirection!==p.postDirection)continue;
      const sourceName=s.direction&&!p.direction||s.postDirection&&!p.postDirection?lexicalName(s):(s.name||'').replace(/\s/g,'');
      const recordName=s.direction&&!p.direction||s.postDirection&&!p.postDirection?lexicalName(p):(p.name||'').replace(/\s/g,'');
      const score=s.name?similarity(sourceName,recordName):1;if(!score)continue;
      const exact=!prefix&&!!s.house&&s.name===p.name&&s.suffix===p.suffix&&s.direction===p.direction&&s.postDirection===p.postDirection&&s.unit===p.unit;
      found.push({...e,score:score-(s.suffix&&s.suffix!==p.suffix ? .15 : 0),exact,recovered:!exact});
    }
    if(!found.length&&!prefix&&this.allowHousePrefix&&s.house&&s.name)return this.retrieve(s,true);
    const exact=found.filter(c=>c.exact);if(exact.length)return exact;
    const compatible=found.filter(c=>(!s.suffix||s.suffix===c.p.suffix));
    return (compatible.length?compatible:found).sort((a,b)=>b.score-a.score||a.record.id-b.record.id);
  }
  finish(result){result.context=contextLabel(this.slots);this.pending=result;return result;}
  confirm(record){this.slots={...this.parse(record.street,'source',[record.cityKey].filter(Boolean)),city:record.cityKey,zip:record.zipKey};return this.finish({kind:'confirmed',matches:[record],total:1,field:null,prompt:''});}
}

export function streetNameScore(query,name){return similarity(query.replace(/\s/g,''),name.replace(/\s/g,''));}
