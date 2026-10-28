/**
 * Build a Worker artifact from handwritten frontend/server modules and an approved
 * private CSV. This script reads the source fingerprint before embedding data, writes
 * only sites-artifact, and must never substitute fixtures for missing company data.
 */
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parseCSV } from '../dist/lookup.mjs';
import { AddressConversation } from '../dist/resolver.mjs';
import { readFile, readdir, mkdir, writeFile, copyFile, cp } from 'node:fs/promises';
/**
 * Asset allowlist: bundle only supported static formats from the top level of dist.
 */
const assetContentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const staticAssets = {};
for (const assetFileName of await readdir('dist')) {
  const fileExtension = assetFileName.slice(assetFileName.lastIndexOf('.'));
  if (assetContentTypes[fileExtension])
    staticAssets['/' + assetFileName] = {
      type: assetContentTypes[fileExtension],
      body: await readFile('dist/' + assetFileName, 'utf8'),
    };
}

/**
 * Load the authorized local export; a missing file or fingerprint mismatch aborts the build.
 */
const companyCsvText = await readFile('private-data/properties.csv', 'utf8');
const approvedSourceMetadata = JSON.parse(await readFile('.openai/property-source.json', 'utf8'));
if (createHash('sha256').update(companyCsvText).digest('hex') !== approvedSourceMetadata.sha256)
  throw new Error('Server CSV does not match the approved source fingerprint.');
const propertyDataset = parseCSV(companyCsvText);
/**
 * Partition source tuples by normalized house number to limit request-time decoding.
 */
const recordsByHouseNumber = new Map();
for (const propertyRecord of propertyDataset.records) {
  const houseNumber = propertyRecord.streetKey.split(' ')[0];
  if (!recordsByHouseNumber.has(houseNumber)) recordsByHouseNumber.set(houseNumber, []);
  recordsByHouseNumber
    .get(houseNumber)
    .push([
      propertyRecord.id,
      propertyRecord.street,
      propertyRecord.city,
      propertyRecord.state,
      propertyRecord.postal_code,
      propertyRecord.values,
    ]);
}
const compressedHouseGroups = Object.fromEntries(
  [...recordsByHouseNumber].map(([houseNumber, records]) => [
    houseNumber,
    gzipSync(JSON.stringify(records)).toString('base64'),
  ]),
);
/**
 * Index parsed street names to house/record IDs for bounded recommendations.
 */
const streetGroups = Object.create(null);
const addressParser = new AddressConversation([]);
for (const propertyRecord of propertyDataset.records) {
  const streetName = addressParser.parse(
    propertyRecord.street,
    'source',
    [propertyRecord.cityKey].filter(Boolean),
  ).name;
  if (!streetName) continue;
  (streetGroups[streetName] ??= []).push([
    propertyRecord.streetKey.split(' ')[0],
    propertyRecord.id,
  ]);
}
const embeddedServerData = {
  streetGroups,
  stats: propertyDataset.stats,
  sourceHash: createHash('sha256').update(companyCsvText).digest('hex'),
  groups: compressedHouseGroups,
};
console.log(
  JSON.stringify({
    serverDatasetRows: propertyDataset.stats.sourceRows,
    searchable: propertyDataset.stats.searchable,
    houseGroups: recordsByHouseNumber.size,
    largestHouseGroup: Math.max(
      ...[...recordsByHouseNumber.values()].map((houseRecords) => houseRecords.length),
    ),
  }),
);
/**
 * Concatenate modules into one Worker scope, stripping imports already represented by the
 * included source. Preserve declaration names and order when editing these modules.
 */
const combinedWorkerSource =
  (await readFile('dist/lookup.mjs', 'utf8')) +
  '\n' +
  (await readFile('dist/resolver.mjs', 'utf8')).replace(/^import .*;$/m, '') +
  '\n' +
  (await readFile('sites/server-data.mjs', 'utf8')).replace(/^import .*;$/gm, '') +
  '\n' +
  (await readFile('sites/address-resolver.mjs', 'utf8')).replace(/^import .*;$/gm, '') +
  '\n' +
  (await readFile('sites/address-tools.mjs', 'utf8')).replace(/^import .*;$/gm, '') +
  '\n' +
  (await readFile('sites/properties.mjs', 'utf8')).replace(/^import .*;$/gm, '') +
  '\n' +
  (await readFile('sites/session.mjs', 'utf8'));
await mkdir('sites-artifact/dist/server', {
  recursive: true,
});
await mkdir('sites-artifact/.openai', {
  recursive: true,
});
/**
 * Emit server-only data, static assets and routing. The generated fetch handler exposes
 * APIs/health and GET/HEAD assets, never arbitrary filesystem paths or private CSV files.
 */
await writeFile(
  'sites-artifact/dist/server/index.js',
  combinedWorkerSource +
    '\nconst SERVER_DATA=' +
    JSON.stringify(embeddedServerData) +
    ';\nconst assets=' +
    JSON.stringify(staticAssets) +
    `;
export default {
  async fetch(request, environment) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/address/tools') return addressTools(request, environment);
    if (pathname === '/api/voice/session') return session(request, environment);
    if (pathname.startsWith('/api/')) return properties(request, environment);
    if (pathname === '/healthz') return new Response('ok');
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', {
        status: 405,
      });
    const staticAsset = assets[pathname === '/' ? '/index.html' : pathname];
    return staticAsset
      ? new Response(request.method === 'HEAD' ? null : staticAsset.body, {
          headers: {
            'Content-Type': staticAsset.type,
            'X-Content-Type-Options': 'nosniff',
          },
        })
      : new Response('Not found', {
          status: 404,
        });
  },
};
`,
);
await copyFile('.openai/hosting.json', 'sites-artifact/.openai/hosting.json');
await cp('drizzle', 'sites-artifact/drizzle', {
  recursive: true,
});
