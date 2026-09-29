// POST /api/portal/admin-provision  { client_id, email }   (STAFF ONLY)
// Creates/refreshes a client_portal_users row with a one-time setup token and
// emails the client a "set your password" link. Returns the setup link too so
// staff can share it manually if needed.
//
// POST /api/portal/admin-provision?action=preview-token  { client_id }   (STAFF ONLY)
// Issues a short-lived, read-only "Developer Preview Mode" token for a client's
// portal. Merged in from the former api/portal/preview-token.js (identical logic,
// byte-for-byte) to stay under the Vercel Hobby plan's 12-function cap — this file
// already shares the same staff-only, requireElevated auth gate and client_id shape.
const crypto = require('crypto');
const L = require('./_lib');

const SETUP_MS = 7 * 24 * 60 * 60 * 1000; // setup link valid 7 days
const SETUP_HOURS = SETUP_MS / (60 * 60 * 1000);
const PREVIEW_MS = 2 * 60 * 60 * 1000; // preview token valid 2 hours, read-only

function originOf(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return proto + '://' + host;
}

// Delivers the password setup/reset link by invoking the SAME Supabase Edge
// Function ("notify-email") that staff ticket notifications already use —
// reusing its already-configured RESEND_API_KEY (a Supabase function secret)
// rather than requiring a second copy of that credential as a Vercel env var
// (which was never set here — the previous direct-Resend-call version of
// this function always failed with "RESEND_API_KEY not set" and silently
// fell back to a manual-share prompt, which is why the email was never
// actually delivered). Never returns ok:true unless the Edge Function (and,
// inside it, Resend) actually confirmed the send.
async function sendSetupEmail(to, clientName, link, isReset) {
  let r;
  try {
    r = await L.invokeEdgeFunction('notify-email', {
      user_email: to,
      type: 'portal_setup',
      title: isReset ? 'Reset your Client Portal password' : 'Set up your Client Portal password',
      client_name: clientName,
      is_reset: !!isReset,
      setup_link: link,
      expires_hours: SETUP_HOURS,
    });
  } catch (e) {
    return { ok: false, error: e && e.message || 'Could not reach the email service' };
  }
  if (!r.ok) {
    const d = r.data;
    const msg = (d && d.error && (d.error.message || (typeof d.error === 'string' ? d.error : JSON.stringify(d.error)))) || ('Email service returned HTTP ' + r.status);
    return { ok: false, error: msg };
  }
  return { ok: true, id: r.data && r.data.id };
}

// GET /api/portal/admin-provision?client_id=<id>   (STAFF ONLY)
// Read-only status lookup for the Client Card "Creds" panel — never returns
// password_hash or setup_token, never mutates the row, never sends an email.
// POST /api/portal/admin-provision?action=preview-token  { client_id }  (STAFF ONLY)
// Unchanged from the former api/portal/preview-token.js.
async function handlePreviewToken(req, res, staff) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
  const body = await L.readBody(req);
  const clientId = String(body.client_id || '');
  if (!clientId) return L.send(res, 400, { error: 'Missing client_id' });

  const cl = await L.sbSelect('clients', 'select=id,name&id=eq.' + encodeURIComponent(clientId) + '&limit=1');
  const client = cl && cl[0];
  if (!client) return L.send(res, 404, { error: 'Client not found' });

  const token = L.signToken({
    cid: clientId, email: staff.email, role: 'preview',
    previewBy: staff.name, exp: Date.now() + PREVIEW_MS,
  });
  // AUDIT (token itself never logged): who previewed which client's portal.
  console.log('[portal/preview-token] AUDIT preview issued', { by: staff.email, client_id: clientId });
  return L.send(res, 200, { token, client: { id: client.id, name: client.name } });
}

