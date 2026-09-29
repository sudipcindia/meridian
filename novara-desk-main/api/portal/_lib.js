// ============================================================================
// Client Portal — shared serverless helpers (zero dependencies)
// ----------------------------------------------------------------------------
// All client data flows through these endpoints. The portal frontend holds NO
// Supabase key; this module talks to Supabase with the SERVICE ROLE key, scopes
// every query to a single client, and sanitizes ticket threads.
//
// Required env vars (Vercel project settings):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PORTAL_JWT_SECRET
// ============================================================================
const crypto = require('crypto');

const SB_URL = process.env.SUPABASE_URL || 'https://lftrnhxzdzqyrvazvpdo.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JWT_SECRET = process.env.PORTAL_JWT_SECRET || '';

// Comm modes a client is allowed to see. Allowlist (not blocklist) so any future
// internal-only mode is hidden by default. Mirrors index.html client-out tab.
const CLIENT_COMM_MODES = new Set([
  'client-out', 'client-in',
  'telegram-in', 'telegram-out', 'telegram',
  'ticket-thread-in', 'ticket-thread-out', 'ticket-thread-header',
]);

// --- base64url helpers ------------------------------------------------------
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

// --- stateless session token (HMAC-SHA256) ----------------------------------
// token = base64url(payloadJSON) + "." + base64url(hmac)
function signToken(payload) {
  if (!JWT_SECRET) throw new Error('PORTAL_JWT_SECRET not set');
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', JWT_SECRET).update(body).digest());
  return body + '.' + sig;
}
function readToken(token) {
  if (!token || !JWT_SECRET) return null;
  const parts = String(token).split('.');
  if (parts.length !== 2) return null;
  const expected = b64url(crypto.createHmac('sha256', JWT_SECRET).update(parts[0]).digest());
  // constant-time compare
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(parts[0]).toString('utf8')); } catch { return null; }
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}

// --- password hashing (scrypt) ----------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password), salt, 64);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// --- Supabase PostgREST (service role) --------------------------------------
async function sbFetch(path, opts = {}) {
  const url = SB_URL + '/rest/v1/' + path;
  const headers = Object.assign({
    'apikey': SERVICE_KEY,
    'Authorization': 'Bearer ' + SERVICE_KEY,
    'Content-Type': 'application/json',
  }, opts.headers || {});
  const r = await fetch(url, Object.assign({}, opts, { headers }));
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const err = new Error((data && data.message) || ('Supabase error ' + r.status));
    err.status = r.status; err.body = data;
    throw err;
  }
  return data;
}

// Convenience: select with full PostgREST query string (already encoded).
function sbSelect(table, query) {
  return sbFetch(table + '?' + query, { method: 'GET' });
}

// Durable, race-free ticket communication write — the server-side twin of
// index.html's appendTicketComm(). Inserts ONE row into the append-only
// ticket_communications table with a unique idempotency_key (a retry safely
// no-ops via ON CONFLICT DO NOTHING instead of duplicating); a DB trigger
// atomically mirrors it into legacy tickets.comms via `comms = comms || x`,
// serialized correctly under Postgres's row-level lock regardless of who
// else is writing to the same ticket at the same moment. This replaces the
// old "SELECT comms, splice in JS, PATCH whole row" pattern that a client
// portal reply and an internal desk send could race against each other on.
// Returns the new row's id (for wiring a Resend send result back onto it),
// or null if it was a duplicate/failed and no id could be resolved.
async function appendTicketCommunication({
  ticketId, clientId = null, senderType, senderId = null, direction,
  visibility = 'client_visible', messageType = 'text', subject = null,
  body = '', attachments = [], idempotencyKey, legacyCommId, metadata = {},
  createdBy = null,
}) {
  const row = {
    ticket_id: ticketId, client_id: clientId, sender_type: senderType,
    sender_id: senderId, direction, visibility, message_type: messageType,
    subject, body: body || '', attachments: attachments || [],
    idempotency_key: idempotencyKey, legacy_comm_id: legacyCommId,
    source: 'live', created_by: createdBy, metadata: metadata || {},
  };
  let inserted = null;
  try {
    inserted = await sbFetch('ticket_communications', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(row),
    });
  } catch (e) {
    console.error('[appendTicketCommunication] insert failed', e && e.message);
    throw e;
  }
  let commId = Array.isArray(inserted) && inserted[0] && inserted[0].id;
  if (!commId) {
    // ignore-duplicates returns an empty array on conflict — the row already
    // exists from an earlier attempt of this same idempotency key.
    try {
      const existing = await sbSelect('ticket_communications', 'select=id&idempotency_key=eq.' + encodeURIComponent(idempotencyKey) + '&limit=1');
      commId = existing && existing[0] && existing[0].id;
    } catch (_) { /* best-effort */ }
  }
  return commId || null;
}

