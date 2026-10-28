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
  constructor({
    onTranscript = () => {},
    onState = () => {},
    onError = () => {},
    onToolCall = async () => {
      throw new Error('Address tools are not configured.');
    },
    onToolEvent = () => {},
    onAddressResult = () => false,
    onCancel = () => {},
    loadSDK = () => import('./livekit-sdk.mjs'),
    captureAudio = () =>
      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      }),
    request = (...requestArguments) => fetch(...requestArguments),
  } = {}) {
    Object.assign(this, {
      onTranscript,
      onState,
      onError,
      onToolCall,
      onToolEvent,
      onAddressResult,
      onCancel,
      loadSDK,
      captureAudio,
      request,
    });
    this.version = 0;
    this.epoch = 0;
    this.room = null;
    this.agent = null;
    this.connecting = null;
    this.mic = null;
    this.micRoom = null;
    this.capture = null;
    this.audio = new Set();
    this.listening = false;
    this.timer = null;
    this.playback = null;
  }
  /**
   * Reuse an established worker connection or coalesce concurrent callers onto one in-flight
   * connection promise.
   */
  async ensureConnected() {
    if (this.room && this.agent) return;
    if (this.connecting) return this.connecting;
    const connectionEpoch = this.epoch;
    const connectionPromise = this.connect(connectionEpoch).finally(() => {
      if (this.connecting === connectionPromise) this.connecting = null;
    });
    this.connecting = connectionPromise;
    return this.connecting;
  }
  /**
   * Request a short-lived same-origin room token, register identity/turn-checked tool RPCs and
   * room events, connect audio and wait up to 15 seconds for compatible worker readiness. Clean
   * up and rethrow on failure.
   */
  async connect(connectionEpoch) {
    const livekitSdk = await this.loadSDK();
    if (connectionEpoch !== this.epoch) throw new VoiceError('Voice connection was cancelled.');
    const response = await this.request('/api/voice/session', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const sessionCredentials = await response.json();
    if (connectionEpoch !== this.epoch) throw new VoiceError('Voice connection was cancelled.');
    if (!response.ok)
      throw new VoiceError(
        sessionCredentials.error || 'Voice service is unavailable. Retry or type your address.',
      );
    const room = new livekitSdk.Room({
      adaptiveStream: false,
      dynacast: false,
    });
    this.sdk = livekitSdk;
    this.room = room;
    // Authorize the ready worker identity and current turn both before and after asynchronous tool execution.
    room.localParticipant.registerRpcMethod('finvoice.address_tool', async (rpcInvocation) => {
      if (
        this.room !== room ||
        connectionEpoch !== this.epoch ||
        rpcInvocation.callerIdentity !== this.agent
      )
        throw new livekitSdk.RpcError(1401, 'Not authorized');
      let payload;
      try {
        payload = JSON.parse(rpcInvocation.payload);
      } catch {
        throw new livekitSdk.RpcError(1400, 'Invalid tool payload');
      }
      if (rpcInvocation.payload.length > 12000 || payload.turn !== this.version)
        throw new livekitSdk.RpcError(1400, 'Stale address turn');
      const turnId = this.version;
      try {
        const result = await this.onToolCall(payload);
        if (this.room !== room || connectionEpoch !== this.epoch || turnId !== this.version)
          throw new Error('Stale address result');
        return JSON.stringify(result);
      } catch {
        throw new livekitSdk.RpcError(1500, 'Address tool could not complete');
      }
    });
    // Attach only agent audio; mute by default until the current result has been committed.
    room.on(livekitSdk.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (this.room !== room || connectionEpoch !== this.epoch) return;
      if (
        participant.kind !== livekitSdk.ParticipantKind.AGENT ||
        track.kind !== livekitSdk.Track.Kind.Audio
      )
        return;
      const audioElement = track.attach();
      audioElement.autoplay = true;
      audioElement.muted = this.playback !== this.version;
      document.body.append(audioElement);
      this.audio.add(audioElement);
      audioElement.addEventListener('error', () => {
        if (this.room === room && this.audio.has(audioElement))
          this.fail('Audio playback failed. Your answer remains on screen.');
      });
    });
    // Accept only the ready worker/topic/current ID. Final transcripts release capture; result commitment unlocks playback.
    room.on(
      livekitSdk.RoomEvent.DataReceived,
      (messageBytes, participant, packetKind, messageTopic) => {
        if (this.room !== room || connectionEpoch !== this.epoch) return;
        if (participant?.identity !== this.agent || messageTopic !== 'finvoice.voice') return;
        let message;
        try {
          message = JSON.parse(new TextDecoder().decode(messageBytes));
        } catch {
          return;
        }
        if (message.id !== this.version) return;
        if (message.type === 'transcript' && this.listening) {
          if (typeof message.text !== 'string') return;
          if (message.final) {
            this.listening = false;
            this.clearTimer();
            void this.releaseMic();
          }
          if (message.final && !message.text.trim()) {
            this.fail('I didn’t hear an address. Try again or type it below.');
            return;
          }
          this.onTranscript(message.text, Boolean(message.final));
          if (message.final) {
            this.onState('processing');
            this.timer = setTimeout(
              () => this.fail('Address tools timed out. Please try again.'),
              60000,
            );
          }
        }
        if (message.type === 'tool_event') {
          this.onToolEvent(message);
          return;
        }
        if (message.type === 'tool_error') {
          this.fail('Address tools could not complete. Please try again.');
          return;
        }
        if (message.type === 'address_result') {
          if (this.onAddressResult(message.result, message.id) === false) {
            this.fail('Address result was interrupted. Try again.');
            return;
          }
          this.playback = this.version;
          for (const audioElement of this.audio) {
            audioElement.muted = false;
            void audioElement.play().catch(() => {
              if (this.room === room && message.id === this.version)
                this.fail('Audio was blocked. Tap Speak to try again.');
            });
          }
          this.clearTimer();
          this.timer = setTimeout(
            () => this.fail('Speech playback timed out. Your result remains on screen.'),
            45000,
          );
        }
        if (message.type === 'speech_started') this.onState('speaking');
        if (message.type === 'speech_done') {
          this.playback = null;
          this.clearTimer();
          this.onState('ready');
        }
        if (message.type === 'speech_error')
          this.fail(
            'Speech playback failed. Your answer is on screen; use the speaker button to retry.',
          );
        if (message.type === 'input_error')
          this.fail('LiveKit transcription failed. Retry or type your address.');
      },
    );
    room.on(livekitSdk.RoomEvent.Disconnected, () => {
      if (this.room !== room) return;
      this.room = null;
      this.agent = null;
      this.epoch++;
      this.fail('Voice disconnected. Start talking again to reconnect, or type your address.');
      this.removeAudio();
    });
    room.on(livekitSdk.RoomEvent.Reconnecting, () => {
      if (this.room === room)
        this.fail('Voice connection interrupted. Wait for reconnection, then try again.');
    });
    try {
      await room.connect(sessionCredentials.url, sessionCredentials.token);
      if (connectionEpoch !== this.epoch) throw new VoiceError('Voice connection was cancelled.');
      await this.startPlayback(room);
      // Poll advertised readiness/toolsVersion within this connection epoch; joining the room alone is insufficient.
      const workerReadyDeadline = Date.now() + 15000;
      while (connectionEpoch === this.epoch) {
        const agent = [...room.remoteParticipants.values()].find((remoteParticipant) => {
          if (remoteParticipant.kind !== livekitSdk.ParticipantKind.AGENT) return false;
          try {
            return JSON.parse(remoteParticipant.metadata).finvoiceReady === true;
          } catch {
            return false;
          }
        });
        if (agent) {
          if (JSON.parse(agent.metadata).toolsVersion !== 1)
            throw new VoiceError('Address tools are updating. Refresh in a moment.');
          this.agent = agent.identity;
          return;
        }
        if (Date.now() >= workerReadyDeadline)
          throw new VoiceError(
            'Voice worker did not join. Retry shortly; typed search still works.',
          );
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new VoiceError('Voice connection was cancelled.');
    } catch (error) {
      if (this.room === room) {
        this.room = null;
        this.agent = null;
        this.removeAudio();
      }
      await room.disconnect();
      throw error;
    }
  }
  /** Autoplay denial is independent of microphone permission. Keep capture/text
   * usable; explicit playback attempts report any remaining block with audio text. */
  async startPlayback(room) {
    try {
      await room.startAudio();
      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError') return false;
      throw new VoiceError(
        'Audio playback could not start. Try again; you can also type your address.',
      );
    }
  }
  /**
   * Send an action/id/text envelope to the current worker with an eight-second RPC response
   * timeout; reject if disconnected.
   */
  control(action, turnId, speechText) {
    if (!this.room || !this.agent)
      return Promise.reject(new VoiceError('Voice is not connected. Try again.'));
    return this.room.localParticipant.performRpc({
      destinationIdentity: this.agent,
      method: 'finvoice.control',
      payload: JSON.stringify({
        action,
        id: turnId,
        text: speechText,
      }),
      responseTimeout: 8000,
    });
  }
  /**
   * Cancel the current per-turn timeout and clear its handle.
   */
  clearTimer() {
    clearTimeout(this.timer);
    this.timer = null;
  }
  /**
   * Detach the owned microphone handle, stop capture and unpublish when possible; tolerate an
   * already disconnected room.
   */
  async releaseMic() {
    const pendingCaptureStream = this.capture;
    this.capture = null;
    if (pendingCaptureStream) for (const track of pendingCaptureStream.getTracks()) track.stop();
    const microphoneTrack = this.mic,
      room = this.micRoom;
    this.mic = null;
    this.micRoom = null;
    if (microphoneTrack) {
      microphoneTrack.stop();
      try {
        await room?.localParticipant.unpublishTrack(microphoneTrack);
      } catch {
        /* Already disconnected. */
      }
    }
  }
  /**
   * Silence all attached remote audio without removing tracks.
   */
  mute() {
    for (const audioElement of this.audio) audioElement.muted = true;
  }
  /**
   * Pause, detach and remove remote audio elements, then clear ownership.
   */
  removeAudio() {
    for (const audioElement of this.audio) {
      audioElement.pause();
      audioElement.srcObject = null;
      audioElement.remove();
    }
    this.audio.clear();
  }
  /**
   * Cancel the broker callback, advance the turn, mute playback, release capture and best-effort
   * notify the worker. Does not disconnect the room.
   */
  stop() {
    this.onCancel();
    const turnId = ++this.version;
    this.listening = false;
    this.playback = null;
    this.clearTimer();
    this.mute();
    void this.releaseMic();
    if (this.room && this.agent) void this.control('stop', turnId).catch(() => {});
  }
  /**
   * Invalidate active work before delivering a sanitized failure message to the UI.
   */
  fail(message) {
    this.stop();
    this.onError(message);
  }
  /**
   * Request permission in the original tap before SDK/network awaits. Hold capture
   * disabled until the worker is ready; each attempt owns its stream and room.
   * Check generation after each await; auto-finish capture after 20 seconds.
   */
  async listen() {
    this.stop();
    const turnId = ++this.version;
    this.onState('connecting');
    let microphoneStream, microphoneTrack, room;
    try {
      // Invoke getUserMedia synchronously while the browser still has the gesture.
      let captureRequest;
      try {
        captureRequest = this.captureAudio();
      } catch (error) {
        throw new VoiceError(this.errorText(error, 'microphone'));
      }
      microphoneStream = await Promise.resolve(captureRequest).catch((error) => {
        throw new VoiceError(this.errorText(error, 'microphone'));
      });
      if (turnId !== this.version) return;
      const track = microphoneStream.getAudioTracks()[0];
      if (!track)
        throw new VoiceError(
          'No microphone was found. Connect one and try again, or type your address.',
        );
      track.enabled = false;
      this.capture = microphoneStream;
      await this.ensureConnected();
      if (turnId !== this.version) return;
      room = this.room;
      await this.control('listen', turnId);
      if (turnId !== this.version) return;
      // LiveKit's publishTrack/unpublishTrack accept a native MediaStreamTrack;
      // the SDK wraps it internally. Keep the original capture handle for Stop.
      microphoneTrack = track;
      this.capture = null;
      this.mic = microphoneTrack;
      this.micRoom = room;
      this.listening = true;
      await room.localParticipant.publishTrack(microphoneTrack, {
        source: this.sdk.Track.Source.Microphone,
      });
      if (turnId !== this.version) {
        microphoneTrack.stop();
        await room.localParticipant.unpublishTrack(microphoneTrack);
        return;
      }
      if (!this.listening) return;
      track.enabled = true;
      this.onState('listening');
      this.timer = setTimeout(() => void this.finish(), 20000);
    } catch (error) {
      if (turnId === this.version) this.fail(this.errorText(error));
    } finally {
      // Includes delayed permission grants after Stop, errors before wrapping and
      // publication completion after a newer listen has already taken ownership.
      if (
        microphoneStream &&
        (turnId !== this.version || !microphoneTrack || this.mic !== microphoneTrack)
      )
        for (const track of microphoneStream.getTracks()) track.stop();
      if (this.capture === microphoneStream) this.capture = null;
    }
  }
  /**
   * Stop current microphone capture and ask the worker to finish transcription; allow eight
   * seconds for a final transcript.
   */
  async finish() {
    if (!this.listening) return;
    const turnId = this.version;
    this.clearTimer();
    this.onState('processing');
    await this.releaseMic();
    try {
      await this.control('finish', turnId);
      if (turnId === this.version && this.listening)
        this.timer = setTimeout(
          () => this.fail('Transcription timed out. Try again or type your address.'),
          8000,
        );
    } catch (error) {
      if (turnId === this.version) this.fail(this.errorText(error));
    }
  }
  /**
   * Resolve typed text through the worker using the same tool flow as speech; wait at most 60
   * seconds for tools.
   */
  async resolve(speechText) {
    this.stop();
    const turnId = ++this.version;
    this.onState('connecting');
    try {
      await this.ensureConnected();
      if (turnId !== this.version) return;
      await this.startPlayback(this.room);
      if (turnId !== this.version) return;
      await this.control('resolve', turnId, speechText);
      if (turnId !== this.version) return;
      this.onState('processing');
      this.timer = setTimeout(() => this.fail('Address tools timed out. Please try again.'), 60000);
    } catch (error) {
      if (turnId === this.version) this.fail(this.errorText(error));
    }
  }
  /**
   * Speak explicit text via the worker, enabling remote audio only for this turn and enforcing a
   * 45-second playback timeout.
   */
  async speak(speechText) {
    this.stop();
    const turnId = ++this.version;
    this.onState('processing');
    try {
      await this.ensureConnected();
      if (turnId !== this.version) return;
      await this.startPlayback(this.room);
      if (turnId !== this.version) return;
      this.playback = turnId;
      await this.control('speak', turnId, speechText);
      if (turnId !== this.version || this.playback !== turnId) return;
      for (const audioElement of this.audio) {
        audioElement.muted = false;
        void audioElement.play().catch(() => {
          if (turnId === this.version)
            this.fail('Audio was blocked. Tap the speaker button to retry.');
        });
      }
      this.timer = setTimeout(
        () => this.fail('Speech playback timed out. Your answer remains on screen.'),
        45000,
      );
    } catch (error) {
      if (turnId === this.version) this.fail(this.errorText(error));
    }
  }
  /**
   * Map browser permission/device errors and authored VoiceErrors to recovery text; never expose
   * raw provider messages or credentials.
   */
  errorText(error, errorSource = 'voice') {
    if (errorSource === 'microphone' && ['NotAllowedError', 'SecurityError'].includes(error.name))
      return 'Microphone access was blocked. Allow microphone access in your browser’s site settings, then try again. You can also type the address.';
    if (errorSource === 'microphone' && error.name === 'NotFoundError')
      return 'No microphone was found. Connect one and try again, or type your address.';
    if (errorSource === 'microphone' && error.name === 'NotReadableError')
      return 'Your microphone is busy or unavailable. Close other recordings, then try again. You can also type the address.';
    // Only display our own messages, never raw SDK/provider errors or tokens.
    if (error instanceof VoiceError) return error.message;
    return 'Voice could not connect. Check your connection, then retry or type your address.';
  }
  /**
   * Cancel the current turn, invalidate connecting work, leave the room and remove audio nodes.
   */
  async disconnect() {
    this.stop();
    this.epoch++;
    this.connecting = null;
    const room = this.room;
    this.room = null;
    this.agent = null;
    // Remove owned audio before awaiting disconnect, which may overlap a retry.
    this.removeAudio();
    if (room) await room.disconnect();
  }
}
