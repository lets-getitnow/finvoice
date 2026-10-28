/**
 * Parsed record contract: street/city/state/postal_code/property_value retain cleaned
 * source strings. id is a dataset-local integer, values contains distinct numeric USD
 * amounts, count counts accepted source rows, and streetKey/cityKey/zipKey are normalized.
 * Stats count nonblank source rows, exclusions, repeated address/value rows, distinct
 * searchable addresses, conflicting addresses and distinct nonempty source city strings.
 */
/**
 * Pure CSV ingestion and literal address lookup; no DOM, I/O, or persistent state.
 * Records retain source strings, normalized search keys, distinct USD values and row counts.
 * Normalization aids retrieval only; it does not establish source accuracy or provenance.
 */
/** Shared token abbreviations used for both source addresses and user queries. */
const addressTokenAliases = {
  street: 'st',
  avenue: 'ave',
  drive: 'dr',
  road: 'rd',
  boulevard: 'blvd',
  lane: 'ln',
  court: 'ct',
  circle: 'cir',
  place: 'pl',
  parkway: 'pkwy',
  highway: 'hwy',
  terrace: 'ter',
  trail: 'trl',
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  texas: 'tx',
  apartment: 'apt',
  suite: 'ste',
};
/** English number vocabulary; leading zero/oh digits must survive house-number conversion. */
const spokenNumberValues = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
/**
 * Convert a leading number-word run to a digit string. Digit runs concatenate; tens groups
 * concatenate unless hundred/thousand requires arithmetic.
 */
function parseSpokenNumberPhrase(words) {
  if (words.every((numberWord) => spokenNumberValues[numberWord] < 10))
    return words.map((numberWord) => spokenNumberValues[numberWord]).join('');
  if (!words.includes('hundred') && !words.includes('thousand')) {
    const numberGroups = [];
    for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
      if (words[wordIndex] === 'and') continue;
      let numberGroupValue = spokenNumberValues[words[wordIndex]];
      if (
        numberGroupValue >= 20 &&
        spokenNumberValues[words[wordIndex + 1]] > 0 &&
        spokenNumberValues[words[wordIndex + 1]] < 10
      )
        numberGroupValue += spokenNumberValues[words[++wordIndex]];
      numberGroups.push(String(numberGroupValue));
    }
    return numberGroups.join('');
  }
  let completedNumberValue = 0,
    currentNumberValue = 0;
  for (const numberWord of words) {
    if (numberWord === 'hundred') currentNumberValue = (currentNumberValue || 1) * 100;
    else if (numberWord === 'thousand') {
      completedNumberValue += (currentNumberValue || 1) * 1000;
      currentNumberValue = 0;
    } else currentNumberValue += spokenNumberValues[numberWord] || 0;
  }
  return String(completedNumberValue + currentNumberValue);
}
/**
 * Return a lowercase, accent/punctuation-normalized address string with token aliases. Only
 * leading spoken numbers convert; street-name words remain literal.
 */
export function normalize(addressValue) {
  let normalizedAddressText = String(addressValue)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Only interpret number words at the start of the address; street names stay literal.
  const tokens = normalizedAddressText.split(' '),
    leadingNumberWords = [];
  while (
    tokens.length &&
    (tokens[0] in spokenNumberValues || ['hundred', 'thousand', 'and'].includes(tokens[0]))
  )
    leadingNumberWords.push(tokens.shift());
  if (leadingNumberWords.length) tokens.unshift(parseSpokenNumberPhrase(leadingNumberWords));
  return tokens.map((addressToken) => addressTokenAliases[addressToken] || addressToken).join(' ');
}
/**
 * Strip supported conversational prefixes and trailing politeness from a string without
 * interpreting address components.
 */
