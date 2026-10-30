import { db, json, requireMethod } from './_lib/http.js';

async function requireAdmin(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const projectUrl = process.env.SUPABASE_URL;
  const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!token || !projectUrl || !publishable) throw Object.assign(new Error('Bitte melde dich an.'), { status: 401 });
  const response = await fetch(`${projectUrl.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: publishable, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw Object.assign(new Error('Sitzung abgelaufen. Bitte melde dich erneut an.'), { status: 401 });
  const user = await response.json();
  const admins = await db(`admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id&limit=1`);
  if (!admins.length) throw Object.assign(new Error('Dieses Benutzerkonto hat keinen Administratorzugang.'), { status: 403 });
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) { res.setHeader('Allow', 'GET, PATCH'); return json(res, 405, { error: 'Methode nicht erlaubt.' }); }
  try {
    await requireAdmin(req);
    if (req.method === 'GET') {
      const [orders, items, products, inventory, shipping, requests] = await Promise.all([
        db('orders?select=*&order=created_at.desc&limit=100'), db('order_items?select=*'),
        db('products?select=*&order=price_cents.asc'), db('inventory?select=*&order=product_id,size'),
        db('shipping_rates?select=*order=country'), db('customer_requests?select=*&order=created_at.desc&limit=100'),
      ]);
      const orderItems = items.reduce((groups, item) => { (groups[item.order_id] ||= []).push(item); return groups; }, {});
      return json(res, 200, { orders: orders.map(order => ({ ...order, items: orderItems[order.id] || [] })), products, inventory, shipping, requests });
    }
    const { action, id, country, price_cents, size, stock, patch = {} } = req.body || {};
    if (action === 'inventory') {
      if (!/^[a-z0-9-]{1,48}$/.test(id || '') || !['XS','S','M','L','XL'].includes(size) || !Number.isInteger(stock) || stock < 0 || stock > 10000) throw new Error('Ungültiger Lagerbestand.');
      await db(`inventory?product_id=eq.${encodeURIComponent(id)}&size=eq.${encodeURIComponent(size)}`, { method: 'PATCH', body: { stock }, prefer: 'return=minimal' });
    } else if (action === 'price') {
      if (!/^[a-z0-9-]{1,48}$/.test(id || '') || !Number.isInteger(price_cents) || price_cents < 1 || price_cents > 10000000) throw new Error('Ungültiger Produktpreis.');
      await db(`products?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { price_cents, updated_at: new Date().toISOString() }, prefer: 'return=minimal' });
    } else if (action === 'shipping') {
      if (!['DE','AT','CH'].includes(country) || !Number.isInteger(price_cents) || price_cents < 0 || price_cents > 1000000) throw new Error('Ungültiger Versandpreis.');
      await db('shipping_rates?on_conflict=country', { method: 'POST', body: { country, price_cents, active: true }, prefer: 'resolution=merge-duplicates,return=minimal' });
    } else if (action === 'request') {
      if (!/^[0-9a-f-]{36}$/i.test(id || '') || !['new','in_progress','completed','spam'].includes(patch.status)) throw new Error('Ungültiger Anfragestatus.');
      await db(`customer_requests?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: patch.status }, prefer: 'return=minimal' });
    } else if (action === 'fulfill') {
      if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('Ungültige Bestellnummer.');
      const updated = await db(`orders?id=eq.${encodeURIComponent(id)}&status=eq.paid`, { method: 'PATCH', body: { status: 'fulfilled', fulfilled_at: new Date().toISOString() }, prefer: 'return=representation' });
      if (!updated.length) throw new Error('Nur bezahlte Bestellungen können als versendet markiert werden.');
    } else throw new Error('Unbekannte Aktion.');
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('admin:', error.message);
    return json(res, error.status || 400, { error: error.message || 'Aktion fehlgeschlagen.' });
  }
}
