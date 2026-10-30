import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

export function requireMethod(req, res, method) {
  if (req.method === method) return true;
  res.setHeader('Allow', method);
  json(res, 405, { error: 'Methode nicht erlaubt.' });
  return false;
}

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase ist noch nicht konfiguriert.');
  return { url: url.replace(/\/$/, ''), key };
}

export async function db(path, { method = 'GET', body, headers = {}, prefer } = {}) {
  const { url, key } = getSupabase();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'Datenbankanfrage fehlgeschlagen.');
    error.status = response.status;
    error.database = true;
    throw error;
  }
  return data;
}

export async function rpc(name, args = {}) {
  return db(`rpc/${name}`, { method: 'POST', body: args });
}

export function publicUrl(req) {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL) throw new Error('SITE_URL fehlt.');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host || /[\r\n/@]/.test(host)) throw new Error('SITE_URL fehlt.');
  const proto = req.headers['x-forwarded-proto'] === 'http' && /localhost|127\.0\.0\.1/.test(host) ? 'http' : 'https';
  return `${proto}://${host}`;
}

export function clientIpHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  return createHash('sha256').update(`${process.env.RATE_LIMIT_SALT || 'configure-a-random-secret'}:${ip}`).digest('hex');
}

export async function rateLimit(req, bucket, limit = 6) {
  const result = await rpc('consume_rate_limit', {
    p_bucket: bucket,
    p_subject: clientIpHash(req),
    p_limit: limit,
    p_window_seconds: 900,
  });
  if (!result?.allowed) {
    const error = new Error('Zu viele Anfragen. Bitte versuche es später erneut.');
    error.status = 429;
    throw error;
  }
}

export function validateEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Bitte gib eine gültige E-Mail-Adresse ein.');
  return email;
}

export function text(value, max, field) {
  const result = String(value || '').trim();
  if (!result || result.length > max) throw new Error(`${field} fehlt oder ist zu lang.`);
  return result;
}

export function randomToken() { return randomBytes(32).toString('hex'); }
export function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }

export async function sendEmail({ to, subject, html, text: textBody }) {
  if (!process.env.RESEND_API_KEY) return false;
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM fehlt.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text: textBody }),
  });
  if (!response.ok) throw new Error('E-Mail konnte nicht versendet werden.');
  return true;
}

export function verifyStripeSignature(rawBody, header) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const fields = Object.fromEntries(header.split(',').map(part => part.split('=')));
  const timestamp = Number(fields.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  return String(fields.v1 || '').split(' ').some(value => {
    try {
      const actual = Buffer.from(value, 'hex');
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch { return false; }
  });
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