export function addressQuery(addressValue) {
  return String(addressValue)
    .trim()
    .replace(
      /^(?:(?:hi|hello|hey)[,.!]?\s+)?(?:can you |could you |please )?(?:(?:tell me|give me|what(?:'s| is))\s+)?(?:(?:the )?(?:price|valuation|value)(?: of (?:the )?property)?(?:\s+(?:for|of|at))?\s+|(?:look up|find|search for)\s+|(?:the )?address is\s+)/i,
      '',
    )
    .replace(/\s+(?:please|worth)[?.!]*$/i, '')
    .replace(/[?.!]+$/, '');
}
/**
 * Parse CSV text into {records, stats}. Require the five named columns; throw on malformed
 * structure or no usable records. Exclude missing streets/invalid USD amounts; retain missing
 * locality and conflicting values.
 */
export function parseCSV(csvText) {
  // Stateful scanner preserves commas/newlines inside quotes and handles escaped quotes and CRLF.
  const rows = [];
  let row = [],
    field = '',
    isQuotedField = false;
  csvText = csvText.replace(/^\uFEFF/, '');
  for (let characterIndex = 0; characterIndex < csvText.length; characterIndex++) {
    const character = csvText[characterIndex];
    if (character === '"') {
      if (isQuotedField && csvText[characterIndex + 1] === '"') {
        field += '"';
        characterIndex++;
      } else if (isQuotedField || !field) isQuotedField = !isQuotedField;
      else throw new Error('Unexpected quote in CSV. Export the file as CSV again.');
    } else if (character === ',' && !isQuotedField) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !isQuotedField) {
      if (character === '\r' && csvText[characterIndex + 1] === '\n') characterIndex++;
      row.push(field);
      if (row.some((fieldValue) => fieldValue.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }
  if (isQuotedField)
    throw new Error('The CSV has an unclosed quoted field. Export the file again.');
  row.push(field);
  if (row.some((fieldValue) => fieldValue.trim())) rows.push(row);
  const headers = rows.shift()?.map((fieldValue) => fieldValue.trim().toLowerCase()) || [];
  const requiredColumns = ['street', 'city', 'state', 'postal_code', 'property_value'];
  if (requiredColumns.some((columnName) => !headers.includes(columnName)))
    throw new Error('CSV needs street, city, state, postal_code and property_value columns.');
  // Empty and literal null fields remain missing; values are never filled from another row.
  const cleanCsvField = (fieldValue) =>
    !fieldValue || fieldValue.trim().toLowerCase() === 'null' ? '' : fieldValue.trim();
  const recordsByAddress = new Map();
  let missingStreet = 0,
    invalidValue = 0,
    duplicates = 0,
    sourceRows = 0;
  for (const cells of rows) {
    if (cells.length !== headers.length)
      throw new Error('A CSV row has the wrong number of columns. Export the file again.');
    sourceRows++;
    const propertyRecord = Object.fromEntries(
      requiredColumns.map((columnName) => [
        columnName,
        cleanCsvField(cells[headers.indexOf(columnName)]),
      ]),
    );
    if (!propertyRecord.street) {
      missingStreet++;
      continue;
    }
    // Accept nonnegative dollars with at most two decimals and safely representable cents.
    const normalizedPrice = propertyRecord.property_value.replace(/[$,]/g, '');
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(normalizedPrice) ||
      !Number.isSafeInteger(Math.round(Number(normalizedPrice) * 100))
    ) {
      invalidValue++;
      continue;
    }
    // Group by the entire normalized address, retaining every distinct valuation for review.
    const addressKey = requiredColumns
      .slice(0, 4)
      .map((columnName) => normalize(propertyRecord[columnName]))
      .join('|');
    if (!recordsByAddress.has(addressKey))
      recordsByAddress.set(addressKey, {
        ...propertyRecord,
        id: recordsByAddress.size,
        values: [],
        count: 0,
        streetKey: normalize(propertyRecord.street),
        cityKey: normalize(propertyRecord.city),
        zipKey: normalize(propertyRecord.postal_code),
      });
    const record = recordsByAddress.get(addressKey);
    const valuationAmount = Number(normalizedPrice);
    if (record.values.includes(valuationAmount)) duplicates++;
    else record.values.push(valuationAmount);
    record.count++;
  }
  const records = [...recordsByAddress.values()];
  if (!records.length)
    throw new Error(
      'No usable street addresses with valid valuations were found. Check the export.',
    );
  return {
    records,
    stats: {
      sourceRows,
      missingStreet,
      invalidValue,
      duplicates,
      searchable: records.length,
      conflicts: records.filter((propertyRecord) => propertyRecord.values.length > 1).length,
      cities: new Set(records.map((propertyRecord) => propertyRecord.city).filter(Boolean)).size,
    },
  };
}
/**
 * Return {kind, matches, total} from parsed records and raw text. ZIP filters and exact house
 * numbers constrain retrieval; limit caps displayed matches, not total. Partial matches always
 * require a choice.
 */
export function search(records, rawAddress, limit = 8) {
  const query = normalize(addressQuery(rawAddress));
  if (!query)
    return {
      kind: 'empty',
      matches: [],
      total: 0,
    };
  if (/^\d{5}$/.test(query)) {
    const matches = records.filter((propertyRecord) => propertyRecord.zipKey === query);
    return {
      kind: matches.length ? 'choose' : 'none',
      matches: matches.slice(0, limit),
      total: matches.length,
    };
  }
  const queryTokens = query.split(' '),
    exactMatches = [],
    partialMatches = [];
  for (const propertyRecord of records) {
    const normalizedFullAddress = [
      propertyRecord.streetKey,
      propertyRecord.cityKey,
      normalize(propertyRecord.state),
      propertyRecord.zipKey,
    ]
      .filter(Boolean)
      .join(' ');
    const streetTokens = propertyRecord.streetKey.split(' ');
    // Numeric house numbers must match exactly. Suggestions never silently change a number.
    if (/^\d/.test(queryTokens[0]) && streetTokens[0] !== queryTokens[0]) continue;
    if (
      normalizedFullAddress === query ||
      propertyRecord.streetKey === query ||
      [propertyRecord.streetKey, propertyRecord.cityKey].filter(Boolean).join(' ') === query ||
      [propertyRecord.streetKey, propertyRecord.cityKey, 'tx', propertyRecord.zipKey]
        .filter(Boolean)
        .join(' ') === query ||
      [propertyRecord.streetKey, propertyRecord.cityKey, propertyRecord.zipKey]
        .filter(Boolean)
        .join(' ') === query
    )
      exactMatches.push(propertyRecord);
    else if (
      queryTokens.every((queryToken) =>
        normalizedFullAddress
          .split(' ')
          .some(
            (addressToken) =>
              addressToken === queryToken ||
              (!/^\d/.test(queryToken) && addressToken.startsWith(queryToken)),
          ),
      )
    )
      partialMatches.push(propertyRecord);
  }
  if (exactMatches.length === 1 && partialMatches.length === 0)
    return {
      kind: 'exact',
      matches: exactMatches,
      total: 1,
    };
  const matches = [...exactMatches, ...partialMatches];
  return {
    kind: matches.length ? 'choose' : 'none',
    matches: matches.slice(0, limit),
    total: matches.length,
  };
}
/**
 * Format a record for clarification, omitting absent locality fields rather than inventing them.
 */
export function displayAddress(propertyRecord) {
  return [
    propertyRecord.street,
    [propertyRecord.city, propertyRecord.state || ''].filter(Boolean).join(', '),
    propertyRecord.postal_code,
  ]
    .filter(Boolean)
    .join(' · ');
}
/** Format a numeric USD value for display/speech using US grouping and up to two decimal places. */
export const money = (usdAmount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(usdAmount);
