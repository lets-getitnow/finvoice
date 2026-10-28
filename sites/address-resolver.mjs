/**
 * Server-side replay of bounded utterance history over a source adapter.
 * The adapter loads house groups and optional street recommendations; values stay
 * server-side until the calling endpoint projects an authorized result.
 */
import { AddressConversation } from '../dist/resolver.mjs';
/**
 * Union source-backed candidates across address turns, replay a fresh prefix-enabled
 * conversation and return its result plus hasMore/rejected metadata. requireConfirmation demotes
 * implicit exact results during replay; explicit choices still confirm.
 */
export async function resolveAddress(
  history,
  propertySource,
  { requireConfirmation = false } = {},
) {
  const candidateRecordsById = new Map();
  let houseNumber = '',
    streetName = '';
  const addressParser = new AddressConversation([]);
  for (const utterance of history) {
    if (
      /^(?:(?:the |option |number )?(?:first|second|third)(?: one| option)?|option [123]|yes|yeah|correct|confirm|no|nope|neither|none)$/i.test(
        utterance.trim(),
      ) ||
      (houseNumber && /^[123]$/.test(utterance.trim()))
    )
      continue;
    const addressParts = addressParser.parse(utterance);
    if (addressParts.name && addressParts.house) {
      houseNumber = addressParts.house;
      streetName = addressParts.name;
    } else {
      if (addressParts.house) houseNumber = addressParts.house;
      if (addressParts.name) streetName = addressParts.name;
    }
    if (houseNumber)
      for (const propertyRecord of await propertySource.load(houseNumber))
        candidateRecordsById.set(propertyRecord.id, propertyRecord);
    if (streetName && propertySource.recommend)
      for (const propertyRecord of await propertySource.recommend({
        house: addressParts.name && !addressParts.house ? '' : houseNumber,
        name: streetName,
      }))
        candidateRecordsById.set(propertyRecord.id, propertyRecord);
  }
  const records = [...candidateRecordsById.values()];
  const conversation = new AddressConversation(records, {
    allowHousePrefix: true,
  });
  let result = conversation.reset();
  for (const utterance of history) {
    result = conversation.respond(utterance);
    if (requireConfirmation && result.kind === 'exact') {
      result = {
        ...result,
        kind: 'choose',
        field: 'confirm',
      };
      conversation.pending = result;
    }
  }
  return {
    ...result,
    hasMore: result.total > result.matches.length,
    rejected: [...conversation.rejected],
  };
}
