import { escapeHtml, hashToken, json, publicUrl, randomToken, rateLimit, requireMethod, rpc, validateEmail } from './_lib/http.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  try {
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return json(res, 503, { error: 'Newsletter-E-Mail ist noch nicht eingerichtet.' });
    await rateLimit(req, 'newsletter', 4);
    const email = validateEmail(req.body?.email);
    if (req.body?.consent !== true) throw new Error('Bitte bestätige deine Newsletter-Anmeldung.');
    const token = randomToken();
    const unsubscribe = randomToken();
    const result = await rpc('start_newsletter_subscription', {
      p_email: email,
      p_token_hash: hashToken(token),
      p_unsubscribe_hash: hashToken(unsubscribe),
      p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (result === 'subscribed') return json(res, 200, { message: 'Du bist bereits für unseren Newsletter angemeldet.' });
    const confirmUrl = `${publicUrl(req)}/api/newsletter-confirm?token=${token}&unsubscribe=${unsubscribe}`;
    const html = `<p>Danke für dein Interesse an MAISON L'ACIER.</p><p><a href="${escapeHtml(confirmUrl)}">Newsletter-Anmeldung bestätigen</a></p><p>Der Link ist 24 Stunden gültig. Wenn du dich nicht angemeldet hast, kannst du diese Nachricht ignorieren.</p>`;
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: 'Bitte bestätige deine Newsletter-Anmeldung', html }),
    });
    if (!sent.ok) throw new Error('Bestätigungs-E-Mail konnte nicht gesendet werden.');
    return json(res, 200, { message: 'Fast geschafft: Bitte bestätige deine Anmeldung über den Link in deiner E-Mail.' });
  } catch (error) {
    console.error('newsletter:', error.message);
    return json(res, error.status || 400, { error: error.database ? 'Newsletter-Anmeldung fehlgeschlagen. Bitte versuche es später erneut.' : error.message || 'Newsletter-Anmeldung fehlgeschlagen.' });
  }
}
