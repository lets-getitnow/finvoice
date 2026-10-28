/**
 * In-memory address retrieval and clarification. Heuristic matches require explicit choice;
 * allowHousePrefix is an opt-in fallback, preserving strict lookup by default.
 */
import { normalize, addressQuery, displayAddress } from './lookup.mjs';

/** Canonical street-type tokens recognized after normalization. */
const streetSuffixes = new Set('st ave dr rd blvd ln ct cir pl pkwy hwy ter trl'.split(' '));
/** Direction tokens can be separate address components or part of a lexical street name. */
const streetDirections = new Set('n s e w ne nw se sw'.split(' '));
/** Expanded directions used when comparing joined and separated street names. */
const expandedDirections = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  ne: 'northeast',
  nw: 'northwest',
  se: 'southeast',
  sw: 'southwest',
};
/** Human-readable suffix labels for clarification prompts. */
const expandedSuffixes = {
  st: 'Street',
  ave: 'Avenue',
  dr: 'Drive',
  rd: 'Road',
  blvd: 'Boulevard',
  ln: 'Lane',
  ct: 'Court',
  cir: 'Circle',
  pl: 'Place',
  pkwy: 'Parkway',
  hwy: 'Highway',
  ter: 'Terrace',
  trl: 'Trail',
};
/** Digit-by-digit spoken ZIP vocabulary; string values preserve leading zeros. */
const spokenZipDigits = {
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};
/** Escape a known city string for literal matching in a trailing-locality regular expression. */
const escapeRegularExpression = (literalText) => literalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Split normalized street text into optional house, direction, name, suffix, postDirection and
 * unit slots; remove a unit tail before parsing the street.
 */
function parseStreetComponents(street) {
  const tokens = normalize(street).split(' ').filter(Boolean),
    parsedStreetParts = {};
  // Support reversed street/house phrases before splitting units and canonical street components.
  if (tokens.length > 1 && !/^\d/.test(tokens[0]) && /^\d+[a-z]?$/.test(tokens.at(-1)))
    tokens.unshift(tokens.pop());
  const unitMarkerIndex = tokens.findIndex((streetToken) =>
    ['apt', 'ste', '#', 'unit'].includes(streetToken),
  );
  if (unitMarkerIndex >= 0) {
    parsedStreetParts.unit = tokens.slice(unitMarkerIndex + 1).join('');
    tokens.splice(unitMarkerIndex);
  }
  if (/^\d+[a-z]?$/.test(tokens[0])) parsedStreetParts.house = tokens.shift();
  if (streetDirections.has(tokens[0]) && tokens.length > 1)
    parsedStreetParts.direction = tokens.shift();
  if (streetDirections.has(tokens.at(-1)) && tokens.length > 1)
    parsedStreetParts.postDirection = tokens.pop();
  if (streetSuffixes.has(tokens.at(-1))) parsedStreetParts.suffix = tokens.pop();
  if (tokens.length) parsedStreetParts.name = tokens.join(' ');
  return parsedStreetParts;
}
// Soundex is an uncalibrated retrieval signal, never a disclosure decision.
/**
 * Return a four-character Soundex-like key, or empty for no letters. Adjacent sound groups
 * collapse; h/w do not reset the prior group.
 */
function createPhoneticKey(remainingAddressText) {
  const letters = remainingAddressText.replace(/[^a-z]/g, '');
  if (!letters) return '';
  const consonantGroups = ['bfpv', 'cgjkqsxz', 'dt', 'l', 'mn', 'r'];
  /**
   * Map a consonant to its Soundex group string; zero means no consonant group.
   */
  const getConsonantGroup = (letter) =>
    String(consonantGroups.findIndex((consonantGroup) => consonantGroup.includes(letter)) + 1);
  let phoneticKey = letters[0],
    previousSoundGroup = getConsonantGroup(letters[0]);
  for (const letter of letters.slice(1)) {
    const nextSoundGroup = getConsonantGroup(letter);
    if (nextSoundGroup !== '0' && nextSoundGroup !== previousSoundGroup)
      phoneticKey += nextSoundGroup;
    if (!'hw'.includes(letter)) previousSoundGroup = nextSoundGroup;
  }
  return (phoneticKey + '000').slice(0, 4);
}
/**
 * Compute insertion/deletion/substitution and adjacent-transposition distance with rolling rows;
 * previous retains the transposition dependency.
 */
