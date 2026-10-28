/**
 * Authenticated server tool API. Model hints interpret replies; source records and
 * actual user confirmation determine value disclosure. History/context travel with
 * each bounded request; no persistent transcript store is created by this module.
 */
import { normalize, money } from '../dist/lookup.mjs';
import { AddressConversation } from '../dist/resolver.mjs';
import { resolveAddress } from './address-resolver.mjs';
import { serverInfo, loadHouse, recommendRecords } from './server-data.mjs';
/**
 * Allow only the three protocol phases; the browser broker enforces their order.
 */
const TOOL_NAMES = ['apply_address_reply', 'find_address_candidates', 'choose_clarification'];
/**
 * Return JSON with private no-store caching; default status is 200.
 */
const createAddressToolResponse = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  });
/**
 * Recognize explicit affirmative utterances after address normalization.
 */
const isAffirmativeReply = (replyText) =>
  /^(?:yes|yeah|yep|correct|confirm|that s right|that s it|yes that s right|yes that s it)$/.test(
    normalize(replyText),
  );
/**
 * Recognize explicit selection of one of the three displayed candidates.
 */
const isOrdinalSelection = (replyText) =>
  /^(?:the |option |number )?(?:first|second|third|[123])(?: one| option)?$/.test(
    normalize(replyText),
  );
/**
 * Detect negative/rejection language before considering any model-provided hint.
 */
const isNegativeReply = (replyText) =>
  /\b(?:no|nope|neither|none|not that one|other one)\b/i.test(replyText);
/**
 * Identify uncertainty so the same unanswerable field need not be asked repeatedly.
 */
const isUnknownReply = (replyText) =>
  /\b(?:don'?t know|do not know|dunno|not sure|can'?t remember|no idea|unsure)\b/i.test(replyText);
/**
 * Allowed spoken-number words for trailing-number repair; arbitrary street words stay literal.
 */
const spokenNumberPattern =
  'zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and';
/**
 * Repair hesitations, reversed number groups and self-corrections into at most 250 characters.
 * Preserve an established house number when only a street is corrected; other-one replies become
 * rejection.
 */