// POST /api/portal/admin-provision?action=delete-report  { id }   (STAFF ONLY, Developer department only)
// Client Reports (2026-09-28): soft-deletes one client_report_deliveries
// row — never a hard delete, so it stays as a permanent audit record (spec:
// "never overwrite/delete underlying history"), just excluded from the
// Client Portal and the internal Reports-tab active view. This is the ONLY
// path that can ever set is_deleted on that table — its own migration
// (add_client_report_deliveries.sql) gives `authenticated` no UPDATE policy
// at all, so a direct Supabase call from a non-Developer's browser console
// cannot do this no matter what the UI shows. requireElevated (above) only
// gets a caller as far as Admin/Developer/Operations; the stricter
// department === 'Developer' check below is the real, spec-required gate —
// hiding the Delete button for everyone else in index.html is defense in
// depth on top of this, never the actual enforcement.
async function handleDeleteReport(req, res, staff) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed' });
  if (staff.department !== 'Developer') return L.send(res, 403, { error: 'Deleting a report requires the Developer role' });
  const body = await L.readBody(req);
  const id = String(body.id || '');
  if (!id) return L.send(res, 400, { error: 'Missing id' });

  const rows = await L.sbSelect('client_report_deliveries', 'select=id&id=eq.' + encodeURIComponent(id) + '&limit=1');
  if (!rows || !rows[0]) return L.send(res, 404, { error: 'Report not found' });

  await L.sbFetch('client_report_deliveries?id=eq.' + encodeURIComponent(id), {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ is_deleted: true, status: 'deleted', deleted_at: new Date().toISOString(), deleted_by: staff.id }),
  });
  console.log('[portal/admin-provision] AUDIT report deleted', { by: staff.email, report_id: id });
  return L.send(res, 200, { ok: true });
}

