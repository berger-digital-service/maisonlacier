import { json, requireMethod } from './_lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const id = String(req.query?.session_id || '');
  if (!/^cs_(test|live)_[a-zA-Z0-9]+$/.test(id)) return json(res, 400, { error: 'Ungültige Checkout-Sitzung.' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(res, 503, { error: 'Zahlungsstatus ist noch nicht eingerichtet.' });
  try {
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` } });
    const session = await response.json();
    if (!response.ok) return json(res, 404, { error: 'Checkout-Sitzung wurde nicht gefunden.' });
    return json(res, 200, { paid: session.status === 'complete' && session.payment_status === 'paid' });
  } catch (error) {
    console.error('checkout status:', error.message);
    return json(res, 503, { error: 'Zahlungsstatus konnte nicht abgerufen werden.' });
  }
}
