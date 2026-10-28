/**
 * Read the generated Worker-only SERVER_DATA constant; no CSV or source groups
 * are served directly to the browser. Caches are small insertion-ordered isolate-local
 * maps, not persistent stores. Build-time data must come from the fingerprint-pinned export.
 */
import {streetNameScore} from '../dist/resolver.mjs';
import {normalize} from '../dist/lookup.mjs';
/**
 * Keep at most eight decoded house groups; cache hits do not refresh eviction order.
 */
const houseCache=new Map();
/**
 * Keep at most sixteen fuzzy street-name searches; exact index hits bypass this cache.
 */
const streetMatchCache=new Map();
/**
 * Return source name, aggregate stats and approved source hash without returning records or
 * encoded groups.
 */
export function serverInfo(){return {name:'Company property records',stats:SERVER_DATA.stats,sourceHash:SERVER_DATA.sourceHash};}
/**
 * Decode base64 gzip tuples into normalized records; absent groups return empty.
 * Decompression/JSON errors propagate to the endpoint.
 */
export async function decodeHouse(encoded){
 if(!encoded)return [];
 const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
 const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 return JSON.parse(text).map(([id,street,city,state,postal_code,values])=>({id,street,city,state,postal_code,values,streetKey:normalize(street),cityKey:normalize(city),zipKey:normalize(postal_code)}));
}
/**
 * Load a house group from the generated constant, reusing the bounded decoded cache.
 */
export async function loadHouse(house){
 if(houseCache.has(house))return houseCache.get(house);
 const records=await decodeHouse(SERVER_DATA.groups[house]);
 if(houseCache.size>=8)houseCache.delete(houseCache.keys().next().value);
 houseCache.set(house,records);return records;
}

/**
 * Return at most 24 indexed candidate IDs for a 2–80-character normalized name and optional
 * house prefix. Rank fuzzy names, then decode only the selected house groups.
 */
export async function recommendRecords({house='',name=''}){
 if(!name||name.length<2||name.length>80)return [];
 let names;
 if(Object.hasOwn(SERVER_DATA.streetGroups,name))names=[{street:name,score:1}];
 else if(streetMatchCache.has(name))names=streetMatchCache.get(name);
 else{names=[];for(const street in SERVER_DATA.streetGroups){const score=streetNameScore(name,street);if(score>0)names.push({street,score});}names.sort((a,b)=>b.score-a.score||a.street.localeCompare(b.street));if(streetMatchCache.size>=16)streetMatchCache.delete(streetMatchCache.keys().next().value);streetMatchCache.set(name,names);}
 const candidates=[];
 for(const entry of names){
  for(const [number,id] of SERVER_DATA.streetGroups[entry.street]){
   if(house&&!number.startsWith(house))continue;
   candidates.push({number,id});if(candidates.length>=24)break;
  }
  if(candidates.length>=24)break;
 }
 const records=[];
 for(const number of new Set(candidates.map(c=>c.number))){const ids=new Set(candidates.filter(c=>c.number===number).map(c=>c.id));records.push(...(await loadHouse(number)).filter(r=>ids.has(r.id)));}
 return records;
}