function editDistance(sourceText, targetText) {
  let previousDistances = Array.from(
      {
        length: targetText.length + 1,
      },
      (_, targetIndex) => targetIndex,
    ),
    twoRowsBack = null;
  for (let sourceIndex = 1; sourceIndex <= sourceText.length; sourceIndex++) {
    const currentDistances = [sourceIndex];
    for (let targetIndex = 1; targetIndex <= targetText.length; targetIndex++) {
      currentDistances[targetIndex] = Math.min(
        currentDistances[targetIndex - 1] + 1,
        previousDistances[targetIndex] + 1,
        previousDistances[targetIndex - 1] +
          (sourceText[sourceIndex - 1] === targetText[targetIndex - 1] ? 0 : 1),
      );
      if (
        sourceIndex > 1 &&
        targetIndex > 1 &&
        sourceText[sourceIndex - 1] === targetText[targetIndex - 2] &&
        sourceText[sourceIndex - 2] === targetText[targetIndex - 1]
      )
        currentDistances[targetIndex] = Math.min(
          currentDistances[targetIndex],
          twoRowsBack[targetIndex - 2] + 1,
        );
    }
    twoRowsBack = previousDistances;
    previousDistances = currentDistances;
  }
  return previousDistances[targetText.length];
}
/** Join expanded directions and street-name words without spaces for lexical recovery. */
function joinStreetNameWithDirections(streetParts) {
  return [
    expandedDirections[streetParts.direction],
    streetParts.name,
    expandedDirections[streetParts.postDirection],
  ]
    .filter(Boolean)
    .join('')
    .replace(/\s/g, '');
}
/**
 * Return a heuristic score in [0,1]. Prefix/phonetic matches may score .78; unrelated names
 * score zero. Thresholds are uncalibrated retrieval rules.
 */
