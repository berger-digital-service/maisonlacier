import { hashToken, json, requireMethod, rpc } from './_lib/http.js';

function confirmationPage(html) {
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Newsletter · MAISON L'ACIER</title><body style="font:16px Arial,sans-serif;max-width:40rem;margin:15vh auto;padding:2rem">${html}</body></html>`;
}

export default async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'Methode nicht erlaubt.' }); }
  const token = String(req.method === 'POST' ? req.body?.token || '' : req.query?.token || '');
  const unsubscribe = String(req.method === 'POST' ? req.body?.unsubscribe || '' : req.query?.unsubscribe || '');
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(unsubscribe)) return json(res, 400, { error: 'Ungültiger oder abgelaufener Bestätigungslink.' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).send(confirmationPage(`<h1>Newsletter-Anmeldung bestätigen</h1><p>Mit der Bestätigung abonnierst du den Newsletter von MAISON L'ACIER. Du kannst dich jederzeit abmelden.</p><form method="post"><input type="hidden" name="token" value="${token}"><input type="hidden" name="unsubscribe" value="${unsubscribe}"><button style="padding:12px 18px;background:#1e1b6e;color:white;border:0">Anmeldung bestätigen</button></form>`));
  try {
    const confirmed = await rpc('confirm_newsletter_subscription', { p_token_hash: hashToken(token) });
    if (!confirmed) return res.status(410).send(confirmationPage('<h1>Link ungültig oder abgelaufen.</h1><p>Bitte melde dich erneut über die Website an.</p>'));
    return res.status(200).send(confirmationPage(`<h1>Danke für deine Anmeldung.</h1><p>Deine Newsletter-Adresse wurde bestätigt. Du kannst dich jederzeit wieder abmelden.</p><p><a href="/api/newsletter-unsubscribe?token=${unsubscribe}">Newsletter abbestellen</a></p><p><a href="/">Zurück zu MAISON L’ACIER</a></p>`));
  } catch (error) {
    console.error('newsletter confirmation:', error.message);
    return res.status(500).send(confirmationPage('<h1>Bestätigung fehlgeschlagen.</h1><p>Bitte versuche es später erneut.</p>'));
  }
}
