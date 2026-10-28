/**
 * Mint a five-minute room-scoped LiveKit browser JWT after platform identity and
 * same-origin checks. Secrets remain in the server environment; responses are not cached.
 */
/**
 * Convert a string or signature bytes to unpadded base64url for JWT segments.
 */
const encodeBase64Url = (inputValue) =>
  btoa(typeof inputValue === 'string' ? inputValue : String.fromCharCode(...inputValue))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
/**
 * Return no-store JSON with the requested HTTP status.
 */
const createVoiceSessionResponse = (responseBody, statusCode = 200) =>
  new Response(JSON.stringify(responseBody), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
/**
 * Validate POST, identity, origin/fetch-site and wss configuration. Sign HS256 credentials for a
 * fresh two-participant room with microphone-only publication and named worker dispatch; never
 * grant room administration.
 */
export async function session(request, environment) {
  if (request.method !== 'POST')
    return createVoiceSessionResponse(
      {
        error: 'Method not allowed',
      },
      405,
    );
  if (!request.headers.get('oai-authenticated-user-id'))
    return createVoiceSessionResponse(
      {
        error: 'Sign in to use voice.',
      },
      401,
    );
  if (
    request.headers.get('Origin') !== new URL(request.url).origin ||
    ![null, 'same-origin'].includes(request.headers.get('Sec-Fetch-Site'))
  )
    return createVoiceSessionResponse(
      {
        error: 'Voice sessions require a same-origin request.',
      },
      403,
    );
  if (
    !['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].every(
      (environmentVariableName) => environment[environmentVariableName],
    )
  )
    return createVoiceSessionResponse(
      {
        error: 'LiveKit is not configured. Typed search still works.',
      },
      503,
    );
  let livekitUrl;
  try {
    livekitUrl = new URL(environment.LIVEKIT_URL);
  } catch {
    return createVoiceSessionResponse(
      {
        error: 'Invalid LiveKit configuration.',
      },
      503,
    );
  }
  if (livekitUrl.protocol !== 'wss:' || livekitUrl.username || livekitUrl.password)
    return createVoiceSessionResponse(
      {
        error: 'Invalid LiveKit configuration.',
      },
      503,
    );
  const browserIdentity = 'browser-' + crypto.randomUUID(),
    roomName = 'finvoice-' + crypto.randomUUID(),
    issuedAtSeconds = Math.floor(Date.now() / 1000);
  const tokenClaims = {
    iss: environment.LIVEKIT_API_KEY,
    sub: browserIdentity,
    nbf: issuedAtSeconds,
    exp: issuedAtSeconds + 300,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: ['microphone'],
    },
    roomConfig: {
      emptyTimeout: 60,
      departureTimeout: 20,
      maxParticipants: 2,
      agents: [
        {
          agentName: environment.LIVEKIT_AGENT_NAME || 'finvoice',
          metadata: JSON.stringify({
            participant: browserIdentity,
          }),
        },
      ],
    },
  };
  const unsignedToken =
    encodeBase64Url(
      JSON.stringify({
        alg: 'HS256',
        typ: 'JWT',
      }),
    ) +
    '.' +
    encodeBase64Url(JSON.stringify(tokenClaims));
  const signingKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(environment.LIVEKIT_API_SECRET),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );
  const tokenSignature = await crypto.subtle.sign(
    'HMAC',
    signingKey,
    new TextEncoder().encode(unsignedToken),
  );
  return createVoiceSessionResponse({
    url: environment.LIVEKIT_URL,
    identity: browserIdentity,
    token: unsignedToken + '.' + encodeBase64Url(new Uint8Array(tokenSignature)),
  });
}