// --- Supabase Edge Functions (service role) ---------------------------------
// Invokes a deployed Edge Function directly, server-to-server, authenticating
// with the service role key (Supabase's Functions gateway accepts it as a
// valid JWT). Used so Vercel-side code can reuse an Edge Function's OWN
// secrets (e.g. notify-email's already-configured RESEND_API_KEY, a Supabase
// function secret) instead of requiring a second, separately-configured copy
// of the same credential in Vercel's env vars.
async function invokeEdgeFunction(slug, payload) {
  const r = await fetch(SB_URL + '/functions/v1/' + slug, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + SERVICE_KEY, 'apikey': SERVICE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

// Setup/reset tokens are stored as a SHA-256 hash, never the raw value — the
// raw token only ever exists transiently (in this request, and in the one
// email it's sent in). A leaked DB row can't be replayed as a valid link.
function hashSetupToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

// --- storage (service role) --------------------------------------------------
// Uploads a data: URL (or bare base64 + mime type) to a Supabase Storage
// bucket and returns its public URL. Used so client-portal file/voice-note
// uploads land as real storage objects (same "ticket-attachments" bucket the
// internal app already uses) instead of being persisted as base64 in the
// tickets row — the base64 only ever exists transiently, in this request's
// memory, on the way to the same bucket.
function parseDataUrl(input) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(String(input || ''));
  if (m) return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
  return null;
}
async function uploadBase64ToStorage(bucket, path, dataUrlOrBase64, fallbackMime) {
  const parsed = parseDataUrl(dataUrlOrBase64) || { mime: fallbackMime || 'application/octet-stream', buf: Buffer.from(String(dataUrlOrBase64 || ''), 'base64') };
  if (!parsed.buf || !parsed.buf.length) throw new Error('Empty file');
  if (parsed.buf.length > 25 * 1024 * 1024) throw new Error('File too large (25MB max)');
  const url = SB_URL + '/storage/v1/object/' + bucket + '/' + path;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': parsed.mime,
      'x-upsert': 'true',
    },
    body: parsed.buf,
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('Storage upload failed: ' + r.status + ' ' + t.slice(0, 200));
  }
  return SB_URL + '/storage/v1/object/public/' + bucket + '/' + path;
}
function safeFileName(name) {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}
// Best-effort storage cleanup for edit (re-record) / delete of a client
// comment — never throws, since a failed cleanup should never block the
// edit/delete itself (an orphaned storage object is a minor cost; a stuck
// UI is not).
async function deleteFromStorage(bucket, path) {
  try {
    await fetch(SB_URL + '/storage/v1/object/' + bucket + '/' + path, {
      method: 'DELETE',
      headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY },
    });
  } catch (e) { /* best-effort */ }
}
// Recovers the bucket-relative path from one of our own public storage URLs
// (the exact inverse of uploadBase64ToStorage's return value) so a re-record
// or delete can clean up the old object. Returns null for anything else
// (e.g. a URL from a different bucket/host), which callers treat as "nothing
// to clean up" rather than an error.
function storagePathFromPublicUrl(bucket, url) {
  const prefix = SB_URL + '/storage/v1/object/public/' + bucket + '/';
  return (typeof url === 'string' && url.startsWith(prefix)) ? url.slice(prefix.length) : null;
}

// --- auth verification ------------------------------------------------------
function bearer(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

// Verify a client (or preview) portal session. Returns the token payload or null.
function verifyAuth(req) {
  return readToken(bearer(req));
}

// Verify a STAFF caller by their Supabase auth access token, then confirm the
// email is a team member. opts.requireElevated => must be admin or Developer/Operations.
async function verifyStaff(req, opts = {}) {
  const token = bearer(req);
  if (!token) return null;
  const r = await fetch(SB_URL + '/auth/v1/user', {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + token },
  });
  if (!r.ok) return null;
  const user = await r.json();
  const email = (user && user.email || '').toLowerCase().trim();
  if (!email) return null;
  const members = await sbSelect('team_members',
    'select=id,name,email,role,department,status&email=ilike.' + encodeURIComponent(email) + '&limit=1');
  const me = members && members[0];
  if (!me) return null;
  // Offboarding (team_members.status='offboarded') must revoke API access too,
  // not just the UI's own ALLOWED_EMAILS gate and their in-app role/department
  // — otherwise a former team_member row with role='admin'/department in
  // ('Developer','Operations') would still pass requireElevated forever.
  if (me.status === 'offboarded') return null;
  if (opts.requireElevated) {
    const ok = me.role === 'admin' || me.department === 'Developer' || me.department === 'Operations';
    if (!ok) return null;
  }
  return me;
}

