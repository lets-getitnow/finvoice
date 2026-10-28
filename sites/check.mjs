/**
 * Integration checks against a locally built Worker, not live deployment evidence.
 * Requires the fingerprint-pinned company-data artifact; isolated synthetic tuples
 * exercise lookup/decoding and synthetic credentials exercise token boundaries.
 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { default: worker } = await import('../sites-artifact/dist/server/index.js');
/**
 * Build same-origin Requests with optional JSON body and synthetic platform identity for Worker
 * checks.
 */
const createTestRequest = (pathname, requestBody, syntheticUserId) =>
  new Request('https://finvoice.test' + pathname, {
    method: requestBody ? 'POST' : 'GET',
    headers: {
      ...(requestBody
        ? {
            Origin: 'https://finvoice.test',
            'Content-Type': 'application/json',
          }
        : {}),
      ...(syntheticUserId
        ? {
            'oai-authenticated-user-id': syntheticUserId,
          }
        : {}),
    },
    body: requestBody ? JSON.stringify(requestBody) : undefined,
  });
assert.equal((await worker.fetch(createTestRequest('/'), {})).status, 200);
assert.equal((await worker.fetch(createTestRequest('/healthz'), {})).status, 200);
for (const pathname of [
  '/data/properties.csv',
  '/private-data/properties.csv',
  '/server/index.js',
  '/dist/server/index.js',
])
  assert.equal((await worker.fetch(createTestRequest(pathname), {})).status, 404);
for (const pathname of [
  '/api/dataset',
  '/api/search',
  '/api/import/begin',
  '/api/import/chunk',
  '/api/import/commit',
])
  assert.equal((await worker.fetch(createTestRequest(pathname, {}, null), {})).status, 401);
for (const pathname of ['/api/import/begin', '/api/import/chunk', '/api/import/commit'])
  assert.equal(
    (await worker.fetch(createTestRequest(pathname, {}, 'synthetic-user'), {})).status,
    404,
  );
assert.equal(
  (
    await worker.fetch(
      new Request('https://finvoice.test/api/search', {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example',
          'oai-authenticated-user-id': 'synthetic-user',
        },
        body: '{}',
      }),
      {},
    )
  ).status,
  403,
);
const datasetMetadata = await (
  await worker.fetch(createTestRequest('/api/dataset', null, 'synthetic-user'), {})
).json();
const approvedSourceMetadata = JSON.parse(await readFile('.openai/property-source.json', 'utf8'));
assert.equal(datasetMetadata.sourceHash, approvedSourceMetadata.sha256);
assert.equal(datasetMetadata.stats.sourceRows, approvedSourceMetadata.source_rows);
assert.equal(datasetMetadata.stats.searchable, approvedSourceMetadata.searchable_addresses);
assert.equal(datasetMetadata.records, undefined);
assert.equal(datasetMetadata.groups, undefined);
const { properties } = await import('./properties.mjs');
const { decodeHouse } = await import('./server-data.mjs');
const { gzipSync } = await import('node:zlib');
/**
 * Compressed synthetic record tuple used only with the injected test source.
 */
const compressedSyntheticHouseGroup = gzipSync(
  JSON.stringify([[0, '123 Example Street', 'Fixture City', 'TX', '75001', [123456]]]),
).toString('base64');
const syntheticPropertySource = {
  info: () => ({
    stats: {
      searchable: 1,
    },
  }),
  load: (house) => decodeHouse(house === '123' ? compressedSyntheticHouseGroup : null),
};
for (const syntheticUserId of ['synthetic-owner', 'synthetic-second-visitor']) {
  const response = await properties(
    createTestRequest(
      '/api/search',
      {
        history: ['123 Example Street'],
      },
      syntheticUserId,
    ),
    {},
    syntheticPropertySource,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).matches[0].values, undefined);
  const confirmed = await properties(
    createTestRequest(
      '/api/search',
      {
        history: ['123 Example Street', 'yes'],
      },
      syntheticUserId,
    ),
    {},
    syntheticPropertySource,
  );
  assert.equal((await confirmed.json()).matches[0].values[0], 123456);
}
const noMatch = await properties(
  createTestRequest(
    '/api/search',
    {
      history: ['999 Unknown Street'],
    },
    'synthetic-user',
  ),
  {},
  syntheticPropertySource,
);
assert.equal((await noMatch.json()).kind, 'none');
console.log(
  'Server dataset fingerprint/metadata, no browser CSV, disabled uploads, authenticated automatic lookup and synthetic decoding checks passed.',
);
assert.equal((await worker.fetch(createTestRequest('/voice-session.mjs'), {})).status, 200);
assert.equal((await worker.fetch(createTestRequest('/livekit-sdk.mjs'), {})).status, 200);
assert.equal(
  (await worker.fetch(createTestRequest('/api/voice/session', {}, null), {})).status,
  401,
);
assert.equal(
  (await worker.fetch(createTestRequest('/api/voice/session', {}, 'synthetic-owner'), {})).status,
  503,
);
assert.equal(
  (await worker.fetch(createTestRequest('/api/voice/session', null, 'synthetic-owner'), {})).status,
  405,
);
/**
 * Explicit synthetic signing inputs; these do not connect to LiveKit.
 */
const voiceEnv = {
  LIVEKIT_URL: 'wss://synthetic.example',
  LIVEKIT_API_KEY: 'synthetic-test-key',
  LIVEKIT_API_SECRET: 'synthetic-test-secret',
};
const minted = await worker.fetch(
  createTestRequest('/api/voice/session', {}, 'synthetic-owner'),
  voiceEnv,
);
assert.equal(minted.status, 200);
const details = await minted.json();
const tokenClaims = JSON.parse(Buffer.from(details.token.split('.')[1], 'base64url').toString());
assert.equal(tokenClaims.exp - tokenClaims.nbf, 300);
assert.ok(tokenClaims.video.room.startsWith('finvoice-'));
assert.equal(tokenClaims.roomConfig.agents[0].agentName, 'finvoice');
assert.deepEqual(tokenClaims.video.canPublishSources, ['microphone']);
assert.equal(tokenClaims.video.roomAdmin, undefined);
const verificationKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(voiceEnv.LIVEKIT_API_SECRET),
  {
    name: 'HMAC',
    hash: 'SHA-256',
  },
  false,
  ['verify'],
);
const tokenSegments = details.token.split('.');
assert.ok(
  await crypto.subtle.verify(
    'HMAC',
    verificationKey,
    Buffer.from(tokenSegments[2], 'base64url'),
    new TextEncoder().encode(tokenSegments[0] + '.' + tokenSegments[1]),
  ),
);
assert.equal(
  (
    await worker.fetch(
      new Request('https://finvoice.test/api/voice/session', {
        method: 'POST',
        headers: {
          Origin: 'https://evil.example',
          'oai-authenticated-user-id': 'synthetic-owner',
        },
      }),
      voiceEnv,
    )
  ).status,
  403,
);
console.log(
  'LiveKit assets, session auth/origin/method boundaries and signed five-minute room-scoped grants passed (synthetic credentials).',
);
