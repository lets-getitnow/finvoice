/**
 * Authenticated property metadata and read-only preview API.
 * Search uses server-owned source records; uploads are disabled and unconfirmed
 * responses omit values. Platform identity comes from the trusted hosting header.
 */
import { resolveAddress } from './address-resolver.mjs';
import { AddressConversation } from '../dist/resolver.mjs';
import { serverInfo, loadHouse, recommendRecords } from './server-data.mjs';
/**
 * Return private no-store JSON varied by Cookie so lookup responses are not shared across users.
 */
const createPropertyResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
    },
  });
/**
 * Route me/dataset/search, enforce identity and same-origin POST bounds, replay history and
 * filter rejected IDs. Return sanitized HTTP errors; source adapter injection supports isolated
 * tests.
 */
export async function properties(
  request,
  environment,
  propertySource = {
    info: serverInfo,
    load: loadHouse,
    recommend: recommendRecords,
  },
) {
  const pathname = new URL(request.url).pathname,
    authenticatedUserId = request.headers.get('oai-authenticated-user-id');
  if (pathname === '/api/me')
    return createPropertyResponse({
      signedIn: !!authenticatedUserId,
    });
  if (!authenticatedUserId)
    return createPropertyResponse(
      {
        error: 'Sign in with ChatGPT to search property records.',
      },
      401,
    );
  if (pathname.startsWith('/api/import/'))
    return createPropertyResponse(
      {
        error: 'Not found.',
      },
      404,
    );
  try {
    if (pathname === '/api/dataset' && request.method === 'GET')
      return createPropertyResponse(propertySource.info());
    if (pathname !== '/api/search')
      return createPropertyResponse(
        {
          error: 'Not found.',
        },
        404,
      );
    if (request.method !== 'POST')
      return createPropertyResponse(
        {
          error: 'Method not allowed.',
        },
        405,
      );
    if (request.headers.get('Origin') !== new URL(request.url).origin)
      return createPropertyResponse(
        {
          error: 'Same-origin request required.',
        },
        403,
      );
    if (Number(request.headers.get('Content-Length') || 0) > 50000)
      return createPropertyResponse(
        {
          error: 'Request too large.',
        },
        413,
      );
    const requestText = await request.text();
    if (requestText.length > 50000)
      return createPropertyResponse(
        {
          error: 'Request too large.',
        },
        413,
      );
    const searchRequest = JSON.parse(requestText);
    if (
      !Array.isArray(searchRequest.history) ||
      !searchRequest.history.length ||
      searchRequest.history.length > 24 ||
      !searchRequest.history.every(
        (utterance) => typeof utterance === 'string' && utterance.length <= 250,
      )
    )
      return createPropertyResponse(
        {
          error: 'Start a new search and enter an address.',
        },
        400,
      );
    const result = await resolveAddress(searchRequest.history, propertySource, {
      requireConfirmation: true,
    });
    const rejectedPropertyIds = new Set(
      Array.isArray(searchRequest.rejected_ids)
        ? searchRequest.rejected_ids.filter(Number.isSafeInteger).slice(0, 96)
        : [],
    );
    result.matches = result.matches.filter(
      (propertyRecord) => !rejectedPropertyIds.has(propertyRecord.id),
    );
    if (result.kind !== 'confirmed')
      result.matches = result.matches.map(({ values, ...record }) => record);
    return createPropertyResponse(result);
  } catch {
    return createPropertyResponse(
      {
        error: 'Property records could not be loaded. Please try again.',
      },
      503,
    );
  }
}
