/**
 * Isolated synthetic regression scenarios; these do not establish live audio or production
 * source accuracy.
 */
// Synthetic SDK transport; tests the actual browser-side LiveKit RPC handler.
import test from 'node:test';
import assert from 'node:assert/strict';
import { VoiceSession } from '../dist/voice-session.mjs';
// Verify LiveKit RPC admits only current agent/turn, forwards tools and delivers result events.
test('LiveKit RPC admits only current agent/turn, forwards tools and delivers result events', async () => {
  const rpc = new Map(),
    handlers = new Map(),
    received = [],
    events = [],
    results = [];
  /** Synthetic SDK error preserves its code and message for RPC boundary assertions. */
  class RpcError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  /**
   * Room double captures RPC/event handlers and advertises one ready agent;
   * connect/audio/disconnect are inert.
   */
  const room = {
    remoteParticipants: new Map([
      [
        'agent',
        {
          identity: 'trusted-agent',
          kind: 'agent',
          metadata: '{"finvoiceReady":true,"toolsVersion":1}',
        },
      ],
    ]),
    localParticipant: {
      registerRpcMethod(name, handler) {
        rpc.set(name, handler);
      },
      performRpc: async () => 'accepted',
    },
    on(name, callback) {
      handlers.set(name, callback);
    },
    connect: async () => {},
    startAudio: async () => {},
    disconnect: async () => {},
  };
  /**
   * SDK adapter returns the synthetic room and the event/kind constants consumed by VoiceSession.
   */
  const sdk = {
    Room: class {
      constructor() {
        return room;
      }
    },
    RpcError,
    RoomEvent: {
      TrackSubscribed: 'track',
      DataReceived: 'data',
      Disconnected: 'disconnect',
      Reconnecting: 'reconnect',
    },
    ParticipantKind: {
      AGENT: 'agent',
    },
    Track: {
      Kind: {
        Audio: 'audio',
      },
    },
  };
  const session = new VoiceSession({
    loadSDK: async () => sdk,
    request: async () => ({
      ok: true,
      json: async () => ({
        url: 'wss://synthetic.example',
        token: 'synthetic',
      }),
    }),
    onToolCall: async (toolPayload) => {
      received.push(toolPayload);
      return {
        tool: toolPayload.tool,
        turn: toolPayload.turn,
      };
    },
    onToolEvent: (element) => events.push(element),
    onAddressResult: (addressResult, turnId) => {
      results.push(turnId);
      return true;
    },
  });
  await session.ensureConnected();
  session.version = 7;
  const handler = rpc.get('finvoice.address_tool'),
    payload = JSON.stringify({
      tool: 'apply_address_reply',
      turn: 7,
      utterance: 'synthetic',
    });
  await assert.rejects(
    handler({
      callerIdentity: 'wrong-agent',
      payload,
    }),
    /Not authorized/,
  );
  await assert.rejects(
    handler({
      callerIdentity: 'trusted-agent',
      payload: JSON.stringify({
        tool: 'apply_address_reply',
        turn: 6,
      }),
    }),
    /Stale/,
  );
  assert.equal(
    JSON.parse(
      await handler({
        callerIdentity: 'trusted-agent',
        payload,
      }),
    ).turn,
    7,
  );
  assert.equal(received.length, 1);
  /** Inject a current-agent voice-topic data packet through the actual registered event handler. */
  const sendVoiceEvent = (message) =>
    handlers.get('data')(
      new TextEncoder().encode(JSON.stringify(message)),
      {
        identity: 'trusted-agent',
      },
      null,
      'finvoice.voice',
    );
  sendVoiceEvent({
    type: 'tool_event',
    id: 7,
    name: 'apply_address_reply',
    status: 'started',
  });
  assert.equal(events.length, 1);
  sendVoiceEvent({
    type: 'address_result',
    id: 6,
    result: {},
  });
  assert.deepEqual(results, []);
  sendVoiceEvent({
    type: 'address_result',
    id: 7,
    result: {},
  });
  assert.deepEqual(results, [7]);
  sendVoiceEvent({
    type: 'speech_done',
    id: 7,
  });
  await session.disconnect();
});