module.exports = async function handler(req, res) {
  const action = (req.query && req.query.action) || '';
  if (action !== 'preview-token' && action !== 'delete-report' && req.method !== 'POST' && req.method !== 'GET') return L.send(res, 405, { error: 'Method not allowed' });
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.PORTAL_JWT_SECRET) {
      return L.send(res, 500, { error: 'Portal not configured (missing env vars)' });
    }
    const staff = await L.verifyStaff(req, { requireElevated: true });
    if (!staff) return L.send(res, 403, { error: 'Staff access required' });

    if (action === 'preview-token') return handlePreviewToken(req, res, staff);
    if (action === 'delete-report') return handleDeleteReport(req, res, staff);

    if (req.method === 'GET') {
      const clientId = String((req.query && req.query.client_id) || '');
      if (!clientId) return L.send(res, 400, { error: 'Missing client_id' });
      // Multiple portal accounts per client (2026-09): every row for this
      // client_id is returned as `users`, oldest first, so a client with
      // several logins (e.g. Vishal Test's second QA email) shows one entry
      // per account. The original top-level registered/email/status/etc
      // fields are kept exactly as before — populated from the OLDEST row —
      // so the existing single-account Creds-modal view (renderPortalAccessBoxInner)
      // needs no changes and keeps showing the same thing it always has.
      const rows = await L.sbSelect('client_portal_users',
        'select=email,status,must_change_password,last_login_at,created_at&client_id=eq.' + encodeURIComponent(clientId) + '&order=created_at.asc');
      const list = rows || [];
      const users = list.map(u => ({
        email: u.email, status: u.status, must_change_password: !!u.must_change_password,
        last_login_at: u.last_login_at || null, created_at: u.created_at || null,
      }));
      const primary = list[0];
      if (!primary) return L.send(res, 200, { registered: false, users: [] });
      return L.send(res, 200, {
        registered: true,
        email: primary.email,
        status: primary.status,
        must_change_password: !!primary.must_change_password,
        last_login_at: primary.last_login_at || null,
        created_at: primary.created_at || null,
        users,
      });
    }

    const body = await L.readBody(req);
    const clientId = String(body.client_id || '');
    if (!clientId) return L.send(res, 400, { error: 'Missing client_id' });

    const cl = await L.sbSelect('clients', 'select=id,name,contact_email&id=eq.' + encodeURIComponent(clientId) + '&limit=1');
    const client = cl && cl[0];
    if (!client) return L.send(res, 404, { error: 'Client not found' });

    // Multiple portal accounts per client (2026-09): the row this action
    // targets is now resolved by (client_id, email) whenever an email is
    // given, not just by client_id. This is NOT a behavior change for the
    // existing single-account case — renderPortalAccessBoxInner's Reset/
    // Resend buttons already pass that account's own email on every call
    // (provisionPortal(clientId, emailArg)), so the lookup still finds the
    // exact same row it always did. What's new is that passing a DIFFERENT
    // email that has no row yet creates a genuinely separate portal account
    // for the same client_id, rather than resetting the first/only one —
    // this is what lets a client have more than one independent login.
    // Only the very first-ever "Register Portal" click for a client with
    // zero rows and no email argument falls back to the client's own
    // contact_email, exactly as before.
    const requestedEmail = String(body.email || '').toLowerCase().trim();
    let existing;
    if (requestedEmail) {
      const rows = await L.sbSelect('client_portal_users',
        'select=id,email&client_id=eq.' + encodeURIComponent(clientId) + '&email=eq.' + encodeURIComponent(requestedEmail) + '&limit=1');
      existing = rows && rows[0];
    } else {
      const rows = await L.sbSelect('client_portal_users',
        'select=id,email&client_id=eq.' + encodeURIComponent(clientId) + '&order=created_at.asc&limit=1');
      existing = rows && rows[0];
    }
    const email = existing ? existing.email : (requestedEmail || String(client.contact_email || '').toLowerCase().trim());
    if (!email) return L.send(res, 400, { error: 'No email on file for this client' });

    if (!existing) {
      // A genuinely new account is about to be created (either the client's
      // very first, or an additional one) — validate format and check for a
      // cross-client collision. login.js resolves a session's client_id
      // purely from whichever client_portal_users row matches the submitted
      // email, so the same email registered under two different clients
      // would make login resolve to an arbitrary one of them — reject that
      // outright rather than create an ambiguous account.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return L.send(res, 400, { error: 'Invalid email format' });
      const clash = await L.sbSelect('client_portal_users', 'select=client_id&email=eq.' + encodeURIComponent(email) + '&limit=1');
      if (clash && clash[0] && clash[0].client_id !== clientId) {
        return L.send(res, 409, { error: 'This email is already registered to a different client' });
      }
    }

    const setupToken = crypto.randomBytes(24).toString('hex'); // raw token — only ever leaves this request in the one email sent below
    const setupTokenHash = L.hashSetupToken(setupToken); // this is what actually gets stored
    const setupExpires = new Date(Date.now() + SETUP_MS).toISOString();
    const provisionAction = existing ? 'reset' : 'register';

    if (existing) {
      await L.sbFetch('client_portal_users?id=eq.' + existing.id, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ client_id: clientId, status: 'active', setup_token: setupTokenHash, setup_expires_at: setupExpires, must_change_password: true }),
      });
    } else {
      await L.sbFetch('client_portal_users', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ client_id: clientId, email, status: 'active', setup_token: setupTokenHash, setup_expires_at: setupExpires, must_change_password: true, created_by: staff.email }),
      });
    }

    const link = originOf(req) + '/portal#setup=' + setupToken + '&email=' + encodeURIComponent(email);
    const mail = await sendSetupEmail(email, client.name, link, provisionAction === 'reset');
    // AUDIT — the recipient email is logged (useful for support), the raw
    // token/link/password never are.
    console.log('[portal/admin-provision] AUDIT', { by: staff.email, client_id: clientId, action: provisionAction, to: email, emailed: mail.ok, email_error: mail.ok ? null : mail.error });
    // The raw link is only ever handed back to staff as a manual-share
    // fallback when the email genuinely failed to send — never alongside a
    // real "emailed" success, and never logged.
    return L.send(res, 200, { ok: true, email, emailed: mail.ok, emailError: mail.error || null, setupLink: mail.ok ? null : link });
  } catch (e) {
    console.error('[portal/admin-provision]', e && e.message);
    return L.send(res, 500, { error: 'Server error' });
  }
};
