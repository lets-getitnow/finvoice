// Synthetic browser/SDK timing only; no real microphone, network or source data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {VoiceSession} from '../dist/voice-session.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(setImmediate);
function harness({capture,load,connect,publish,startAudio}={}){
 const states=[],errors=[],rooms=[],order=[];
 class Room{constructor(){rooms.push(this);this.remoteParticipants=new Map([['agent',{identity:'synthetic-agent',kind:'agent',metadata:'{"finvoiceReady":true,"toolsVersion":1}'}]]);this.localParticipant={registerRpcMethod(){},performRpc:async()=>{order.push('control');},publishTrack:async track=>{order.push('publish');await publish?.(track);},unpublishTrack:async()=>{order.push('unpublish');}};}on(){return this;}async connect(){await connect?.();}async startAudio(){await startAudio?.();}async disconnect(){this.disconnected=true;}}
 const sdk={Room,RoomEvent:{},ParticipantKind:{AGENT:'agent'},Track:{Kind:{Audio:'audio'},Source:{Microphone:'microphone'}}};
 const session=new VoiceSession({captureAudio:()=>{order.push('capture');return capture?.()??Promise.resolve(stream());},loadSDK:async()=>{order.push('sdk');await load?.();return sdk;},request:async()=>({ok:true,json:async()=>({url:'wss://synthetic.example',token:'synthetic'})}),onState:s=>states.push(s),onError:e=>errors.push(e)});
 return {session,states,errors,rooms,order};
}
function stream(){const track={enabled:true,stopped:false,stop(){this.stopped=true;},getConstraints(){return {};}};return {track,getAudioTracks:()=>[track],getTracks:()=>[track]};}
test('00016: cold start requests microphone before SDK/network and publishes after readiness',async()=>{
 const permission=deferred(),sdk=deferred(),s=stream(),h=harness({capture:()=>permission.promise,load:()=>sdk.promise});
 const listening=h.session.listen();assert.equal(h.order[0],'capture');permission.resolve(s);await tick();assert.equal(s.track.enabled,false);assert.equal(h.order.includes('publish'),false);
 sdk.resolve();await listening;assert.equal(h.session.listening,true);assert.equal(s.track.enabled,true);assert.ok(h.order.indexOf('control')<h.order.indexOf('publish'));await h.session.disconnect();assert.equal(s.track.stopped,true);
});
test('00016: cancelled permission grants cannot stop or overwrite a retry',async()=>{
 const old=deferred(),newer=deferred(),a=stream(),b=stream();let calls=0;
 const h=harness({capture:()=>++calls===1?old.promise:newer.promise});const first=h.session.listen();h.session.stop();const second=h.session.listen();newer.resolve(b);await second;old.resolve(a);await first;
 assert.equal(a.track.stopped,true);assert.equal(b.track.stopped,false);assert.equal(h.session.mic,b.track);assert.equal(h.states.at(-1),'listening');assert.deepEqual(h.errors,[]);await h.session.disconnect();
});
test('00016: cancellation during publication cleans up the original room only',async()=>{
 const publishing=deferred(),s=stream(),h=harness({capture:()=>Promise.resolve(s),publish:()=>publishing.promise});
 const listening=h.session.listen();await tick();h.session.stop();publishing.resolve();await listening;assert.equal(s.track.stopped,true);assert.equal(h.session.listening,false);assert.notEqual(h.states.at(-1),'listening');await h.session.disconnect();
});
test('00016: playback denial does not become microphone denial or block capture',async()=>{
 const h=harness({startAudio:async()=>{throw Object.assign(new Error('synthetic playback'),{name:'NotAllowedError'});}});await h.session.listen();assert.equal(h.session.listening,true);assert.deepEqual(h.errors,[]);await h.session.disconnect();
});
test('00016: microphone denial is accurate and retryable; provider errors stay sanitized',async()=>{
 let denied=true;const h=harness({capture:()=>denied?Promise.reject(Object.assign(new Error('synthetic secret'),{name:'NotAllowedError'})):Promise.resolve(stream())});
 await h.session.listen();assert.match(h.errors[0],/Microphone.*site settings/);assert.doesNotMatch(h.errors[0],/synthetic secret/);denied=false;await h.session.listen();assert.equal(h.session.listening,true);await h.session.disconnect();
 assert.doesNotMatch(h.session.errorText(Object.assign(new Error('secret'),{name:'NotAllowedError'})),/Microphone access was blocked|secret/);
});
test('00016: cancelled SDK loading cannot install a stale room over a new connection',async()=>{
 const old=deferred();let loads=0;const h=harness({load:()=>++loads===1?old.promise:Promise.resolve()});
 const first=h.session.ensureConnected().catch(()=>{});await h.session.disconnect();await h.session.ensureConnected();const current=h.session.room;old.resolve();await first;assert.equal(h.session.room,current);assert.equal(h.rooms.length,1);await h.session.disconnect();
});
test('00016: old connection finalization cannot clear a newer pending connection',async()=>{
 const old=deferred(),newer=deferred();let loads=0;const h=harness({load:()=>++loads===1?old.promise:newer.promise});
 const first=h.session.ensureConnected().catch(()=>{});await h.session.disconnect();const second=h.session.ensureConnected();const pending=h.session.connecting;
 old.resolve();await first;assert.equal(h.session.connecting,pending);newer.resolve();await second;await h.session.disconnect();
});
test('00016: connection failure stops already granted capture and a retry works',async()=>{
 const s=stream();let failed=true;const h=harness({capture:()=>Promise.resolve(s),connect:async()=>{if(failed)throw new Error('synthetic provider secret');}});
 await h.session.listen();assert.equal(s.track.stopped,true);assert.equal(h.session.capture,null);assert.equal(h.session.mic,null);assert.doesNotMatch(h.errors[0],/synthetic provider secret|Microphone access was blocked/);
 failed=false;h.session.captureAudio=()=>Promise.resolve(stream());await h.session.listen();assert.equal(h.session.listening,true);await h.session.disconnect();
});
test('00016: playback denial leaves typed resolution usable without requesting microphone',async()=>{
 const h=harness({capture:()=>{throw new Error('typed must not capture');},startAudio:async()=>{throw Object.assign(new Error('synthetic'),{name:'NotAllowedError'});}});
 await h.session.resolve('synthetic address');assert.equal(h.states.at(-1),'processing');assert.deepEqual(h.errors,[]);assert.equal(h.order.includes('capture'),false);await h.session.disconnect();
});
