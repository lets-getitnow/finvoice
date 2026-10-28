/**
 * Read the generated Worker-only SERVER_DATA constant; no CSV or source groups
 * are served directly to the browser. Caches are small insertion-ordered isolate-local
 * maps, not persistent stores. Build-time data must come from the fingerprint-pinned export.
 */
import { streetNameScore } from '../dist/resolver.mjs';
import { normalize } from '../dist/lookup.mjs';
/**
 * Keep at most eight decoded house groups; cache hits do not refresh eviction order.
 */
const decodedHouseCache = new Map();
/**
 * Keep at most sixteen fuzzy street-name searches; exact index hits bypass this cache.
 */
const streetRecommendationCache = new Map();
/**
 * Return source name, aggregate stats and approved source hash without returning records or
 * encoded groups.
 */
export function serverInfo() {
  return {
    name: 'Company property records',
    stats: SERVER_DATA.stats,
    sourceHash: SERVER_DATA.sourceHash,
  };
}
/**
 * Decode base64 gzip tuples into normalized records; absent groups return empty.
 * Decompression/JSON errors propagate to the endpoint.
 */
export async function decodeHouse(encodedHouseGroup) {
  if (!encodedHouseGroup) return [];
  const compressedBytes = Uint8Array.from(atob(encodedHouseGroup), (base64Character) =>
    base64Character.charCodeAt(0),
  );
  const decodedJson = await new Response(
    new Blob([compressedBytes]).stream().pipeThrough(new DecompressionStream('gzip')),
  ).text();
  return JSON.parse(decodedJson).map(
    ([propertyId, sourceStreet, city, state, postal_code, values]) => ({
      id: propertyId,
      street: sourceStreet,
      city,
      state,
      postal_code,
      values,
      streetKey: normalize(sourceStreet),
      cityKey: normalize(city),
      zipKey: normalize(postal_code),
    }),
  );
}
/**
 * Load a house group from the generated constant, reusing the bounded decoded cache.
 */
export async function loadHouse(house) {
  if (decodedHouseCache.has(house)) return decodedHouseCache.get(house);
  const records = await decodeHouse(SERVER_DATA.groups[house]);
  if (decodedHouseCache.size >= 8) decodedHouseCache.delete(decodedHouseCache.keys().next().value);
  decodedHouseCache.set(house, records);
  return records;
}

/**
 * Return at most 24 indexed candidate IDs for a 2–80-character normalized name and optional
 * house prefix. Rank fuzzy names, then decode only the selected house groups.
 */
export async function recommendRecords({ house = '', name = '' }) {
  if (!name || name.length < 2 || name.length > 80) return [];
  let rankedStreetNames;
  if (Object.hasOwn(SERVER_DATA.streetGroups, name))
    rankedStreetNames = [
      {
        street: name,
        score: 1,
      },
    ];
  else if (streetRecommendationCache.has(name))
    rankedStreetNames = streetRecommendationCache.get(name);
  else {
    rankedStreetNames = [];
    for (const indexedStreetName in SERVER_DATA.streetGroups) {
      const streetSimilarity = streetNameScore(name, indexedStreetName);
      if (streetSimilarity > 0)
        rankedStreetNames.push({
          street: indexedStreetName,
          score: streetSimilarity,
        });
    }
    rankedStreetNames.sort(
      (leftStreetMatch, rightStreetMatch) =>
        rightStreetMatch.score - leftStreetMatch.score ||
        leftStreetMatch.street.localeCompare(rightStreetMatch.street),
    );
    if (streetRecommendationCache.size >= 16)
      streetRecommendationCache.delete(streetRecommendationCache.keys().next().value);
    streetRecommendationCache.set(name, rankedStreetNames);
  }
  const candidates = [];
  for (const streetMatch of rankedStreetNames) {
    for (const [houseNumber, propertyId] of SERVER_DATA.streetGroups[streetMatch.street]) {
      if (house && !houseNumber.startsWith(house)) continue;
      candidates.push({
        number: houseNumber,
        id: propertyId,
      });
      if (candidates.length >= 24) break;
    }
    if (candidates.length >= 24) break;
  }
  const records = [];
  for (const houseNumber of new Set(candidates.map((candidate) => candidate.number))) {
    const selectedPropertyIds = new Set(
      candidates
        .filter((candidate) => candidate.number === houseNumber)
        .map((candidate) => candidate.id),
    );
    records.push(
      ...(await loadHouse(houseNumber)).filter((propertyRecord) =>
        selectedPropertyIds.has(propertyRecord.id),
      ),
    );
  }
  return records;
}