function calculateStreetNameSimilarity(queryStreetName, sourceStreetName) {
  if (queryStreetName === sourceStreetName) return 1;
  if (!queryStreetName || !sourceStreetName) return 0;
  const maximumNameLength = Math.max(queryStreetName.length, sourceStreetName.length),
    editSimilarity = 1 - editDistance(queryStreetName, sourceStreetName) / maximumNameLength;
  if (queryStreetName.length >= 3 && sourceStreetName.startsWith(queryStreetName))
    return Math.max(0.78, editSimilarity);
  if (
    Math.min(queryStreetName.length, sourceStreetName.length) >= 4 &&
    createPhoneticKey(queryStreetName) === createPhoneticKey(sourceStreetName) &&
    editSimilarity >= 0.45
  )
    return Math.max(0.78, editSimilarity);
  return editSimilarity >= 0.7 ? editSimilarity : 0;
}
/** Render retained slots as a compact UI label, omitting unspecified components. */
function formatAddressContext(addressSlots) {
  return [
    addressSlots.house,
    addressSlots.direction,
    addressSlots.name,
    addressSlots.suffix,
    addressSlots.postDirection,
    addressSlots.unit ? `unit ${addressSlots.unit}` : '',
    addressSlots.city,
    addressSlots.zip,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Own one lookup session: retained slots, pending response, rejected IDs and confirmation
 * requirement. Results expose kind, matches, total, context, prompt and optional field.
 */
export class AddressConversation {
  /**
   * Build street/locality indexes and initialize a session. allowHousePrefix opts into
   * confirmation-only partial house retrieval. Record IDs must uniquely identify candidates.
   */
  constructor(records, { allowHousePrefix = false } = {}) {
    this.allowHousePrefix = allowHousePrefix;
    this.slots = {};
    this.cities = [
      ...new Set(records.map((propertyRecord) => propertyRecord.cityKey).filter(Boolean)),
    ].sort((leftCity, rightCity) => rightCity.length - leftCity.length);
    this.entries = records.map((record) => ({
      record,
      p: this.parse(record.street, 'source', [record.cityKey].filter(Boolean)),
    }));
    this.byZip = new Map();
    this.byCity = new Map();
    for (const candidateEntry of this.entries) {
      for (const [localityIndex, localityKey] of [
        [this.byZip, candidateEntry.record.zipKey],
        [this.byCity, candidateEntry.record.cityKey],
      ]) {
        if (!localityKey) continue;
        if (!localityIndex.has(localityKey)) localityIndex.set(localityKey, []);
        localityIndex.get(localityKey).push(candidateEntry);
      }
    }
    this.cities = [...this.byCity.keys()].sort(
      (leftCity, rightCity) => rightCity.length - leftCity.length,
    );
    this.reset();
  }
  /**
   * Clear slots, pending choices, rejection history and confirmation state; return an empty
   * result for the UI.
   */
  reset() {
    this.slots = {};
    this.pending = null;
    this.rejected = new Set();
    this.mustConfirm = false;
    return {
      kind: 'empty',
      matches: [],
      total: 0,
      context: '',
      prompt: 'Say or type a house number and street name.',
    };
  }
  /**
   * Extract a slot update from text using the requested clarification field and known cities.
   * Does not mutate session slots; numeric corrections carry a temporary correction flag.
   */
  parse(rawReply, requestedField, knownCities = this.cities) {
    let remainingAddressText = rawReply
      .toLowerCase()
      .trim()
      .replace(/[?.!]+$/, '');
    const update = {};
    remainingAddressText = remainingAddressText.replace(
      /\b(?:zip(?:\s*code)?|postal code)(?:\s+is)?\s*[:,-]?\s*((?:(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)\s*){5}|\d{5}(?:-\d{4})?)\b/g,
      (matchedZipPhrase, capturedZipText) => {
        update.zip = /^\d/.test(capturedZipText)
          ? capturedZipText.slice(0, 5)
          : capturedZipText
              .trim()
              .split(/\s+/)
              .map((zipDigitWord) => spokenZipDigits[zipDigitWord])
              .join('');
        return ' ';
      },
    );
    const correction = remainingAddressText.match(
      /^(?:no[, ]+)?(?:actually[, ]+)?(?:the )?(?:house |street )?number(?: is)?\s+(.+)$|^(?:no[, ]+)(.+?)(?:[, ]+not\b.*)?$/,
    );
    if (correction) {
      const correctedHouseNumber = normalize(correction[1] || correction[2]);
      if (/^\d+[a-z]?$/.test(correctedHouseNumber))
        return {
          ...update,
          house: correctedHouseNumber,
          correction: true,
        };
    }
    remainingAddressText = remainingAddressText
      .replace(/^(?:(?:actually|no|sorry|i meant)[, ]+)+/, '')
      .replace(/^the (?:one|property) in\s+/, 'in ')
      .replace(/^(?:the )?(?:city|zip(?: code)?)(?: is)?\s+/, '');
    remainingAddressText = normalize(addressQuery(remainingAddressText));
    if (update.zip && /^(?:the|is|the is)$/.test(remainingAddressText)) remainingAddressText = '';
    // Some exports repeat locality inside street. Peel only trailing components,
    // retaining the last supplied ZIP/city and never treating a leading house as ZIP.
    for (let localityPass = 0; localityPass < 3; localityPass++) {
      const previousAddressText = remainingAddressText,
        zipMatch = remainingAddressText.match(/(?:^|\s)(\d{5})(?:\s\d{4})?$/);
      if (
        zipMatch &&
        (remainingAddressText !== zipMatch[1] || requestedField === 'zip' || !this.slots.name)
      ) {
        update.zip ??= zipMatch[1];
        remainingAddressText = remainingAddressText.replace(zipMatch[0], ' ').trim();
      }
      remainingAddressText = remainingAddressText.replace(/(?:^|\s)(?:tx|usa|us)$/, '').trim();
      const explicitCityMatch = remainingAddressText.match(/\bin\s+(.+)$/);
      if (explicitCityMatch) {
        update.city ??= explicitCityMatch[1].trim();
        remainingAddressText = remainingAddressText.slice(0, explicitCityMatch.index).trim();
      } else
        for (const city of knownCities) {
          const citySuffixPattern = new RegExp(`(?:^|\\s)${escapeRegularExpression(city)}$`);
          if (citySuffixPattern.test(remainingAddressText)) {
            update.city ??= city;
            remainingAddressText = remainingAddressText.replace(citySuffixPattern, '').trim();
            break;
          }
        }
      if (previousAddressText === remainingAddressText) break;
    }
    if (
      requestedField === 'city' &&
      remainingAddressText &&
      !/^\d/.test(remainingAddressText) &&
      !update.city
    ) {
      update.city = remainingAddressText;
      remainingAddressText = '';
    }
    if (!remainingAddressText) return update;
    if (
      requestedField === 'unit' &&
      /^(?:(?:apt|ste|unit|#)\s*)?[a-z0-9 -]+$/.test(remainingAddressText) &&
      !/^\d+\s+[a-z]{3}/.test(remainingAddressText)
    ) {
      update.unit = remainingAddressText.replace(/^(?:apt|ste|unit|#)\s*/, '').replace(/\s/g, '');
      return update;
    }
    if (streetSuffixes.has(remainingAddressText))
      return {
        ...update,
        suffix: remainingAddressText,
      };
    if (streetDirections.has(remainingAddressText))
      return {
        ...update,
        direction: remainingAddressText,
      };
    const streetParts = parseStreetComponents(remainingAddressText);
    return {
      ...update,
      ...streetParts,
    };
  }
  /**
   * Consume at most 250 characters of a user turn, mutate session state and return a
   * clarification or completed result. Up to two recognizer alternatives aid retrieval only
   * after primary retrieval fails.
   */
  respond(rawReply, alternatives = []) {
    rawReply = String(rawReply).trim().slice(0, 250);
    if (!rawReply) return this.pending || this.reset();
    const normalizedReply = normalize(rawReply);
    if (/^(?:start over|new search|reset|clear)(?: please)?$/.test(normalizedReply))
      return this.reset();
    const previousResult = this.pending;
    if (
      previousResult?.matches.length === 1 &&
      previousResult.field === 'confirm' &&
      /^(?:yes|yeah|yep|correct|confirm|that s (?:right|it)|yes that s (?:right|it))$/.test(
        normalizedReply,
      )
    )
      return this.confirm(previousResult.matches[0]);
    const ordinalIndexes = {
      first: 0,
      second: 1,
      third: 2,
      1: 0,
      2: 1,
      3: 2,
      one: 0,
      two: 1,
      three: 2,
    };
    const ordinalMatch = normalizedReply.match(
      /^(?:the |option |number )?(first|second|third|[123]|one|two|three)(?: one| option)?$/,
    );
    if (
      previousResult?.matches.length &&
      ordinalMatch &&
      previousResult.field !== 'unit' &&
      (previousResult.field !== 'house' ||
        /^(?:the )?(?:first|second|third|option |number )/.test(normalizedReply))
    ) {
      const propertyRecord = previousResult.matches[ordinalIndexes[ordinalMatch[1]]];
      if (propertyRecord) return this.confirm(propertyRecord);
    }
    if (
      previousResult &&
      /^(?:no|nope|neither|none|none of those|not that one)$/.test(normalizedReply)
    ) {
      previousResult.matches.forEach((propertyRecord) => this.rejected.add(propertyRecord.id));
      this.mustConfirm = true;
      return this.finish({
        kind: 'none',
        matches: [],
        total: 0,
        field: 'street',
        prompt: 'What street name should I use instead? I’ve kept the house number and locality.',
      });
    }
    if (
      /^(?:search|try|check) (?:all zip codes|other zip codes|all cities|everywhere)$/.test(
        normalizedReply,
      )
    ) {
      if (normalizedReply.includes('cities') || normalizedReply.includes('everywhere'))
        delete this.slots.city;
      delete this.slots.zip;
      this.mustConfirm = true;
      this.rejected.clear();
    } else {
      const update = this.parse(rawReply, previousResult?.field);
      // Completed results end a lookup. A subsequent street request starts clean;
      // active clarification and explicitly worded corrections retain other slots.
      const isPreviousLookupComplete =
        previousResult && ['exact', 'confirmed'].includes(previousResult.kind);
      const isExplicitCorrection = /^(?:actually|no|sorry|i meant)\b/i.test(rawReply);
      const startsNewStreet =
        update.name && (update.house || (isPreviousLookupComplete && !isExplicitCorrection));
      if (startsNewStreet) {
        this.slots = {};
        this.mustConfirm = false;
      }
      if (update.name) {
        delete this.slots.suffix;
        delete this.slots.direction;
        delete this.slots.postDirection;
      }
      if (update.correction) {
        delete update.correction;
        this.mustConfirm = true;
      }
      this.slots = {
        ...this.slots,
        ...update,
      };
      this.rejected.clear();
    }
    let candidates = this.retrieve(this.slots);
    // Recognizer alternatives only add candidates. They never auto-confirm a transcription.
    if (!candidates.length && alternatives.length) {
      for (const alternativeTranscript of alternatives.slice(0, 2)) {
        const addressSlots = {
          ...this.slots,
          ...this.parse(alternativeTranscript, previousResult?.field),
        };
        if (this.slots.zip) addressSlots.zip = this.slots.zip;
        if (this.slots.city) addressSlots.city = this.slots.city;
        for (const candidate of this.retrieve(addressSlots))
          if (
            !candidates.some(
              (existingCandidate) => existingCandidate.record.id === candidate.record.id,
            )
          )
            candidates.push({
              ...candidate,
              recovered: true,
            });
      }
      if (candidates.length) this.mustConfirm = true;
    }
    if (!candidates.length) {
      const locality = this.slots.zip
        ? ` in ZIP ${this.slots.zip}`
        : this.slots.city
          ? ` in ${this.slots.city}`
          : '';
      return this.finish({
        kind: 'none',
        matches: [],
        total: 0,
        field: this.slots.zip ? 'zip' : this.slots.city ? 'city' : 'street',
        prompt: `No matching address yet${locality}. ${locality ? 'Check that locality, give a correction, or say “search everywhere”.' : 'Check the house number or street name; you can correct just that detail.'}`,
      });
    }
    const total = candidates.length;
    if (!this.slots.house)
      return this.finish({
        kind: 'choose',
        matches: candidates.slice(0, 3).map((candidate) => candidate.record),
        total,
        field: 'house',
        prompt: `What is the house number${this.slots.name ? ` on ${this.slots.name}` : ''}?`,
      });
    if (!this.slots.name)
      return this.finish({
        kind: 'choose',
        matches: [],
        total,
        field: 'street',
        prompt: 'What is the street name?',
      });
    if (total === 1) {
      const candidate = candidates[0];
      if (candidate.exact && !this.mustConfirm)
        return this.finish({
          kind: 'exact',
          matches: [candidate.record],
          total,
          field: null,
          prompt: '',
        });
      return this.finish({
        kind: 'choose',
        matches: [candidate.record],
        total,
        field: 'confirm',
        prompt: `Did you mean ${displayAddress(candidate.record)}? Say yes, no, or give a correction.`,
      });
    }
    let requestedField = null;
    for (const componentName of ['zip', 'city', 'suffix', 'direction', 'unit', 'house']) {
      const distinctComponentValues = new Set(
        candidates.map((candidate) =>
          componentName === 'zip'
            ? candidate.record.zipKey
            : componentName === 'city'
              ? candidate.record.cityKey
              : candidate.p[componentName] || '',
        ),
      );
      if (distinctComponentValues.size > 1) {
        requestedField = componentName;
        break;
      }
    }
    const questions = {
      zip: 'What is the ZIP code?',
      city: 'Which city is the property in?',
      suffix:
        'Is it ' +
        [
          ...new Set(
            candidates.map(
              (candidate) => expandedSuffixes[candidate.p.suffix] || 'a street without a suffix',
            ),
          ),
        ]
          .slice(0, 3)
          .join(' or ') +
        '?',
      direction: 'Which direction is part of the address: north, south, east, or west?',
      unit: 'What is the apartment or unit number?',
      house: 'What is the house number?',
      street: 'Can you give the full street name?',
    };
    // Show bounded recommendations while continuing to ask for the missing detail.
    const matches = candidates.slice(0, 3).map((candidate) => candidate.record);
    const spokenChoiceLabels = matches.length === 2 ? 'first or second' : 'first, second, or third';
    return this.finish({
      kind: 'choose',
      matches,
      total,
      field: requestedField || 'street',
      prompt:
        questions[requestedField || 'street'] +
        (matches.length
          ? ` You can also choose an address below or say the ${spokenChoiceLabels} one.`
          : ''),
    });
  }
  /**
   * Retrieve ranked entries within supplied locality, house/unit and compatible directions.
   * Optional house-prefix fallback cannot produce an exact match. Prefer exact component matches, then compatible suffixes; stable record IDs
   * break score ties.
   */
  retrieve(addressSlots, allowPrefixMatch = false) {
    let entries = addressSlots.zip
      ? this.byZip.get(addressSlots.zip) || []
      : addressSlots.city
        ? this.byCity.get(addressSlots.city) || []
        : this.entries;
    const rankedCandidates = [];
    for (const candidateEntry of entries) {
      const { record: propertyRecord, p: streetParts } = candidateEntry;
      if (
        this.rejected.has(propertyRecord.id) ||
        (addressSlots.city && propertyRecord.cityKey !== addressSlots.city) ||
        (addressSlots.house &&
          (allowPrefixMatch
            ? !streetParts.house?.startsWith(addressSlots.house)
            : addressSlots.house !== streetParts.house)) ||
        (addressSlots.unit && addressSlots.unit !== streetParts.unit)
      )
        continue;
      if (
        (addressSlots.direction &&
          streetParts.direction &&
          addressSlots.direction !== streetParts.direction) ||
        (addressSlots.postDirection &&
          streetParts.postDirection &&
          addressSlots.postDirection !== streetParts.postDirection)
      )
        continue;
      const sourceName =
        (addressSlots.direction && !streetParts.direction) ||
        (addressSlots.postDirection && !streetParts.postDirection)
          ? joinStreetNameWithDirections(addressSlots)
          : (addressSlots.name || '').replace(/\s/g, '');
      const recordName =
        (addressSlots.direction && !streetParts.direction) ||
        (addressSlots.postDirection && !streetParts.postDirection)
          ? joinStreetNameWithDirections(streetParts)
          : (streetParts.name || '').replace(/\s/g, '');
      const score = addressSlots.name ? calculateStreetNameSimilarity(sourceName, recordName) : 1;
      if (!score) continue;
      const isExactMatch =
        !allowPrefixMatch &&
        !!addressSlots.house &&
        addressSlots.name === streetParts.name &&
        addressSlots.suffix === streetParts.suffix &&
        addressSlots.direction === streetParts.direction &&
        addressSlots.postDirection === streetParts.postDirection &&
        addressSlots.unit === streetParts.unit;
      rankedCandidates.push({
        ...candidateEntry,
        score:
          score - (addressSlots.suffix && addressSlots.suffix !== streetParts.suffix ? 0.15 : 0),
        exact: isExactMatch,
        recovered: !isExactMatch,
      });
    }
    // Try a house prefix only after strict retrieval fails; prefix candidates always require confirmation.
    if (
      !rankedCandidates.length &&
      !allowPrefixMatch &&
      this.allowHousePrefix &&
      addressSlots.house &&
      addressSlots.name
    )
      return this.retrieve(addressSlots, true);
    const exactCandidates = rankedCandidates.filter((candidate) => candidate.exact);
    if (exactCandidates.length) return exactCandidates;
    const suffixCompatibleCandidates = rankedCandidates.filter(
      (candidate) => !addressSlots.suffix || addressSlots.suffix === candidate.p.suffix,
    );
    return (suffixCompatibleCandidates.length ? suffixCompatibleCandidates : rankedCandidates).sort(
      (leftCandidate, rightCandidate) =>
        rightCandidate.score - leftCandidate.score ||
        leftCandidate.record.id - rightCandidate.record.id,
    );
  }
  /**
   * Attach current slot context, retain the response for the next turn and return that same
   * result object.
   */
  finish(result) {
    result.context = formatAddressContext(this.slots);
    this.pending = result;
    return result;
  }
  /**
   * Replace slots with the chosen source address and finish. Callers must pass a displayed candidate; this
   * method itself does not revalidate membership.
   */
  confirm(record) {
    this.slots = {
      ...this.parse(record.street, 'source', [record.cityKey].filter(Boolean)),
      city: record.cityKey,
      zip: record.zipKey,
    };
    return this.finish({
      kind: 'confirmed',
      matches: [record],
      total: 1,
      field: null,
      prompt: '',
    });
  }
}

/**
 * Compare whitespace-joined normalized street names with the shared heuristic similarity score;
 * this is not a probability.
 */
export function streetNameScore(query, name) {
  return calculateStreetNameSimilarity(query.replace(/\s/g, ''), name.replace(/\s/g, ''));
}