export function canonicalAddressReply(rawReply) {
  if (/^(?:the )?other one$/i.test(rawReply.trim())) return 'no';
  const numericCorrection = new AddressConversation([]).parse(rawReply);
  if (numericCorrection.correction && numericCorrection.house)
    return `the house number is ${numericCorrection.house}`;
  let replyText = rawReply
    .trim()
    .replace(/(?<=[a-z])-(?=[a-z])/gi, ' ')
    .replace(/^(?:(?:um|uh|erm|okay|well|so)[, ]+)+/i, '');
  const correctionMatch = replyText.match(/^(.*?)\b(?:no|sorry|i meant)\b[, ]*(.+)$/i);
  if (correctionMatch && !isAffirmativeReply(replyText)) {
    const correctedReplyText = correctionMatch[2]
      .replace(/^(?:(?:actually|it is|it's|i said)[, ]*)/i, '')
      .split(/\s+(?:not|instead of)\b/i)[0]
      .trim()
      .replace(/[, ]+$/, '');
    if (/^(?:the )?other one$/i.test(correctedReplyText)) return 'no';
    const addressParser = new AddressConversation([]),
      previousAddressParts = addressParser.parse(correctionMatch[1]),
      correctedAddressParts = addressParser.parse(correctedReplyText);
    replyText =
      previousAddressParts.house && !correctedAddressParts.house
        ? `${previousAddressParts.house} ${correctedReplyText}`
        : `actually ${correctedReplyText}`;
  }
  const trailingNumberMatch = replyText.match(
    new RegExp(`^(.+?)\\s+((?:(?:${spokenNumberPattern})(?:\\s+|$))+)$`, 'i'),
  );
  // A number-only reply is not a street-first address.
  if (
    trailingNumberMatch &&
    /[a-z]/i.test(trailingNumberMatch[1]) &&
    !/^\d/.test(normalize(trailingNumberMatch[1]))
  )
    replyText = `${normalize(trailingNumberMatch[2])} ${trailingNumberMatch[1]}`;
  return replyText.slice(0, 250);
}
/**
 * Format nonempty source address components for tool evidence and speech.
 */
const formatSourceAddress = (propertyRecord) =>
  [propertyRecord.street, propertyRecord.city, propertyRecord.state, propertyRecord.postal_code]
    .filter(Boolean)
    .join(', ');
/**
 * Project a source record to public address fields and missing-field indicators. Include numeric
 * values only when confirmed; otherwise expose only the conflict flag.
 */
const toPublicPropertyRecord = (record, isConfirmed = false) => ({
  id: record.id,
  street: record.street,
  city: record.city,
  state: record.state,
  postal_code: record.postal_code,
  ...(isConfirmed
    ? {
        values: record.values,
      }
    : {
        valuationConflict: record.values.length > 1,
      }),
  missingFields: ['city', 'state', 'postal_code'].filter((fieldName) => !record[fieldName]),
});
/**
 * Permit immediate exact release only when the actual nonnegative, nonuncertain reply supplies
 * matching house/name and all street components, with compatible supplied locality; model
 * spelling hints cannot establish this.
 */
export function exactSourceReply(rawReply, record) {
  if (!record || isUnknownReply(rawReply) || isNegativeReply(rawReply)) return false;
  const addressParser = new AddressConversation([]);
  const suppliedAddressParts = addressParser.parse(
    canonicalAddressReply(rawReply),
    'source',
    [record.cityKey].filter(Boolean),
  );
  const sourceAddressParts = addressParser.parse(
    record.street,
    'source',
    [record.cityKey].filter(Boolean),
  );
  return (
    !!suppliedAddressParts.house &&
    !!suppliedAddressParts.name &&
    ['house', 'name', 'suffix', 'direction', 'postDirection', 'unit'].every(
      (componentName) => suppliedAddressParts[componentName] === sourceAddressParts[componentName],
    ) &&
    (!suppliedAddressParts.city || suppliedAddressParts.city === record.cityKey) &&
    (!suppliedAddressParts.zip || suppliedAddressParts.zip === record.zipKey)
  );
}
/**
 * Choose one useful question, avoiding unknown fields. Prefer single-candidate confirmation,
 * then distinguishing fields (or an available fallback); completed records need no question.
 */
function chooseClarificationQuestion(result, context, preferredDetail = 'auto') {
  const records = result.matches || [],
    unknownFields = new Set(context.unknown_fields || []);
  if (['confirmed', 'exact'].includes(result.kind))
    return {
      field: null,
      text: '',
    };
  if (records.length === 1 && !unknownFields.has('confirm')) {
    const propertyRecord = records[0];
    const addressWithSpelledDigits = propertyRecord.street.replace(/^\d+/, (number) =>
      number.split('').join('-'),
    );
    return {
      field: 'confirm',
      text: `Did you mean ${[addressWithSpelledDigits, propertyRecord.city, propertyRecord.postal_code].filter(Boolean).join(', ')}? Say yes or no.`,
    };
  }
  if (!records.length) {
    const field =
      ['street', 'city', 'house'].find((detailField) => !unknownFields.has(detailField)) ||
      'street';
    return {
      field,
      text: {
        street: 'What street name do you remember?',
        city: 'What city do you remember?',
        house: 'What part of the house number do you remember?',
      }[field],
    };
  }
  const addressParser = new AddressConversation([]);
  const values = Object.fromEntries(
    ['city', 'suffix', 'direction', 'house', 'unit', 'zip'].map((field) => [
      field,
      [
        ...new Set(
          records.map((propertyRecord) =>
            field === 'city'
              ? propertyRecord.city
              : field === 'zip'
                ? propertyRecord.postal_code
                : addressParser.parse(
                    propertyRecord.street,
                    'source',
                    [propertyRecord.city].filter(Boolean),
                  )[field] || '',
          ),
        ),
      ].filter(Boolean),
    ]),
  );
  const distinguishingFields = ['city', 'suffix', 'direction', 'house', 'unit', 'zip'].filter(
    (detailField) => !unknownFields.has(detailField) && values[detailField].length > 1,
  );
  const field = distinguishingFields.includes(preferredDetail)
    ? preferredDetail
    : distinguishingFields[0];
  if (!field) {
    const fallbackField = ['city', 'street', 'house', 'unit', 'zip'].find(
      (detailField) => !unknownFields.has(detailField),
    );
    return fallbackField
      ? {
          field: fallbackField,
          text: {
            city: 'Which city do you remember?',
            street: 'What street name do you remember?',
            house: 'What part of the house number do you remember?',
            unit: 'Do you know the unit number?',
            zip: 'Do you know the ZIP code?',
          }[fallbackField],
        }
      : {
          field: null,
          text: 'I cannot confirm the address from those details. Please check an address document, or say new search.',
        };
  }
  const spokenOptions = values[field]
    .slice(0, 3)
    .map((detailValue) => (field === 'house' ? detailValue.split('').join('-') : detailValue))
    .join(' or ');
  const questions = {
    city: `Is the property in ${spokenOptions}?`,
    suffix: `Is the street type ${spokenOptions}?`,
    direction: `Is the direction ${spokenOptions}?`,
    house: `Is the house number ${spokenOptions}?`,
    unit: `Is the unit ${spokenOptions}?`,
    zip: `Is the ZIP code ${spokenOptions}?`,
  };
  return {
    field,
    text: questions[field],
  };
}
/**
 * Handle same-origin authenticated POST tools with bounded body/history/context. Apply
 * interpretations, retrieve source candidates and choose question/speech. Invalid input returns
 * 4xx; unexpected processing failures return sanitized 503. Source adapter injection is for
 * isolated tests.
 */
export async function addressTools(
  request,
  environment,
  propertySource = {
    info: serverInfo,
    load: loadHouse,
    recommend: recommendRecords,
  },
) {
  if (!request.headers.get('oai-authenticated-user-id'))
    return createAddressToolResponse(
      {
        error: 'Sign in to resolve an address.',
      },
      401,
    );
  if (request.method !== 'POST')
    return createAddressToolResponse(
      {
        error: 'Method not allowed.',
      },
      405,
    );
  if (request.headers.get('Origin') !== new URL(request.url).origin)
    return createAddressToolResponse(
      {
        error: 'Same-origin request required.',
      },
      403,
    );
  try {
    const requestText = await request.text();
    if (requestText.length > 20000)
      return createAddressToolResponse(
        {
          error: 'Request too large.',
        },
        413,
      );
    const toolRequest = JSON.parse(requestText);
    if (
      !TOOL_NAMES.includes(toolRequest.tool) ||
      !Number.isSafeInteger(toolRequest.turn) ||
      toolRequest.turn <= 0 ||
      !Array.isArray(toolRequest.history) ||
      toolRequest.history.length > 24 ||
      !toolRequest.history.every(
        (utterance) => typeof utterance === 'string' && utterance.length <= 250,
      )
    )
      return createAddressToolResponse(
        {
          error: 'Invalid tool request.',
        },
        400,
      );
    const context = {
      last_reply:
        typeof toolRequest.context?.last_reply === 'string'
          ? toolRequest.context.last_reply.slice(0, 250)
          : '',
      last_question: toolRequest.context?.last_question || null,
      rejected_ids: Array.isArray(toolRequest.context?.rejected_ids)
        ? toolRequest.context.rejected_ids.filter(Number.isSafeInteger).slice(0, 96)
        : [],
      unknown_fields: Array.isArray(toolRequest.context?.unknown_fields)
        ? toolRequest.context.unknown_fields
            .filter((detailField) =>
              ['confirm', 'house', 'street', 'city', 'zip', 'suffix', 'direction', 'unit'].includes(
                detailField,
              ),
            )
            .slice(0, 8)
        : [],
    };
    if (toolRequest.tool === 'apply_address_reply') {
      if (
        typeof toolRequest.utterance !== 'string' ||
        !toolRequest.utterance.trim() ||
        toolRequest.utterance.length > 250
      )
        return createAddressToolResponse(
          {
            error: 'Start a new address search.',
          },
          400,
        );
      const rawReply = toolRequest.utterance.trim();
      context.last_reply = rawReply;
      if (
        toolRequest.history.length >= 24 &&
        !/^(?:start over|new search|reset|clear)(?: please)?$/i.test(rawReply)
      )
        return createAddressToolResponse(
          {
            error: 'Say new search to start again.',
          },
          400,
        );
      let history = [...toolRequest.history],
        intent = 'address';
      if (/^(?:start over|new search|reset|clear)(?: please)?$/i.test(rawReply)) {
        history = [];
        context.unknown_fields = [];
        context.rejected_ids = [];
        context.last_question = null;
        intent = 'reset';
      } else if (
        isUnknownReply(rawReply) ||
        (toolRequest.args?.intent === 'unknown' &&
          !/\d/.test(normalize(rawReply)) &&
          !isAffirmativeReply(rawReply) &&
          !isNegativeReply(rawReply))
      ) {
        intent = 'unknown';
        if (
          context.last_question?.field &&
          !context.unknown_fields.includes(context.last_question.field)
        )
          context.unknown_fields.push(context.last_question.field);
      } else {
        let canonicalReply = canonicalAddressReply(rawReply);
        intent = isNegativeReply(rawReply)
          ? 'reject'
          : isAffirmativeReply(rawReply)
            ? 'confirm'
            : /\b(?:actually|sorry|i meant|not)\b/i.test(rawReply)
              ? 'correction'
              : 'address';
        // Treat model normalization as an interpretation hint, never as evidence of consent or a source-exact reply.
        const modelAddressHint =
          typeof toolRequest.args?.normalized_hint === 'string'
            ? toolRequest.args.normalized_hint.trim().slice(0, 250)
            : '';
        const actualReplyParts = new AddressConversation([]).parse(canonicalReply);
        const isRejectionOnly =
          /^(?:no|nope|neither|none|not that one|the other one|yeah no|yes no)[,.! ]*$/i.test(
            rawReply,
          );
        const isControlHint =
          isAffirmativeReply(modelAddressHint) ||
          isNegativeReply(modelAddressHint) ||
          isOrdinalSelection(modelAddressHint) ||
          /^(?:reset|clear|new search|start over)$/i.test(modelAddressHint);
        if (
          modelAddressHint &&
          !isAffirmativeReply(rawReply) &&
          !isRejectionOnly &&
          !isControlHint &&
          ['address', 'correction'].includes(toolRequest.args?.intent)
        ) {
          const interpretedReply = canonicalAddressReply(modelAddressHint),
            hintAddressParts = new AddressConversation([]).parse(interpretedReply);
          // A reply to a detail question cannot invent a replacement full address.
          // Preserve deterministic numeric evidence and complete supplied addresses.
          const preservesAddress =
            !actualReplyParts.house ||
            (!actualReplyParts.name && hintAddressParts.house === actualReplyParts.house);
          if (
            preservesAddress &&
            (!context.last_question?.field || !(hintAddressParts.house && hintAddressParts.name))
          )
            canonicalReply = interpretedReply;
        }
        if (!isAffirmativeReply(rawReply) && !isRejectionOnly) {
          const field =
            toolRequest.args?.intent === 'correction' && toolRequest.args?.detail !== 'auto'
              ? toolRequest.args?.detail
              : context.last_question?.field;
          const replyAddressParts = new AddressConversation([]).parse(canonicalReply);
          if (
            !(replyAddressParts.house && replyAddressParts.name) &&
            !/^actually\b/i.test(canonicalReply)
          ) {
            if (field === 'house' && /^\d+[a-z]?$/.test(normalize(canonicalReply)))
              canonicalReply = `the house number is ${normalize(canonicalReply)}`;
            if (field === 'zip' && /^\d{5}$/.test(normalize(canonicalReply)))
              canonicalReply = `the ZIP is ${normalize(canonicalReply)}`;
            if (field === 'unit')
              canonicalReply = `unit ${canonicalReply.replace(/^(?:unit|apt|apartment|suite)\s+/i, '')}`;
            if (field === 'city')
              canonicalReply = `in ${canonicalReply.replace(/^(?:in|the city is|city is)\s+/i, '')}`;
            if (field === 'street' && toolRequest.args?.intent === 'correction')
              canonicalReply = `actually ${canonicalReply}`;
          }
        }
        // The model cannot turn an uncertain or negative reply into confirmation.
        if (
          intent === 'reject' &&
          (canonicalReply === 'no' || /^(?:no|nope|neither|none|not that one)$/i.test(rawReply))
        )
          context.rejected_ids = [
            ...new Set([...context.rejected_ids, ...(context.last_question?.candidate_ids || [])]),
          ].slice(-96);
        history.push(
          intent === 'reject' && /^\s*(?:yeah|yes)[, ]+no\b/i.test(rawReply)
            ? 'no'
            : canonicalReply,
        );
        if (intent === 'correction' || intent === 'address') context.unknown_fields = [];
      }
      return createAddressToolResponse({
        tool: toolRequest.tool,
        turn: toolRequest.turn,
        history,
        context,
        intent,
      });
    }
    // Replay server-backed history with implicit exact release disabled; actual-source matching below is the only automatic exception.
    let resolvedAddress = await resolveAddress(toolRequest.history, propertySource, {
      requireConfirmation: true,
    });
    const rejectedPropertyIds = new Set(context.rejected_ids);
    const remainingCandidates = (resolvedAddress.matches || []).filter(
      (propertyRecord) => !rejectedPropertyIds.has(propertyRecord.id),
    );
    if (remainingCandidates.length !== (resolvedAddress.matches || []).length)
      resolvedAddress = {
        ...resolvedAddress,
        kind: remainingCandidates.length ? 'choose' : 'none',
        matches: remainingCandidates,
        total: remainingCandidates.length,
      };
    // A yes/ordinal only confirms a record that appeared in the prior question; model hints cannot create that user action.
    const hasExplicitSelection =
      isAffirmativeReply(context.last_reply) || isOrdinalSelection(context.last_reply);
    const wasCandidateOffered = (context.last_question?.candidate_ids || []).includes(
      resolvedAddress.matches?.[0]?.id,
    );
    if (resolvedAddress.kind === 'confirmed' && (!hasExplicitSelection || !wasCandidateOffered))
      resolvedAddress = {
        ...resolvedAddress,
        kind: 'choose',
        field: 'confirm',
      };
    if (
      resolvedAddress.matches?.length === 1 &&
      exactSourceReply(context.last_reply, resolvedAddress.matches[0])
    )
      resolvedAddress = {
        ...resolvedAddress,
        kind: 'exact',
      };
    // Redact values before returning either candidate evidence or an unresolved clarification.
    const isConfirmed = ['confirmed', 'exact'].includes(resolvedAddress.kind);
    const records = (resolvedAddress.matches || []).slice(0, 3);
    const publicAddressResult = {
      ...resolvedAddress,
      matches: records.map((propertyRecord) => toPublicPropertyRecord(propertyRecord, isConfirmed)),
    };
    if (toolRequest.tool === 'find_address_candidates') {
      const addressParser = new AddressConversation([]);
      const requestedAddressParts = addressParser.parse(toolRequest.history.at(-1) || '');
      return createAddressToolResponse({
        tool: toolRequest.tool,
        turn: toolRequest.turn,
        result: publicAddressResult,
        candidates: records.map((propertyRecord) => ({
          id: propertyRecord.id,
          address: formatSourceAddress(propertyRecord),
          evidence: {
            housePrefix:
              !!requestedAddressParts.house &&
              addressParser.parse(
                propertyRecord.street,
                'source',
                [propertyRecord.city].filter(Boolean),
              ).house !== requestedAddressParts.house,
            missingFields: ['city', 'postal_code'].filter(
              (fieldName) => !propertyRecord[fieldName],
            ),
            valuationConflict: propertyRecord.values.length > 1,
          },
        })),
        context,
      });
    }
    const question = chooseClarificationQuestion(
      resolvedAddress,
      context,
      toolRequest.args?.preferred_detail,
    );
    context.last_question = {
      field: question.field,
      text: question.text,
      candidate_ids: records.map((propertyRecord) => propertyRecord.id),
    };
    let speech = question.text;
    if (isConfirmed) {
      const propertyRecord = records[0];
      speech =
        propertyRecord.values.length === 1
          ? `The imported valuation for ${formatSourceAddress(propertyRecord)} is ${money(propertyRecord.values[0])}.`
          : `The source has conflicting valuations for ${formatSourceAddress(propertyRecord)}. Please check the company records.`;
    }
    return createAddressToolResponse({
      tool: toolRequest.tool,
      turn: toolRequest.turn,
      history: toolRequest.history,
      context,
      result: {
        ...publicAddressResult,
        field: question.field,
        prompt: question.text,
      },
      speech,
    });
  } catch {
    return createAddressToolResponse(
      {
        error: 'Address tool could not complete. Please try again.',
      },
      503,
    );
  }
}
