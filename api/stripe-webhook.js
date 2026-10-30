import { db, escapeHtml, json, requireMethod, rpc, sendEmail, verifyStripeSignature } from './_lib/http.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function deliverOrderEmails() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    const job = await rpc('claim_order_email');
    if (!job) return;
    try {
      const [orders, items] = await Promise.all([
        db(`orders?id=eq.${encodeURIComponent(job.order_id)}&select=*`),
        db(`order_items?order_id=eq.${encodeURIComponent(job.order_id)}&select=product_name,size,finish,engraving,quantity,unit_price_cents`),
      ]);
      const order = orders[0];
      if (!order) throw new Error('Bestellung für die Bestätigungs-E-Mail wurde nicht gefunden.');
      const lines = items.map(item => `<li>${item.quantity} × ${escapeHtml(item.product_name)} · ${escapeHtml(item.size)} · ${escapeHtml(item.finish)}${item.engraving ? ` · Gravur ${escapeHtml(item.engraving)}` : ''} — ${new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(item.unit_price_cents*item.quantity/100)}</li>`).join('');
      const amount = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(order.total_cents/100);
      await sendEmail({
        to: job.email,
        subject: `Bestellung bestätigt · MAISON L'ACIER`,
        text: `Vielen Dank für deine Bestellung. Bestellung ${job.order_id}. Gesamtsumme: ${amount}.`,
        html: `<p>Hallo ${escapeHtml(order.first_name)},</p><p>Vielen Dank für deine Bestellung bei MAISON L'ACIER. Deine Zahlung ist eingegangen.</p><ul>${lines}<li>Versand: ${new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(order.shipping_cents/100)}</li></ul><p><strong>Gesamt: ${amount}</strong></p><p>Bestellnummer: ${escapeHtml(job.order_id)}</p>`,
      });
      await rpc('complete_order_email', { p_id: job.id });
    } catch (error) {
      await rpc('retry_order_email', { p_id: job.id, p_error: error.message }).catch(() => {});
      throw error;
    }
  }
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  try {
    const raw = await rawBody(req);
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'])) return json(res, 400, { error: 'Ungültige Signatur.' });
    const event = JSON.parse(raw);
    const session = event.data?.object;
    if (!session?.metadata?.order_id) return json(res, 200, { received: true });
    const transitions = {
      'checkout.session.completed': session.payment_status === 'paid' ? 'paid' : 'pending',
      'checkout.session.async_payment_succeeded': 'paid',
      'checkout.session.async_payment_failed': 'cancelled',
      'checkout.session.expired': 'cancelled',
    };
    const status = transitions[event.type];
    if (!status) return json(res, 200, { received: true });
    await rpc('record_stripe_event', {
      p_event_id: event.id,
      p_order_id: session.metadata.order_id,
      p_status: status,
      p_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    });
    await deliverOrderEmails();
    return json(res, 200, { received: true });
  } catch (error) {
    console.error('stripe webhook:', error.message);
    return json(res, 400, { error: 'Webhook konnte nicht verarbeitet werden.' });
  }
}
