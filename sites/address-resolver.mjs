/**
 * Server-side replay of bounded utterance history over a source adapter.
 * The adapter loads house groups and optional street recommendations; values stay
 * server-side until the calling endpoint projects an authorized result.
 */
import {AddressConversation} from '../dist/resolver.mjs';
/**
 * Union source-backed candidates across address turns, replay a fresh prefix-enabled
 * conversation and return its result plus hasMore/rejected metadata. requireConfirmation demotes
 * implicit exact results during replay; explicit choices still confirm.
 */
export async function resolveAddress(history,source,{requireConfirmation=false}={}){
  const pool=new Map();let house='',name='';const parser=new AddressConversation([]);
  for(const q of history){
   if(/^(?:(?:the |option |number )?(?:first|second|third)(?: one| option)?|option [123]|yes|yeah|correct|confirm|no|nope|neither|none)$/i.test(q.trim())||(house&&/^[123]$/.test(q.trim())))continue;
   const parts=parser.parse(q);
   if(parts.name&&parts.house){house=parts.house;name=parts.name;}
   else {if(parts.house)house=parts.house;if(parts.name)name=parts.name;}
   if(house)for(const r of await source.load(house))pool.set(r.id,r);
   if(name&&source.recommend)for(const r of await source.recommend({house:parts.name&&!parts.house?'':house,name}))pool.set(r.id,r);
  }
  const records=[...pool.values()];
  const conversation=new AddressConversation(records,{allowHousePrefix:true});let result=conversation.reset();for(const q of history){result=conversation.respond(q);if(requireConfirmation&&result.kind==='exact'){result={...result,kind:'choose',field:'confirm'};conversation.pending=result;}}
  return {...result,hasMore:result.total>result.matches.length,rejected:[...conversation.rejected]};
}
