// Synthetic browser/SDK timing only; no real microphone, network or source data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceSession } from '../dist/voice-session.mjs';
/** Create a controllable promise so tests choose when permission or connection work completes. */
const createDeferredPromise = () => {
  let resolveDeferredPromise, rejectDeferredPromise;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolveDeferredPromise = resolvePromise;
    rejectDeferredPromise = rejectPromise;
  });
  return {
    promise,
    resolve: resolveDeferredPromise,
    reject: rejectDeferredPromise,
  };
};
/** Drain queued callbacks before checking asynchronous lifecycle state. */
const waitForCallbacks = () => new Promise(setImmediate);
/** Inject synthetic capture, room and publication operations; record states/errors/order without real audio or network. */
function createVoiceTestHarness({ capture, load, connect, publish, startAudio } = {}) {
  const capturedStates = [],
    capturedErrors = [],
    createdRooms = [],
    operationOrder = [];
  /** Synthetic LiveKit room records control/publication order and delegates delayed operations to test hooks. */
  class Room {
    constructor() {
      createdRooms.push(this);
      this.remoteParticipants = new Map([
        [
          'agent',
          {
            identity: 'synthetic-agent',
            kind: 'agent',
            metadata: '{"finvoiceReady":true,"toolsVersion":1}',
          },
        ],
      ]);
      this.localParticipant = {
        registerRpcMethod() {},
        performRpc: async () => {
          operationOrder.push('control');
        },
        publishTrack: async (microphoneTrack) => {
          operationOrder.push('publish');
          await publish?.(microphoneTrack);
        },
        unpublishTrack: async () => {
          operationOrder.push('unpublish');
        },
      };
    }
    on() {
      return this;
    }
    async connect() {
      await connect?.();
    }
    async startAudio() {
      await startAudio?.();
    }
    async disconnect() {
      this.disconnected = true;
    }
  }
  const livekitSdk = {
    Room,
    RoomEvent: {},
    ParticipantKind: {
      AGENT: 'agent',
    },
    Track: {
      Kind: {
        Audio: 'audio',
      },
      Source: {
        Microphone: 'microphone',
      },
    },
  };
  const voiceSession = new VoiceSession({
    captureAudio: () => {
      operationOrder.push('capture');
      return capture?.() ?? Promise.resolve(createSyntheticAudioStream());
    },
    loadSDK: async () => {
      operationOrder.push('sdk');
      await load?.();
      return livekitSdk;
    },
    request: async () => ({
      ok: true,
      json: async () => ({
        url: 'wss://synthetic.example',
        token: 'synthetic',
      }),
    }),
    onState: (stateName) => capturedStates.push(stateName),
    onError: (errorMessage) => capturedErrors.push(errorMessage),
  });
  return {
    session: voiceSession,
    states: capturedStates,
    errors: capturedErrors,
    rooms: createdRooms,
    order: operationOrder,
  };
}
/** Return one owned synthetic microphone track and a stream whose stop state is observable. */
function createSyntheticAudioStream() {
  const microphoneTrack = {
    enabled: true,
    stopped: false,
    stop() {
      this.stopped = true;
    },
    getConstraints() {
      return {};
    },
  };
  return {
    track: microphoneTrack,
    getAudioTracks: () => [microphoneTrack],
    getTracks: () => [microphoneTrack],
  };
}
test('00016: cold start requests microphone before SDK/network and publishes after readiness', async () => {
  const permission = createDeferredPromise(),
    livekitSdk = createDeferredPromise(),
    microphoneStream = createSyntheticAudioStream(),
    testHarness = createVoiceTestHarness({
      capture: () => permission.promise,
      load: () => livekitSdk.promise,
    });
  const listening = testHarness.session.listen();
  assert.equal(testHarness.order[0], 'capture');
  permission.resolve(microphoneStream);
  await waitForCallbacks();
  assert.equal(microphoneStream.track.enabled, false);
  assert.equal(testHarness.order.includes('publish'), false);
  livekitSdk.resolve();
  await listening;
  assert.equal(testHarness.session.listening, true);
  assert.equal(microphoneStream.track.enabled, true);
  assert.ok(testHarness.order.indexOf('control') < testHarness.order.indexOf('publish'));
  await testHarness.session.disconnect();
  assert.equal(microphoneStream.track.stopped, true);
});
test('00016: cancelled permission grants cannot stop or overwrite a retry', async () => {
  const previousDeferredOperation = createDeferredPromise(),
    retryDeferredOperation = createDeferredPromise(),
    firstStream = createSyntheticAudioStream(),
    retryStream = createSyntheticAudioStream();
  let captureCallCount = 0;
  const testHarness = createVoiceTestHarness({
    capture: () =>
      ++captureCallCount === 1 ? previousDeferredOperation.promise : retryDeferredOperation.promise,
  });
  const first = testHarness.session.listen();
  testHarness.session.stop();
  const second = testHarness.session.listen();
  retryDeferredOperation.resolve(retryStream);
  await second;
  previousDeferredOperation.resolve(firstStream);
  await first;
  assert.equal(firstStream.track.stopped, true);
  assert.equal(retryStream.track.stopped, false);
  assert.equal(testHarness.session.mic, retryStream.track);
  assert.equal(testHarness.states.at(-1), 'listening');
  assert.deepEqual(testHarness.errors, []);
  await testHarness.session.disconnect();
});
test('00016: cancellation during publication cleans up the original room only', async () => {
  const publishing = createDeferredPromise(),
    microphoneStream = createSyntheticAudioStream(),
    testHarness = createVoiceTestHarness({
      capture: () => Promise.resolve(microphoneStream),
      publish: () => publishing.promise,
    });
  const listening = testHarness.session.listen();
  await waitForCallbacks();
  testHarness.session.stop();
  publishing.resolve();
  await listening;
  assert.equal(microphoneStream.track.stopped, true);
  assert.equal(testHarness.session.listening, false);
  assert.notEqual(testHarness.states.at(-1), 'listening');
  await testHarness.session.disconnect();
});
test('00016: playback denial does not become microphone denial or block capture', async () => {
  const testHarness = createVoiceTestHarness({
    startAudio: async () => {
      throw Object.assign(new Error('synthetic playback'), {
        name: 'NotAllowedError',
      });
    },
  });
  await testHarness.session.listen();
  assert.equal(testHarness.session.listening, true);
  assert.deepEqual(testHarness.errors, []);
  await testHarness.session.disconnect();
});
test('00016: microphone denial is accurate and retryable; provider errors stay sanitized', async () => {
  let denied = true;
  const testHarness = createVoiceTestHarness({
    capture: () =>
      denied
        ? Promise.reject(
            Object.assign(new Error('synthetic secret'), {
              name: 'NotAllowedError',
            }),
          )
        : Promise.resolve(createSyntheticAudioStream()),
  });
  await testHarness.session.listen();
  assert.match(testHarness.errors[0], /Microphone.*site settings/);
  assert.doesNotMatch(testHarness.errors[0], /synthetic secret/);
  denied = false;
  await testHarness.session.listen();
  assert.equal(testHarness.session.listening, true);
  await testHarness.session.disconnect();
  assert.doesNotMatch(
    testHarness.session.errorText(
      Object.assign(new Error('secret'), {
        name: 'NotAllowedError',
      }),
    ),
    /Microphone access was blocked|secret/,
  );
});
test('00016: cancelled SDK loading cannot install a stale room over a new connection', async () => {
  const previousDeferredOperation = createDeferredPromise();
  let loads = 0;
  const testHarness = createVoiceTestHarness({
    load: () => (++loads === 1 ? previousDeferredOperation.promise : Promise.resolve()),
  });
  const first = testHarness.session.ensureConnected().catch(() => {});
  await testHarness.session.disconnect();
  await testHarness.session.ensureConnected();
  const current = testHarness.session.room;
  previousDeferredOperation.resolve();
  await first;
  assert.equal(testHarness.session.room, current);
  assert.equal(testHarness.rooms.length, 1);
  await testHarness.session.disconnect();
});
test('00016: old connection finalization cannot clear a newer pending connection', async () => {
  const previousDeferredOperation = createDeferredPromise(),
    retryDeferredOperation = createDeferredPromise();
  let loads = 0;
  const testHarness = createVoiceTestHarness({
    load: () =>
      ++loads === 1 ? previousDeferredOperation.promise : retryDeferredOperation.promise,
  });
  const first = testHarness.session.ensureConnected().catch(() => {});
  await testHarness.session.disconnect();
  const second = testHarness.session.ensureConnected();
  const pending = testHarness.session.connecting;
  previousDeferredOperation.resolve();
  await first;
  assert.equal(testHarness.session.connecting, pending);
  retryDeferredOperation.resolve();
  await second;
  await testHarness.session.disconnect();
});
test('00016: connection failure stops already granted capture and a retry works', async () => {
  const microphoneStream = createSyntheticAudioStream();
  let failed = true;
  const testHarness = createVoiceTestHarness({
    capture: () => Promise.resolve(microphoneStream),
    connect: async () => {
      if (failed) throw new Error('synthetic provider secret');
    },
  });
  await testHarness.session.listen();
  assert.equal(microphoneStream.track.stopped, true);
  assert.equal(testHarness.session.capture, null);
  assert.equal(testHarness.session.mic, null);
  assert.doesNotMatch(
    testHarness.errors[0],
    /synthetic provider secret|Microphone access was blocked/,
  );
  failed = false;
  testHarness.session.captureAudio = () => Promise.resolve(createSyntheticAudioStream());
  await testHarness.session.listen();
  assert.equal(testHarness.session.listening, true);
  await testHarness.session.disconnect();
});
test('00016: playback denial leaves typed resolution usable without requesting microphone', async () => {
  const testHarness = createVoiceTestHarness({
    capture: () => {
      throw new Error('typed must not capture');
    },
    startAudio: async () => {
      throw Object.assign(new Error('synthetic'), {
        name: 'NotAllowedError',
      });
    },
  });
  await testHarness.session.resolve('synthetic address');
  assert.equal(testHarness.states.at(-1), 'processing');
  assert.deepEqual(testHarness.errors, []);
  assert.equal(testHarness.order.includes('capture'), false);
  await testHarness.session.disconnect();
});
