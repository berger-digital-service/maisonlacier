import { hashToken, json, requireMethod, rpc } from './_lib/http.js';

function page(body) { return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Newsletter abbestellen</title><body style="font:16px Arial,sans-serif;max-width:40rem;margin:15vh auto;padding:2rem">${body}</body></html>`; }

export default async function handler(req, res) {
  const token = String(req.method === 'POST' ? req.body?.token || '' : req.query?.token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) return json(res, 400, { error: 'Ungültiger Abmeldelink.' });
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(page(`<h1>Newsletter abbestellen</h1><p>Möchtest du keine Neuigkeiten mehr von MAISON L'ACIER erhalten?</p><form method="post"><input type="hidden" name="token" value="${token}"><button style="padding:12px 18px;background:#1e1b6e;color:white;border:0">Newsletter abbestellen</button></form>`));
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return json(res, 405, { error: 'Methode nicht erlaubt.' }); }
  try {
    const removed = await rpc('unsubscribe_newsletter', { p_token_hash: hashToken(token) });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(page(removed ? '<h1>Du bist abgemeldet.</h1><p>Du erhältst keine weiteren Newsletter von uns.</p>' : '<h1>Abmeldung nicht möglich.</h1><p>Der Link wurde bereits genutzt oder ist ungültig.</p>'));
  } catch (error) {
    console.error('newsletter unsubscribe:', error.message);
    return json(res, 500, { error: 'Abmeldung fehlgeschlagen.' });
  }
}
