import { json, requireMethod } from './_lib/http.js';
import { validateAddress, validatePostcodeFormat } from './_lib/address-validation.js';

const requestWindows = new Map();

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  let window = requestWindows.get(ip);
  if (!window || now - window.startedAt >= 60_000) window = { startedAt: now, count: 0 };
  if (window.count >= 30) return json(res, 429, { valid: false, error: 'Zu viele Prüfungen. Bitte versuche es gleich erneut.' });
  window.count += 1;
  requestWindows.set(ip, window);
  const { country, postcode, city } = req.body || {};
  if (!['DE', 'AT', 'CH'].includes(country)) return json(res, 400, { valid: false, error: 'Bitte wähle Deutschland, Österreich oder die Schweiz.' });
  if (!validatePostcodeFormat(country, postcode)) return json(res, 200, { valid: false, error: 'Bitte gib eine Postleitzahl im richtigen Format ein.' });
  if (typeof city !== 'string' || !city.trim() || city.trim().length > 100) return json(res, 200, { valid: false, error: 'Bitte gib einen Ort ein.' });

  try {
    const result = await validateAddress({ country, postcode, city });
    return json(res, 200, result.valid
      ? { valid: true, message: 'Postleitzahl und Ort wurden bestätigt.' }
      : { valid: false, error: 'Diese Kombination aus Postleitzahl und Ort wurde im gewählten Land nicht gefunden. Bitte prüfe deine Angaben.' });
  } catch (error) {
    return json(res, error.status || 503, { valid: false, error: error.message || 'Die Adressprüfung ist gerade nicht erreichbar. Bitte versuche es erneut.' });
  }
}
