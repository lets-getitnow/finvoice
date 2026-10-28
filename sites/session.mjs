const encode = value => btoa(typeof value === 'string' ? value : String.fromCharCode(...value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const json = (body, status=200) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function session(request, env) {
  if (request.method !== 'POST') return json({error:'Method not allowed'},405);
  if (!request.headers.get('oai-authenticated-user-id')) return json({error:'Sign in to use voice.'},401);
  if (request.headers.get('Origin') !== new URL(request.url).origin || ![null,'same-origin'].includes(request.headers.get('Sec-Fetch-Site'))) return json({error:'Voice sessions require a same-origin request.'},403);
  if (!['LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET'].every(k=>env[k])) return json({error:'LiveKit is not configured. Typed search still works.'},503);
  let url; try { url=new URL(env.LIVEKIT_URL); } catch { return json({error:'Invalid LiveKit configuration.'},503); }
  if(url.protocol !== 'wss:' || url.username || url.password) return json({error:'Invalid LiveKit configuration.'},503);
  const identity='browser-'+crypto.randomUUID(), room='finvoice-'+crypto.randomUUID(), now=Math.floor(Date.now()/1000);
  const claims={iss:env.LIVEKIT_API_KEY,sub:identity,nbf:now,exp:now+300,video:{roomJoin:true,room,canPublish:true,canSubscribe:true,canPublishData:true,canPublishSources:['microphone']},roomConfig:{emptyTimeout:60,departureTimeout:20,maxParticipants:2,agents:[{agentName:env.LIVEKIT_AGENT_NAME||'finvoice',metadata:JSON.stringify({participant:identity})}]}};
  const input=encode(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+encode(JSON.stringify(claims));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.LIVEKIT_API_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(input));
  return json({url:env.LIVEKIT_URL,identity,token:input+'.'+encode(new Uint8Array(signature))});
}
