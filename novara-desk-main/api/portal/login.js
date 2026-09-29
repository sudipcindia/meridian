// POST /api/portal/login  { email, password } -> { token, must_change_password, client }
const L = require('./_lib');

const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.PORTAL_JWT_SECRET) {
      return L.send(res, 500, { error: 'Portal not configured (missing env vars)' });
    }
    const body = await L.readBody(req);
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    if (!email || !password) return L.send(res, 400, { error: 'Email and password required' });

    const rows = await L.sbSelect('client_portal_users',
      'select=*&email=ilike.' + encodeURIComponent(email) + '&limit=1');
    const u = rows && rows[0];

    // Generic message to avoid leaking which emails exist.
    if (!u || u.status !== 'active') return L.send(res, 401, { error: 'Invalid email or password' });
    if (!u.password_hash) return L.send(res, 403, { error: 'Password not set. Use the setup link emailed to you.', needsSetup: true });
    if (!L.verifyPassword(password, u.password_hash)) return L.send(res, 401, { error: 'Invalid email or password' });

    // Confirm the client is not offboarded.
    const cl = await L.sbSelect('clients', 'select=id,name,offboarded_at&id=eq.' + encodeURIComponent(u.client_id) + '&limit=1');
    const client = cl && cl[0];
    if (!client) return L.send(res, 401, { error: 'Account unavailable' });
    if (client.offboarded_at) return L.send(res, 403, { error: 'Portal access is no longer active for this account.' });

    await L.sbFetch('client_portal_users?id=eq.' + u.id, {
      method: 'PATCH', body: JSON.stringify({ last_login_at: new Date().toISOString() }),
    });

    const token = L.signToken({ cid: u.client_id, email, role: 'client', exp: Date.now() + SESSION_MS });
    return L.send(res, 200, {
      token,
      must_change_password: !!u.must_change_password,
      client: { id: client.id, name: client.name },
    });
  } catch (e) {
    console.error('[portal/login]', e && e.message);
    return L.send(res, 500, { error: 'Server error' });
  }
};
