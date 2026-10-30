const COUNTRY_PATH = { DE: 'de', AT: 'at', CH: 'ch' };
const POSTCODE_FORMAT = { DE: /^\d{5}$/, AT: /^\d{4}$/, CH: /^\d{4}$/ };

function normalizePlace(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ß/g, 'ss')
    .toLocaleLowerCase('de')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function placeNames(locality) {
  return [
    locality?.name,
    locality?.municipality?.name,
    locality?.commune?.name,
  ].filter(Boolean);
}

export function validatePostcodeFormat(country, postcode) {
  return Boolean(POSTCODE_FORMAT[country]?.test(String(postcode || '').trim()));
}

export async function validateAddress({ country, postcode, city }) {
  const path = COUNTRY_PATH[country];
  const normalizedPostcode = String(postcode || '').trim();
  const normalizedCity = String(city || '').trim();

  if (!path) return { valid: false, reason: 'country' };
  if (!validatePostcodeFormat(country, normalizedPostcode)) return { valid: false, reason: 'postcode-format' };
  if (!normalizedCity || normalizedCity.length > 100) return { valid: false, reason: 'city' };

  const url = new URL(`https://openplzapi.org/${path}/Localities`);
  url.searchParams.set('postalCode', normalizedPostcode);
  url.searchParams.set('name', normalizedCity);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
  } catch {
    const error = new Error('Die Adressprüfung ist gerade nicht erreichbar. Bitte versuche es erneut.');
    error.status = 503;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Die Adressprüfung ist gerade nicht erreichbar. Bitte versuche es erneut.');
    error.status = 503;
    throw error;
  }

  let results;
  try {
    const data = await response.json();
    results = Array.isArray(data) ? data : data ? [data] : [];
  } catch {
    const error = new Error('Die Adressprüfung ist gerade nicht erreichbar. Bitte versuche es erneut.');
    error.status = 503;
    throw error;
  }

  const target = normalizePlace(normalizedCity);
  const match = results.some(locality => {
    const returnedPostcode = String(locality?.postalCode || '').trim();
    return returnedPostcode === normalizedPostcode && placeNames(locality).some(name => normalizePlace(name) === target);
  });
  return { valid: match, reason: match ? null : 'place-mismatch' };
}
