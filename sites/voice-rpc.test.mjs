// Synthetic SDK transport; tests the actual browser-side LiveKit RPC handler.
import test from 'node:test';import assert from 'node:assert/strict';
import {VoiceSession} from '../dist/voice-session.mjs';
test('LiveKit RPC admits only current agent/turn, forwards tools and delivers result events',async()=>{
 const rpc=new Map(),handlers=new Map(),received=[],events=[],results=[];
 class RpcError extends Error{constructor(code,message){super(message);this.code=code;}}
 const room={remoteParticipants:new Map([['agent',{identity:'trusted-agent',kind:'agent',metadata:'{"finvoiceReady":true,"toolsVersion":1}'}]]),localParticipant:{registerRpcMethod(name,handler){rpc.set(name,handler);},performRpc:async()=> 'accepted'},on(name,callback){handlers.set(name,callback);},connect:async()=>{},startAudio:async()=>{},disconnect:async()=>{}};
 const sdk={Room:class{constructor(){return room;}},RpcError,RoomEvent:{TrackSubscribed:'track',DataReceived:'data',Disconnected:'disconnect',Reconnecting:'reconnect'},ParticipantKind:{AGENT:'agent'},Track:{Kind:{Audio:'audio'}}};
 const session=new VoiceSession({loadSDK:async()=>sdk,request:async()=>({ok:true,json:async()=>({url:'wss://synthetic.example',token:'synthetic'})}),onToolCall:async p=>{received.push(p);return {tool:p.tool,turn:p.turn};},onToolEvent:e=>events.push(e),onAddressResult:(r,id)=>{results.push(id);return true;}});
 await session.ensureConnected();session.version=7;
 const handler=rpc.get('finvoice.address_tool'),payload=JSON.stringify({tool:'apply_address_reply',turn:7,utterance:'synthetic'});
 await assert.rejects(handler({callerIdentity:'wrong-agent',payload}),/Not authorized/);
 await assert.rejects(handler({callerIdentity:'trusted-agent',payload:JSON.stringify({tool:'apply_address_reply',turn:6})}),/Stale/);
 assert.equal(JSON.parse(await handler({callerIdentity:'trusted-agent',payload})).turn,7);assert.equal(received.length,1);
 const send=message=>handlers.get('data')(new TextEncoder().encode(JSON.stringify(message)),{identity:'trusted-agent'},null,'finvoice.voice');
 send({type:'tool_event',id:7,name:'apply_address_reply',status:'started'});assert.equal(events.length,1);
 send({type:'address_result',id:6,result:{}});assert.deepEqual(results,[]);
 send({type:'address_result',id:7,result:{}});assert.deepEqual(results,[7]);send({type:'speech_done',id:7});
 await session.disconnect();
});
