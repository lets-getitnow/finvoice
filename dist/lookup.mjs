const aliases = {street:'st',avenue:'ave',drive:'dr',road:'rd',boulevard:'blvd',lane:'ln',court:'ct',circle:'cir',place:'pl',parkway:'pkwy',highway:'hwy',terrace:'ter',trail:'trl',north:'n',south:'s',east:'e',west:'w',texas:'tx',apartment:'apt',suite:'ste'};
const small = {zero:0,oh:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
function numberPhrase(words) {
  if(words.every(w=>small[w]<10)) return words.map(w=>small[w]).join('');
  if(!words.includes('hundred')&&!words.includes('thousand')) {
    const groups=[];
    for(let i=0;i<words.length;i++){
      if(words[i]==='and')continue;
      let n=small[words[i]];
      if(n>=20&&small[words[i+1]]>0&&small[words[i+1]]<10)n+=small[words[++i]];
      groups.push(String(n));
    }
    return groups.join('');
  }
  let total=0,part=0;
  for(const w of words){if(w==='hundred')part=(part||1)*100;else if(w==='thousand'){total+=(part||1)*1000;part=0;}else part+=small[w]||0;}
  return String(total+part);
}
export function normalize(value) {
  let text=String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9#\s]/g,' ').replace(/\s+/g,' ').trim();
  // Only interpret number words at the start of the address; street names stay literal.
  const tokens=text.split(' '),run=[];
  while(tokens.length&&(tokens[0] in small||['hundred','thousand','and'].includes(tokens[0])))run.push(tokens.shift());
  if(run.length)tokens.unshift(numberPhrase(run));
  return tokens.map(w=>aliases[w]||w).join(' ');
}
export function addressQuery(value) {
  return String(value).trim().replace(/^(?:(?:hi|hello|hey)[,.!]?\s+)?(?:can you |could you |please )?(?:(?:tell me|give me|what(?:'s| is))\s+)?(?:(?:the )?(?:price|valuation|value)(?: of (?:the )?property)?(?:\s+(?:for|of|at))?\s+|(?:look up|find|search for)\s+|(?:the )?address is\s+)/i,'').replace(/\s+(?:please|worth)[?.!]*$/i,'').replace(/[?.!]+$/,'');
}
export function parseCSV(text) {
  const rows=[];let row=[],field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||!field)quoted=!quoted;else throw new Error('Unexpected quote in CSV. Export the file as CSV again.');}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw new Error('The CSV has an unclosed quoted field. Export the file again.');
  row.push(field);if(row.some(v=>v.trim()))rows.push(row);
  const headers=rows.shift()?.map(v=>v.trim().toLowerCase())||[];
  const required=['street','city','state','postal_code','property_value'];
  if(required.some(k=>!headers.includes(k)))throw new Error('CSV needs street, city, state, postal_code and property_value columns.');
  const clean=v=>!v||v.trim().toLowerCase()==='null'?'':v.trim();
  const groups=new Map();let missingStreet=0,invalidValue=0,duplicates=0,sourceRows=0;
  for(const cells of rows){
    if(cells.length!==headers.length)throw new Error('A CSV row has the wrong number of columns. Export the file again.');
    sourceRows++;
    const r=Object.fromEntries(required.map(k=>[k,clean(cells[headers.indexOf(k)])]));
    if(!r.street){missingStreet++;continue;}
    const price=r.property_value.replace(/[$,]/g,'');
    if(!/^\d+(?:\.\d{1,2})?$/.test(price)||!Number.isSafeInteger(Math.round(Number(price)*100))){invalidValue++;continue;}
    const key=required.slice(0,4).map(k=>normalize(r[k])).join('|');
    if(!groups.has(key))groups.set(key,{...r,id:groups.size,values:[],count:0,streetKey:normalize(r.street),cityKey:normalize(r.city),zipKey:normalize(r.postal_code)});
    const record=groups.get(key);const value=Number(price);
    if(record.values.includes(value))duplicates++;else record.values.push(value);
    record.count++;
  }
  const records=[...groups.values()];
  if(!records.length)throw new Error('No usable street addresses with valid valuations were found. Check the export.');
  return {records,stats:{sourceRows,missingStreet,invalidValue,duplicates,searchable:records.length,conflicts:records.filter(r=>r.values.length>1).length,cities:new Set(records.map(r=>r.city).filter(Boolean)).size}};
}
export function search(records,raw,limit=8){
  const query=normalize(addressQuery(raw));
  if(!query)return {kind:'empty',matches:[],total:0};
  if(/^\d{5}$/.test(query)){
    const matches=records.filter(r=>r.zipKey===query);
    return {kind:matches.length?'choose':'none',matches:matches.slice(0,limit),total:matches.length};
  }
  const q=query.split(' '), exact=[],partial=[];
  for(const r of records){
    const full=[r.streetKey,r.cityKey,normalize(r.state),r.zipKey].filter(Boolean).join(' ');
    const street=r.streetKey.split(' ');
    // Numeric house numbers must match exactly. Suggestions never silently change a number.
    if(/^\d/.test(q[0])&&street[0]!==q[0])continue;
    if(full===query||r.streetKey===query||[r.streetKey,r.cityKey].filter(Boolean).join(' ')===query||[r.streetKey,r.cityKey,'tx',r.zipKey].filter(Boolean).join(' ')===query||[r.streetKey,r.cityKey,r.zipKey].filter(Boolean).join(' ')===query)exact.push(r);
    else if(q.every(t=>full.split(' ').some(v=>v===t||(!/^\d/.test(t)&&v.startsWith(t)))))partial.push(r);
  }
  if(exact.length===1&&partial.length===0)return {kind:'exact',matches:exact,total:1};
  const matches=[...exact,...partial];
  return {kind:matches.length?'choose':'none',matches:matches.slice(0,limit),total:matches.length};
}
export function displayAddress(r){return [r.street,[r.city,r.state||''].filter(Boolean).join(', '),r.postal_code].filter(Boolean).join(' · ');}
export const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2,minimumFractionDigits:0}).format(value);
