// GET  /api/portal/notifications            -> client's notifications
// POST /api/portal/notifications { ids:[] }  -> mark read (omit ids => mark all read)
const L = require('./_lib');

module.exports = L.withClient(async function (req, res, session) {
  const email = encodeURIComponent(session.email);

  if (req.method === 'POST') {
    if (session.role === 'preview') return L.send(res, 200, { ok: true }); // no-op in preview
    const body = await L.readBody(req);
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : null;
    let path = 'notifications?user_email=ilike.' + email;
    if (ids && ids.length) path += '&id=in.(' + ids.map(encodeURIComponent).join(',') + ')';
    else path += '&read=eq.false';
    await L.sbFetch(path, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ read: true }) });
    return L.send(res, 200, { ok: true });
  }

  const rows = await L.sbSelect('notifications',
    'select=id,title,body,type,ticket_id,read,created_at&user_email=ilike.' + email +
    '&order=created_at.desc&limit=50');
  const notifications = rows || [];
  const unread = notifications.filter(n => !n.read).length;
  return L.send(res, 200, { notifications, unread });
});
