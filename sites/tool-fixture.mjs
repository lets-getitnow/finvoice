/**
 * Isolated synthetic test source and in-process API broker.
 * Never import this module into the production build or use it as a missing-data fallback.
 */
// Explicitly synthetic, isolated test source. Never used by the production build.
import { AddressConversation, streetNameScore } from '../dist/resolver.mjs';
import { parseCSV } from '../dist/lookup.mjs';
import { addressTools } from './address-tools.mjs';
import { AddressToolSession } from '../dist/address-tools.mjs';
/**
 * Synthetic addresses/values cover ambiguity, prefix recovery, zero and conflicts; none are
 * operational observations.
 */
export const syntheticRecords = parseCSV(
  'street,city,state,postal_code,property_value\n3220 Mint Drive,Fixture City,TX,00000,100\n3221 Mint Drive,Other Fixture,TX,00001,200\n50 Smith Avenue,Fixture City,TX,00000,300\n50 Smith Avenue,Other Fixture,TX,00001,350\n70 Zero Way,Fixture City,TX,00000,0\n80 Conflict Road,Fixture City,TX,00000,100\n80 Conflict Road,Fixture City,TX,00000,200',
).records;
/**
 * In-memory adapter: load matches an exact house, recommend uses house prefixes and the
 * production street score; info has no source metadata.
 */
export const syntheticSource = {
  info: () => ({}),
  load: async (houseNumber) =>
    syntheticRecords.filter(
      (propertyRecord) => propertyRecord.streetKey.split(' ')[0] === houseNumber,
    ),
  recommend: async ({ house: houseNumber, name: streetName }) =>
    syntheticRecords.filter(
      (propertyRecord) =>
        (!houseNumber || propertyRecord.streetKey.split(' ')[0].startsWith(houseNumber)) &&
        streetNameScore(
          streetName,
          new AddressConversation([]).parse(propertyRecord.street, 'source', [
            propertyRecord.cityKey,
          ]).name || '',
        ) > 0,
    ),
};
/**
 * Create a fresh browser broker whose fetch adapter calls the actual server tool handler with
 * synthetic same-origin authentication.
 */
export function makeBroker() {
  return new AddressToolSession({
    request: async (requestPath, requestOptions) =>
      addressTools(
        new Request('https://synthetic.example' + requestPath, {
          ...requestOptions,
          headers: {
            ...requestOptions.headers,
            Origin: 'https://synthetic.example',
            'oai-authenticated-user-id': 'synthetic-user',
          },
        }),
        {},
        syntheticSource,
      ),
  });
}
