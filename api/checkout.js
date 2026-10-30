import { db, json, publicUrl, rateLimit, requireMethod, rpc, text, validateEmail } from './_lib/http.js';

function stripeForm(order, origin, customer) {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('payment_method_types[0]', 'card');
  form.set('success_url', `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  form.set('cancel_url', `${origin}/?checkout=cancelled`);
  form.set('client_reference_id', order.id);
  form.set('expires_at', String(Math.floor(Date.now() / 1000) + 60 * 60));
  form.set('customer_email', customer.email);
  form.set('customer_creation', 'always');
  form.set('billing_address_collection', 'required');
  form.set('shipping_address_collection[allowed_countries][0]', customer.country);
  form.set('metadata[order_id]', order.id);
  form.set('custom_text[submit][message]', 'Deine Bestellung wird nach erfolgreicher Zahlung bestätigt.');
  order.items.forEach((item, i) => {
    const line = `line_items[${i}]`;
    form.set(`${line}[quantity]`, String(item.quantity));
    form.set(`${line}[price_data][currency]`, 'eur');
    form.set(`${line}[price_data][unit_amount]`, String(item.unit_price_cents));
    form.set(`${line}[price_data][product_data][name]`, `${item.product_name} · ${item.size} · ${item.finish === 'frosting' ? 'Frosting' : 'Poliert'}${item.engraving ? ` · Gravur: ${item.engraving}` : ''}`);
    form.set(`${line}[price_data][product_data][metadata][product_id]`, item.product_id);
    form.set(`${line}[price_data][product_data][metadata][size]`, item.size);
  });
  const shippingLine = order.items.length;
  form.set(`line_items[${shippingLine}][quantity]`, '1');
  form.set(`line_items[${shippingLine}][price_data][currency]`, 'eur');
  form.set(`line_items[${shippingLine}][price_data][unit_amount]`, String(order.shipping_cents));
  form.set(`line_items[${shippingLine}][price_data][product_data][name]`, `Versand nach ${customer.country}`);
  form.set('locale', 'de');
  return form;
}

async function stripeRequest(form, idempotencyKey) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY fehlt.');
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': idempotencyKey },
    body: form,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Stripe Checkout konnte nicht gestartet werden.');
  return result;
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'POST')) return;
  if (process.env.STORE_ENABLED !== 'true') return json(res, 503, { error: 'Der Shop-Checkout ist noch nicht für den Verkauf freigegeben.' });
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.SITE_URL) {
    return json(res, 503, { error: 'Checkout, Zahlungsbestätigung oder Bestell-E-Mail ist noch nicht vollständig eingerichtet.' });
  }
  let orderId;
  try {
    await rateLimit(req, 'checkout', 8);
    const { customer, items, acceptedTerms } = req.body || {};
    if (acceptedTerms !== true) throw new Error('Bitte bestätige AGB und Widerrufsbelehrung.');
    const shipping = {
      first_name: text(customer?.firstName, 80, 'Vorname'),
      last_name: text(customer?.lastName, 80, 'Nachname'),
      email: validateEmail(customer?.email),
      address: text(customer?.address, 160, 'Straße und Hausnummer'),
      postcode: text(customer?.postcode, 20, 'Postleitzahl'),
      city: text(customer?.city, 100, 'Ort'),
      country: ['DE', 'AT', 'CH'].includes(customer?.country) ? customer.country : (() => { throw new Error('Lieferland wird nicht unterstützt.'); })(),
    };
    if (!Array.isArray(items) || !items.length || items.length > 15) throw new Error('Der Warenkorb ist leer oder enthält zu viele Positionen.');
    const order = await rpc('create_store_order', {
      p_customer: shipping,
      p_items: items.map(item => ({
        product_id: text(item?.id, 48, 'Produkt'),
        size: text(item?.size, 3, 'Größe'),
        finish: item?.finish === 'frosting' ? 'frosting' : 'poliert',
        engraving: item?.engraving ? text(item.engraving, 18, 'Gravur') : '',
        quantity: Math.max(1, Math.min(5, Number.parseInt(item?.qty, 10) || 1)),
      })),
      p_agreed_to_terms: acceptedTerms,
    });
    orderId = order.id;
    const origin = publicUrl(req);
    const session = await stripeRequest(stripeForm(order, origin, shipping), `order-${order.id}`);
    try {
      await db(`orders?id=eq.${encodeURIComponent(order.id)}`, { method: 'PATCH', body: { stripe_session_id: session.id }, prefer: 'return=minimal' });
    } catch (error) {
      await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session.id)}/expire`, {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
      }).catch(() => {});
      throw error;
    }
    return json(res, 200, { url: session.url });
  } catch (error) {
    if (orderId) await rpc('cancel_store_order', { p_order_id: orderId }).catch(() => {});
    console.error('checkout:', error.message);
    const status = error.status || (orderId ? 502 : error.message.includes('fehlt') || error.message.includes('konfiguriert') ? 503 : 400);
    const businessErrors = ['Ungültiger Warenkorb.','Lieferland wird nicht unterstützt.','Eine gewählte Größe ist nicht mehr verfügbar.','Produkt nicht verfügbar.','Ungültige Produktoption.','Der Versandpreis für das gewählte Land wurde noch nicht eingerichtet.'];
    const message = error.database ? (businessErrors.includes(error.message) ? error.message : 'Die Bestellung konnte nicht gestartet werden.') : status >= 500 ? 'Die Bestellung konnte nicht gestartet werden.' : error.message;
    return json(res, status, { error: message });
  }
}
