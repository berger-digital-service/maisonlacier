import { escapeHtml, json, rateLimit, requireMethod, rpc, sendEmail, text, validateEmail } from './_lib/http.js';

const types = new Set(['Frosting-Oberfläche', 'Größe / Passform', 'Gravur', 'Andere Sonderanfertigung']);

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  try {
    await rateLimit(req, 'request', 5);
    const { name, email, type, message, consent } = req.body || {};
    if (consent !== true) throw new Error('Bitte bestätige die Datenschutzhinweise.');
    if (!types.has(type)) throw new Error('Bitte wähle eine gültige Anfrageart.');
    const safeName = text(name, 120, 'Name');
    const safeEmail = validateEmail(email);
    const safeMessage = text(message, 3000, 'Nachricht');
    await rpc('create_customer_request', {
      p_name: safeName,
      p_email: safeEmail,
      p_request_type: type,
      p_message: safeMessage,
      p_consent_at: new Date().toISOString(),
    });
    if (process.env.ADMIN_NOTIFICATION_EMAIL) {
      await sendEmail({ to: process.env.ADMIN_NOTIFICATION_EMAIL, subject: 'Neue Kundenanfrage · MAISON L\'ACIER', text: `${safeName} (${safeEmail}) · ${type}: ${safeMessage}`, html: `<p><strong>${escapeHtml(safeName)}</strong> · ${escapeHtml(safeEmail)} · ${escapeHtml(type)}</p><p>${escapeHtml(safeMessage)}</p>` }).catch(error => console.error('request notification:', error.message));
    }
    return json(res, 200, { message: 'Vielen Dank. Deine Anfrage wurde gespeichert.' });
  } catch (error) {
    console.error('customer request:', error.message);
    return json(res, error.status || 400, { error: error.database ? 'Anfrage konnte nicht gespeichert werden. Bitte versuche es später erneut.' : error.message || 'Anfrage konnte nicht gespeichert werden.' });
  }
}
