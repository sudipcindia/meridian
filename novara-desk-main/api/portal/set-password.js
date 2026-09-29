// POST /api/portal/set-password
//   First-time setup:  { email, setup_token, new_password }
//   Change (logged in): Authorization: Bearer <portal token> + { current_password, new_password }
const crypto = require('crypto');
const L = require('./_lib');

// Constant-time compare of two equal-length hex strings (the setup token's
// stored SHA-256 hash vs. one freshly computed from what the client sent).
function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.PORTAL_JWT_SECRET) {
      return L.send(res, 500, { error: 'Portal not configured (missing env vars)' });
    }
    const body = await L.readBody(req);
    const newPassword = String(body.new_password || '');
    if (newPassword.length < 8) return L.send(res, 400, { error: 'Password must be at least 8 characters' });

    let user = null;
    const session = L.verifyAuth(req);

    if (session && session.cid) {
      // Authenticated change — verify current password.
      const rows = await L.sbSelect('client_portal_users',
        'select=*&email=ilike.' + encodeURIComponent(session.email) + '&limit=1');
      user = rows && rows[0];
      if (!user) return L.send(res, 401, { error: 'Account not found' });
      if (user.password_hash && !L.verifyPassword(String(body.current_password || ''), user.password_hash)) {
        return L.send(res, 401, { error: 'Current password is incorrect' });
      }
    } else {
      // First-time setup via emailed token.
      const email = String(body.email || '').toLowerCase().trim();
      const setupToken = String(body.setup_token || '');
      if (!email || !setupToken) return L.send(res, 400, { error: 'Missing setup details' });
      const rows = await L.sbSelect('client_portal_users',
        'select=*&email=ilike.' + encodeURIComponent(email) + '&limit=1');
      user = rows && rows[0];
      // setup_token is stored as a SHA-256 hash (see api/portal/admin-
      // provision.js) — hash what was sent and compare hash-to-hash, never
      // the raw token, and never with a short-circuiting !== on secret data.
      if (!user || !user.setup_token || !safeEqualHex(user.setup_token, L.hashSetupToken(setupToken))) {
        return L.send(res, 401, { error: 'Invalid or expired setup link' });
      }
      if (user.setup_expires_at && Date.now() > new Date(user.setup_expires_at).getTime()) {
        return L.send(res, 401, { error: 'Setup link has expired. Ask your account manager to resend it.' });
      }
    }

    await L.sbFetch('client_portal_users?id=eq.' + user.id, {
      method: 'PATCH',
      body: JSON.stringify({
        password_hash: L.hashPassword(newPassword),
        must_change_password: false,
        setup_token: null,
        setup_expires_at: null,
      }),
    });

    return L.send(res, 200, { ok: true });
  } catch (e) {
    console.error('[portal/set-password]', e && e.message);
    return L.send(res, 500, { error: 'Server error' });
  }
};
