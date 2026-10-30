import { json, requireMethod } from './_lib/http.js';

export default function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;
  const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key } = process.env;
  if (!url || !key) return json(res, 503, { error: 'Anmeldung ist noch nicht eingerichtet.' });
  return json(res, 200, { url, key });
}
