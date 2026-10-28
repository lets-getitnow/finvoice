import {resolveAddress} from './address-resolver.mjs';
import {AddressConversation} from '../dist/resolver.mjs';
import {serverInfo,loadHouse,recommendRecords} from './server-data.mjs';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function properties(request,env,source={info:serverInfo,load:loadHouse,recommend:recommendRecords}){
 const path=new URL(request.url).pathname,owner=request.headers.get('oai-authenticated-user-id');
 if(path==='/api/me')return reply({signedIn:!!owner});
 if(!owner)return reply({error:'Sign in with ChatGPT to search property records.'},401);
 if(path.startsWith('/api/import/'))return reply({error:'Not found.'},404);
 try{
  if(path==='/api/dataset'&&request.method==='GET')return reply(source.info());
  if(path!=='/api/search')return reply({error:'Not found.'},404);
  if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')!==new URL(request.url).origin)return reply({error:'Same-origin request required.'},403);
  if(Number(request.headers.get('Content-Length')||0)>50000)return reply({error:'Request too large.'},413);
  const text=await request.text();if(text.length>50000)return reply({error:'Request too large.'},413);
  const b=JSON.parse(text);
  if(!Array.isArray(b.history)||!b.history.length||b.history.length>24||!b.history.every(q=>typeof q==='string'&&q.length<=250))return reply({error:'Start a new search and enter an address.'},400);
  const result=await resolveAddress(b.history,source,{requireConfirmation:true});
  const rejected=new Set(Array.isArray(b.rejected_ids)?b.rejected_ids.filter(Number.isSafeInteger).slice(0,96):[]);
  result.matches=result.matches.filter(r=>!rejected.has(r.id));
  if(result.kind!=='confirmed')result.matches=result.matches.map(({values,...record})=>record);
  return reply(result);
 }catch{return reply({error:'Property records could not be loaded. Please try again.'},503);}
}