// --- sanitization -----------------------------------------------------------
// Strip internal comms and any internal-only fields before returning a thread.
// `teamById` (optional, {id: {name}}) resolves a staff author's id to a
// display name — never their email/internal id — so the client sees "Sarah"
// instead of a bare id or nothing at all.
function sanitizeComms(comms, teamById) {
  if (!Array.isArray(comms)) return [];
  return comms
    .filter(m => m && CLIENT_COMM_MODES.has(m.mode))
    .map(m => {
      const fromClient = m.mode === 'client-in' || m.mode === 'telegram-in' || m.mode === 'ticket-thread-in';
      const authorName = fromClient
        ? null // the client's own messages don't need a resolved name — the UI already knows they're "you"
        : (teamById && m.author && teamById[m.author] && teamById[m.author].name) || 'Meridian Team';
      return {
        id: m.id,
        mode: m.mode,
        text: m.text || '',
        time: m.time,
        fromClient: fromClient,
        authorName: authorName,
        attachments: Array.isArray(m.attachments)
          ? m.attachments.map(a => ({ name: a.name || a.file_name || 'file', url: a.url || null, type: a.type || a.mimeType || null }))
          : [],
        audioUrl: m.audioUrl || null,
        audioDuration: m.audioDuration || null,
        transcript: m.transcript || '',
        loom: m.loom ? { url: m.loom.url || null, title: m.loom.title || '', thumbnail: m.loom.thumbnail || '' } : null,
        notes: m.notes || '',
        edited: !!m.edited,
        editedAt: m.editedAt || null,
        deleted: !!m.deleted,
      };
    });
}

// --- ticket id allocation ----------------------------------------------------
// Same atomic Postgres sequence every other ticket-creation path already
// calls (index.html's genTicketId, api/recurring/_engine.js's
// genTicketIdServer) — one shared place tickets ever get their id from,
// never a second counter.
async function nextTicketId() {
  const id = await sbFetch('rpc/next_ticket_id', { method: 'POST', body: '{}' });
  if (typeof id !== 'string' || !id) throw new Error('next_ticket_id() RPC returned no id');
  return id;
}

// --- @mentions ---------------------------------------------------------------
// Admin and Operations must always be mentionable/notifiable from a client
// ticket, regardless of who's assigned — resolves to every team member whose
// role is 'admin' or whose department is 'Operations'. Named team members are
// only mentionable when they're actually associated with the ticket
// (assignee/owner) — a client is never shown, or able to notify, the full
// internal team roster.
function isAdminOrOps(m) {
  return (m.role || '').toLowerCase() === 'admin' || (m.department || '').toLowerCase() === 'operations';
}
// Parses "@Admin" / "@Operations" / "@Name" tokens out of free text and
// resolves them against the given candidate list (ticket-associated members
// ∪ the always-available admin/ops pool). Returns a de-duplicated array of
// {id, name, email}. Never matches on email/id — only display name or the
// two reserved group tokens.
function extractMentions(text, candidates) {
  const found = new Map();
  const tokens = String(text || '').match(/@([A-Za-z][\w.'-]*(?:\s+[A-Za-z][\w.'-]*)?)/g) || [];
  tokens.forEach(tok => {
    const name = tok.slice(1).trim().toLowerCase();
    if (name === 'admin' || name === 'operations' || name === 'ops') {
      candidates.filter(isAdminOrOps).forEach(m => found.set(m.id, m));
      return;
    }
    const hit = candidates.find(m => (m.name || '').toLowerCase() === name || (m.name || '').toLowerCase().startsWith(name));
    if (hit) found.set(hit.id, hit);
  });
  return Array.from(found.values());
}

// --- request helpers --------------------------------------------------------
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  // Fallback: read the stream (some runtimes don't pre-parse)
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function send(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(obj));
}

// Wrap a handler with auth + error guard. handler(req,res,session).
function withClient(handler) {
  return async function (req, res) {
    try {
      if (!SERVICE_KEY || !JWT_SECRET) return send(res, 500, { error: 'Portal not configured (missing env vars)' });
      const session = verifyAuth(req);
      if (!session || !session.cid) return send(res, 401, { error: 'Not authenticated' });
      await handler(req, res, session);
    } catch (e) {
      console.error('[portal]', e && e.message, e && e.body);
      send(res, e.status && e.status < 500 ? e.status : 500, { error: e.message || 'Server error' });
    }
  };
}

module.exports = {
  SB_URL, CLIENT_COMM_MODES,
  signToken, readToken, hashPassword, verifyPassword,
  sbFetch, sbSelect, verifyAuth, verifyStaff,
  sanitizeComms, readBody, send, withClient,
  uploadBase64ToStorage, safeFileName, deleteFromStorage, storagePathFromPublicUrl,
  isAdminOrOps, extractMentions,
  invokeEdgeFunction, hashSetupToken, nextTicketId,
  appendTicketCommunication,
};
