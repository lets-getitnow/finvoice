/**
 * The dynamically imported livekit-sdk.mjs is a vendored LiveKit client bundle (2.23.0);
 * preserve its generated implementation and upstream license notices.
 * LiveKit browser transport: ephemeral room credentials, microphone publication,
 * authorized worker RPCs, transcript events and remote audio. No property data is loaded here.
 * version identifies a user turn; epoch invalidates connection attempts. Both guard late work.
 */
// LiveKit transport; property resolution and CSV data stay outside this module.
/**
 * Displayable application-authored failure. Raw SDK/provider errors are sanitized by errorText.
 */
class VoiceError extends Error {}
/**
 * Own one room/worker, microphone, remote audio elements and per-turn timeout; callbacks let the
 * controller own presentation and address-tool state.
 */
export class VoiceSession {
  /**
   * Inject callbacks, SDK loader and HTTP adapter. Defaults use browser fetch/dynamic import;
   * tools are unavailable until onToolCall is supplied.
   */
  constructor({onTranscript=()=>{},onState=()=>{},onError=()=>{},onToolCall=async()=>{throw new Error('Address tools are not configured.');},onToolEvent=()=>{},onAddressResult=()=>false,onCancel=()=>{},loadSDK=()=>import('./livekit-sdk.mjs'),request=(...args)=>fetch(...args)}={}){
    Object.assign(this,{onTranscript,onState,onError,onToolCall,onToolEvent,onAddressResult,onCancel,loadSDK,request});
    this.version=0;this.epoch=0;this.room=null;this.agent=null;this.connecting=null;
    this.mic=null;this.audio=new Set();this.listening=false;this.timer=null;this.playback=null;
  }
  /**
   * Reuse an established worker connection or coalesce concurrent callers onto one in-flight
   * connection promise.
   */
  async ensureConnected(){
    if(this.room&&this.agent)return;
    if(this.connecting)return this.connecting;
    const epoch=this.epoch;
    this.connecting=this.connect(epoch).finally(()=>{this.connecting=null;});
    return this.connecting;
  }
  /**
   * Request a short-lived same-origin room token, register identity/turn-checked tool RPCs and
   * room events, connect audio and wait up to 15 seconds for compatible worker readiness. Clean
   * up and rethrow on failure.
   */
  async connect(epoch){
    const sdk=await this.loadSDK();
    const response=await this.request('/api/voice/session',{method:'POST',credentials:'same-origin',cache:'no-store'});
    const details=await response.json();
    if(!response.ok)throw new VoiceError(details.error||'Voice service is unavailable. Retry or type your address.');
    const room=new sdk.Room({adaptiveStream:false,dynacast:false});
    this.sdk=sdk;this.room=room;
    // Authorize the ready worker identity and current turn both before and after asynchronous tool execution.
    room.localParticipant.registerRpcMethod('finvoice.address_tool',async data=>{
      if(data.callerIdentity!==this.agent)throw new sdk.RpcError(1401,'Not authorized');
      let payload;try{payload=JSON.parse(data.payload);}catch{throw new sdk.RpcError(1400,'Invalid tool payload');}
      if(data.payload.length>12000||payload.turn!==this.version)throw new sdk.RpcError(1400,'Stale address turn');
      const version=this.version;
      try{
        const result=await this.onToolCall(payload);
        if(version!==this.version)throw new Error('Stale address result');
        return JSON.stringify(result);
      }catch{throw new sdk.RpcError(1500,'Address tool could not complete');}
    });
    // Attach only agent audio; mute by default until the current result has been committed.
    room.on(sdk.RoomEvent.TrackSubscribed,(track,publication,participant)=>{
      if(participant.kind!==sdk.ParticipantKind.AGENT||track.kind!==sdk.Track.Kind.Audio)return;
      const audio=track.attach();audio.autoplay=true;audio.muted=this.playback!==this.version;
      document.body.append(audio);this.audio.add(audio);
      audio.addEventListener('error',()=>this.fail('Audio playback failed. Your answer remains on screen.'));
    });
    // Accept only the ready worker/topic/current ID. Final transcripts release capture; result commitment unlocks playback.
    room.on(sdk.RoomEvent.DataReceived,(bytes,participant,kind,topic)=>{
      if(participant?.identity!==this.agent||topic!=='finvoice.voice')return;
      let message;try{message=JSON.parse(new TextDecoder().decode(bytes));}catch{return;}
      if(message.id!==this.version)return;
      if(message.type==='transcript'&&this.listening){
        if(typeof message.text!=='string')return;
        if(message.final){this.listening=false;this.clearTimer();void this.releaseMic();}
        if(message.final&&!message.text.trim()){this.fail('I didn’t hear an address. Try again or type it below.');return;}
        this.onTranscript(message.text,Boolean(message.final));
        if(message.final){this.onState('processing');this.timer=setTimeout(()=>this.fail('Address tools timed out. Please try again.'),60000);}
      }
      if(message.type==='tool_event'){this.onToolEvent(message);return;}
      if(message.type==='tool_error'){this.fail('Address tools could not complete. Please try again.');return;}
      if(message.type==='address_result'){
        if(this.onAddressResult(message.result,message.id)===false){this.fail('Address result was interrupted. Try again.');return;}
        this.playback=this.version;
        for(const audio of this.audio){audio.muted=false;void audio.play().catch(()=>this.fail('Audio was blocked. Tap Speak to try again.'));}
        this.clearTimer();this.timer=setTimeout(()=>this.fail('Speech playback timed out. Your result remains on screen.'),45000);
      }
      if(message.type==='speech_started')this.onState('speaking');
      if(message.type==='speech_done'){this.playback=null;this.clearTimer();this.onState('ready');}
      if(message.type==='speech_error')this.fail('Speech playback failed. Your answer is on screen; use the speaker button to retry.');
      if(message.type==='input_error')this.fail('LiveKit transcription failed. Retry or type your address.');
    });
    room.on(sdk.RoomEvent.Disconnected,()=>{
      if(this.room!==room)return;
      this.room=null;this.agent=null;this.epoch++;
      this.fail('Voice disconnected. Start talking again to reconnect, or type your address.');
      this.removeAudio();
    });
    room.on(sdk.RoomEvent.Reconnecting,()=>{
      if(this.room===room)this.fail('Voice connection interrupted. Wait for reconnection, then try again.');
    });
    try{
      await room.connect(details.url,details.token);
      await room.startAudio();
      // Poll advertised readiness/toolsVersion within this connection epoch; joining the room alone is insufficient.
      const deadline=Date.now()+15000;
      while(epoch===this.epoch){
        const agent=[...room.remoteParticipants.values()].find(p=>{
          if(p.kind!==sdk.ParticipantKind.AGENT)return false;
          try{return JSON.parse(p.metadata).finvoiceReady===true;}catch{return false;}
        });
        if(agent){if(JSON.parse(agent.metadata).toolsVersion!==1)throw new VoiceError('Address tools are updating. Refresh in a moment.');this.agent=agent.identity;return;}
        if(Date.now()>=deadline)throw new VoiceError('Voice worker did not join. Retry shortly; typed search still works.');
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      throw new VoiceError('Voice connection was cancelled.');
    }catch(error){
      if(this.room===room){this.room=null;this.agent=null;}
      await room.disconnect();this.removeAudio();throw error;
    }
  }
  /**
   * Send an action/id/text envelope to the current worker with an eight-second RPC response
   * timeout; reject if disconnected.
   */
  control(action,id,text){
    if(!this.room||!this.agent)return Promise.reject(new VoiceError('Voice is not connected. Try again.'));
    return this.room.localParticipant.performRpc({destinationIdentity:this.agent,method:'finvoice.control',
      payload:JSON.stringify({action,id,text}),responseTimeout:8000});
  }
  /**
   * Cancel the current per-turn timeout and clear its handle.
   */
  clearTimer(){clearTimeout(this.timer);this.timer=null;}
  /**
   * Detach the owned microphone handle, stop capture and unpublish when possible; tolerate an
   * already disconnected room.
   */
  async releaseMic(){
    const mic=this.mic;this.mic=null;
    if(mic){mic.stop();try{await this.room?.localParticipant.unpublishTrack(mic);}catch{/* Already disconnected. */}}
  }
  /**
   * Silence all attached remote audio without removing tracks.
   */
  mute(){for(const audio of this.audio)audio.muted=true;}
  /**
   * Pause, detach and remove remote audio elements, then clear ownership.
   */
  removeAudio(){for(const audio of this.audio){audio.pause();audio.srcObject=null;audio.remove();}this.audio.clear();}
  /**
   * Cancel the broker callback, advance the turn, mute playback, release capture and best-effort
   * notify the worker. Does not disconnect the room.
   */
  stop(){
    this.onCancel();
    const id=++this.version;this.listening=false;this.playback=null;this.clearTimer();this.mute();
    void this.releaseMic();
    if(this.room&&this.agent)void this.control('stop',id).catch(()=>{});
  }
  /**
   * Invalidate active work before delivering a sanitized failure message to the UI.
   */
  fail(message){this.stop();this.onError(message);}
  /**
   * Start a new turn, connect, tell the worker to listen and publish processed microphone audio.
   * Check generation after each await; auto-finish capture after 20 seconds.
   */
  async listen(){
    this.stop();const id=++this.version;
    this.onState('connecting');
    try{
      await this.ensureConnected();if(id!==this.version)return;
      await this.control('listen',id);if(id!==this.version)return;
      const mic=await this.sdk.createLocalAudioTrack({echoCancellation:true,noiseSuppression:true,autoGainControl:true});
      if(id!==this.version){mic.stop();return;}
      this.mic=mic;this.listening=true;
      await this.room.localParticipant.publishTrack(mic,{source:this.sdk.Track.Source.Microphone});
      if(id!==this.version){mic.stop();await this.room?.localParticipant.unpublishTrack(mic);return;}
      if(!this.listening)return;
      this.onState('listening');
      this.timer=setTimeout(()=>void this.finish(),20000);
    }catch(error){if(id===this.version)this.fail(this.errorText(error));}
  }
  /**
   * Stop current microphone capture and ask the worker to finish transcription; allow eight
   * seconds for a final transcript.
   */
  async finish(){
    if(!this.listening)return;
    const id=this.version;this.clearTimer();this.onState('processing');
    await this.releaseMic();
    try{
      await this.control('finish',id);
      if(id===this.version&&this.listening)this.timer=setTimeout(()=>this.fail('Transcription timed out. Try again or type your address.'),8000);
    }catch(error){if(id===this.version)this.fail(this.errorText(error));}
  }
  /**
   * Resolve typed text through the worker using the same tool flow as speech; wait at most 60
   * seconds for tools.
   */
  async resolve(text){
    this.stop();const id=++this.version;this.onState('connecting');
    try{
      await this.ensureConnected();if(id!==this.version)return;
      await this.room.startAudio();
      await this.control('resolve',id,text);if(id!==this.version)return;
      this.onState('processing');this.timer=setTimeout(()=>this.fail('Address tools timed out. Please try again.'),60000);
    }catch(error){if(id===this.version)this.fail(this.errorText(error));}
  }
  /**
   * Speak explicit text via the worker, enabling remote audio only for this turn and enforcing a
   * 45-second playback timeout.
   */
  async speak(text){
    this.stop();const id=++this.version;this.onState('processing');
    try{
      await this.ensureConnected();if(id!==this.version)return;
      await this.room.startAudio();
      this.playback=id;
      await this.control('speak',id,text);if(id!==this.version||this.playback!==id)return;
      for(const audio of this.audio){audio.muted=false;void audio.play().catch(()=>this.fail('Audio was blocked. Tap the speaker button to retry.'));}
      this.timer=setTimeout(()=>this.fail('Speech playback timed out. Your answer remains on screen.'),45000);
    }catch(error){if(id===this.version)this.fail(this.errorText(error));}
  }
  /**
   * Map browser permission/device errors and authored VoiceErrors to recovery text; never expose
   * raw provider messages or credentials.
   */
  errorText(error){
    if(['NotAllowedError','SecurityError'].includes(error.name))return 'Microphone access was blocked. Allow microphone access in your browser’s site settings, then try again. You can also type the address.';
    if(error.name==='NotFoundError')return 'No microphone was found. Connect one and try again, or type your address.';
    // Only display our own messages, never raw SDK/provider errors or tokens.
    if(error instanceof VoiceError)return error.message;
    return 'Voice could not connect. Check microphone access and your connection, then retry or type your address.';
  }
  /**
   * Cancel the current turn, invalidate connecting work, leave the room and remove audio nodes.
   */
  async disconnect(){
    this.stop();this.epoch++;
    const room=this.room;this.room=null;this.agent=null;
    if(room)await room.disconnect();this.removeAudio();
  }
}
