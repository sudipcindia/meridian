// GET  /api/portal/meetings              -> list the client's meetings
// POST /api/portal/meetings { title, preferred_at, note }  -> client requests a call
const L = require('./_lib');

module.exports = L.withClient(async function (req, res, session) {
  const enc = encodeURIComponent(session.cid);

  if (req.method === 'POST') {
    if (session.role === 'preview') return L.send(res, 403, { error: 'Preview mode is read-only' });
    const body = await L.readBody(req);
    const title = String(body.title || '').trim() || 'Call request';
    const note = String(body.note || '').trim();
    const scheduledAt = body.preferred_at ? new Date(body.preferred_at).toISOString() : null;

    const row = {
      client_id: session.cid,
      title,
      description: note,
      scheduled_at: scheduledAt,
      status: 'upcoming',
      requested_by: 'client',
      created_by: session.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const created = await L.sbFetch('meetings', {
      method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row),
    });

    // Notify Admin/Operations — a meeting request needs someone to confirm
    // it, so unlike ticket comments (assignee-scoped) this always goes to
    // the whole admin/ops pool, not just whoever's assigned to this client's
    // tickets.
    try {
      const clientRows = await L.sbSelect('clients', 'select=name&id=eq.' + encodeURIComponent(session.cid) + '&limit=1');
      const clientName = (clientRows && clientRows[0] && clientRows[0].name) || 'A client';
      const team = await L.sbSelect('team_members', 'select=email,role,department');
      const emails = Array.from(new Set((team || []).filter(L.isAdminOrOps).map(m => m.email).filter(Boolean)));
      if (emails.length) {
        const rows = emails.map(email => ({
          user_email: email,
          title: 'New meeting request',
          body: clientName + ' requested "' + title + '"' + (scheduledAt ? ' for ' + new Date(scheduledAt).toLocaleString('en-GB') : ''),
          type: 'client-in',
          ticket_id: null,
          read: false,
          created_at: new Date().toISOString(),
        }));
        await L.sbFetch('notifications', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
      }
    } catch (e) { console.error('[portal/meetings] notify failed', e && e.message); }

    return L.send(res, 200, { ok: true, meeting: (created && created[0]) || null });
  }

  const rows = await L.sbSelect('meetings',
    'select=id,title,description,scheduled_at,duration_min,meeting_url,status,notes,recording_url,requested_by&client_id=eq.' + enc + '&order=scheduled_at.desc.nullslast');

  const now = Date.now();
  const meetings = (rows || []).map(m => ({
    ...m,
    when: m.scheduled_at,
    isPast: m.status === 'completed' || (m.scheduled_at && new Date(m.scheduled_at).getTime() < now),
  }));
  return L.send(res, 200, { meetings });
});
