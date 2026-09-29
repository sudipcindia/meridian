// GET    /api/portal/tickets              -> list of the client's tickets (no internal data)
// GET    /api/portal/tickets?id=<id>      -> single ticket + sanitized thread (marks it viewed)
// POST   /api/portal/tickets?id=<id>      -> append a client message: text, attachments,
//                                            voice note, Loom link, notes, @mentions
// PATCH  /api/portal/tickets?id=<id>      -> edit the client's own comment: text and/or
//                                            (for a voice note) transcript/re-recorded audio
// DELETE /api/portal/tickets?id=<id>      -> soft-delete the client's own comment
//
// Merged with the former api/portal/ticket.js (2026-09, Phase 3 final QA):
// the Vercel Hobby plan caps a project at 12 serverless functions, and
// adding api/portal/reports.js as a 13th pushed a real deployment over
// that limit (errorCode: exceeded_serverless_functions_per_deployment).
// These two endpoints were already near-identical in shape/pattern, so
// they were merged into one file (dispatched on the presence of ?id=)
// rather than removing capability or asking to upgrade the plan.
//
// Phase (2026-09-13, Client Portal two-way communication): the same reasoning
// extends the composer here rather than adding a dedicated upload/mentions
// endpoint — still at the 12-function cap, so attachments/voice notes/Loom/
// notes/@mentions are all handled by this one POST body instead of a new file.
//
// Phase (2026-09-14, client comment edit/delete): same file, same reasoning —
// PATCH/DELETE dispatch on req.method just like POST does. Every comm object
// already carries a stable `id`, so edits/deletes address one comm inside the
// ticket's `comms` array; nothing about the array itself is ever removed —
// a delete clears the comm's content in place and marks it `deleted`, so the
// thread's order, timestamps and count never change (see loadOwnedTicket/
// sanitizeComms for how that renders back out).
const L = require('./_lib');

// Single source of truth for status wording: matches STATUS_L in index.html
// exactly (the internal app's own status labels) — the portal must never
// invent a second status system, just relabel the same ticket.status value.
const STATUS_LABELS = {
  new: 'New', inprogress: 'In Progress', review: 'Internal Review',
  approved: 'Approved', delivered: 'Delivered', done: 'Done',
  // Two additions for the 2026-09 Client Portal ticket-request phase — same
  // status column, no second status system. A request sits in
  // 'pending_approval' until an authorised internal user approves it (the
  // ticket then moves to 'new', same as any other ticket) or rejects it
  // ('rejected', terminal — the client keeps the record and its reason).
  // Deliberately NOT added to index.html's STAT_CYCLE: that drives the
  // free-choice status dropdown on every ticket, and these two only ever
  // move via the dedicated Approve/Reject actions so the audit trail
  // (quick_meta.client_request) is always written alongside the status
  // change, never silently out of sync with it.
  pending_approval: 'Waiting for Approval', rejected: 'Not Approved',
};

// Client-facing progress (2026-09 My Tickets feature, section 7): status is
// the ONLY source of truth, mirroring MT_STATUS_PROGRESS in index.html
// exactly. Delivered and Done both read as 100% — Delivered is the
// meaningful milestone to a client (work is in their hands); Done is purely
// an internal housekeeping state after delivery, not a second, more-final
// milestone worth exposing. No separate stored progress value.
const STATUS_PROGRESS = { new: 0, inprogress: 25, review: 50, approved: 75, delivered: 100, done: 100 };
function progressFor(status) { return STATUS_PROGRESS[status] ?? 0; }

// Mirrors TYPE_L in index.html — ticket.type is the service this ticket is
// against (SEO, PPC, etc.); shown to the client as "Service".
const SERVICE_LABELS = {
  monthly: 'Monthly', seo: 'SEO', ppc: 'PPC', web: 'Web Build', fix: 'Fix', other: 'Other',
  sales: 'Sales/Outreach', gtm: 'GTM', social: 'Social Media', email: 'Email Campaign', content: 'Content',
  outreach: 'Outreach', weboptimisation: 'Website Optimisation', uiux: 'UI/UX',
};

// Client-facing recurring options are ONLY Daily/Weekly/Monthly (2026-09
// Client Portal recurring-visibility requirement). Legacy/internal workflow
// cadences (every_10_days, every_14_days, every_2_weeks — still used by
// existing GTM/SEO workflows) are a real, historical part of the frequency
// vocabulary and are NEVER renamed or reinterpreted as one of the three —
// a ticket on one of those cadences still reports isRecurring:true, just
// with no specific "Recurring: X" label (generic "Recurring task" instead),
// so nothing client-facing ever claims a cadence that isn't true.
const CLIENT_FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

async function loadOwnedTicket(cid, ticketId) {
  const rows = await L.sbSelect('tickets',
    'select=id,title,description,status,priority,due,overdue,blocked,type,client,assignees,owner,comms,created_at,updated_at,client_last_viewed_at,source,plan_id,quick_meta' +
    '&id=eq.' + encodeURIComponent(ticketId) + '&limit=1');
  const t = rows && rows[0];
  // Ownership check: the ticket must belong to THIS client. Prevents id guessing.
  if (!t || t.client !== cid) return null;
  return t;
}

// Recurring is identified from existing ticket metadata — never a second,
// duplicated tracking system:
//  - quick_meta.recurring_frequency is set at creation for a Quick Task
//    against a recurring project (index.html qtCreateTickets) — Quick Task's
//    own frequency picker already only offers weekly/monthly.
//  - source === 'recurring_workflow' is set by the scheduled workflow engine
//    (api/recurring/_engine.js createTicketForWorkflow / index.html's
//    client-side mirror _createTicketForWorkflow). As of the 2026-09
//    recurring-visibility phase, that ticket's own quick_meta now also
//    carries workflow_id + frequency (added at creation, alongside the
//    existing project field) — a direct, reliable link to the workflow that
//    generated it, rather than guessing.
//  - Tickets created by the engine BEFORE that change have no
//    quick_meta.workflow_id, so as a backward-compatible fallback the
//    originating workflow is recovered (best-effort, read-only) by matching
//    title — never blocks the ticket from still correctly reporting
//    isRecurring:true if the match fails.
// workflow_id itself is never returned to the client — internal identifier,
// used server-side only to look up the workflow's frequency/next_run.
async function recurringInfo(t) {
  const qm = t.quick_meta || {};
  const project = qm.project && qm.project.label ? qm.project.label : null;

  // Quick Task recurring projects: frequency already lives directly on the
  // ticket, no plan/workflow lookup needed or possible (no plan_id).
  if (qm.recurring_frequency) {
    const freq = qm.recurring_frequency;
    return {
      isRecurring: true,
      recurringLabel: CLIENT_FREQ_LABELS[freq] || null,
      nextDue: null,
      project,
    };
  }
  if (t.source !== 'recurring_workflow') {
    return { isRecurring: false, recurringLabel: null, nextDue: null, project };
  }

  // Fast, reliable path: frequency stamped directly on the ticket at
  // creation time — no plan lookup needed for the common case.
  if (qm.frequency) {
    const label = CLIENT_FREQ_LABELS[qm.frequency] || null;
    // next_run still requires the live workflow (it advances over time;
    // the ticket's own quick_meta is a point-in-time snapshot from
    // creation) — only worth the lookup when there's a client-facing
    // label to pair it with.
    if (!label || !t.plan_id) return { isRecurring: true, recurringLabel: label, nextDue: null, project };
    try {
      const rows = await L.sbSelect('performance_plans', 'select=plan&id=eq.' + encodeURIComponent(t.plan_id) + '&limit=1');
      const workflows = (rows && rows[0] && rows[0].plan && rows[0].plan.workflows) || [];
      const wf = qm.workflow_id ? workflows.find(w => w.id === qm.workflow_id) : null;
      return { isRecurring: true, recurringLabel: label, nextDue: (wf && wf.next_run) || null, project };
    } catch (e) {
      return { isRecurring: true, recurringLabel: label, nextDue: null, project };
    }
  }

  // Legacy fallback: ticket predates workflow_id/frequency being stamped
  // onto quick_meta — recover both (best-effort) by matching the workflow
  // whose title this ticket's own title was built from.
  if (!t.plan_id) return { isRecurring: true, recurringLabel: null, nextDue: null, project };
  try {
    const rows = await L.sbSelect('performance_plans', 'select=plan&id=eq.' + encodeURIComponent(t.plan_id) + '&limit=1');
    const workflows = (rows && rows[0] && rows[0].plan && rows[0].plan.workflows) || [];
    const wf = workflows.find(w => {
      const wfTitle = w.template_key === 'gtm_performance_review'
        ? 'Review campaign performance — check lead volume'
        : (w.task_title || w.name);
      return wfTitle && t.title && t.title.endsWith(wfTitle);
    });
    const label = wf && wf.frequency ? (CLIENT_FREQ_LABELS[wf.frequency] || null) : null;
    return { isRecurring: true, recurringLabel: label, nextDue: label ? ((wf && wf.next_run) || null) : null, project };
  } catch (e) {
    return { isRecurring: true, recurringLabel: null, nextDue: null, project };
  }
}

// Best-effort Loom oEmbed lookup — done server-side (no browser CORS
// restriction here) so the client always gets a real title/thumbnail card,
// not just a raw link. Never blocks the comment on failure.
async function fetchLoomMeta(url) {
  try {
    const r = await fetch('https://www.loom.com/v1/oembed?url=' + encodeURIComponent(url));
    if (!r.ok) return null;
    const d = await r.json();
    return { url, title: d.title || 'Loom video', thumbnail: d.thumbnail_url || '' };
  } catch (e) { return null; }
}

function isLoomUrl(url) { return /loom\.com\/(share|embed)\//i.test(String(url || '')); }

// Every notification this endpoint sends goes through here — de-duplicated
// by email in one batch insert, so a person who is e.g. both the assignee
// and Operations only gets one row, and the same event never fires the
// insert twice.
async function notifyStaff(emailsMap, ticketId, title, body, commId) {
  const rows = Object.keys(emailsMap).map(email => ({
    user_email: email,
    title,
    body,
    type: 'client-in',
    ticket_id: ticketId,
    comm_id: commId || null,
    read: false,
    created_at: new Date().toISOString(),
  }));
  if (rows.length) await L.sbFetch('notifications', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
}

// A brand-new client ticket request — distinct type from notifyStaff's
// 'client-in' (an update on an EXISTING ticket) so notify-email can render
// it as its own clear "Client Request — Awaiting Approval" email rather
// than a generic comment notification. Same dedup-by-email batch insert
// pattern as notifyStaff above.
async function notifyClientRequest(emailsMap, ticketId, ticketTitle, title, body) {
  const rows = Object.keys(emailsMap).map(email => ({
    user_email: email,
    title,
    body,
    type: 'client_request',
    ticket_id: ticketId,
    ticket_title: ticketTitle,
    read: false,
    created_at: new Date().toISOString(),
  }));
  if (rows.length) await L.sbFetch('notifications', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
}

// Resolves who should hear about a new client request for one client+service:
// Admin/Operations (always — Jayson/Shamila's existing role/department,
// same isAdminOrOps tier already used for portal @mentions) plus whichever
// active team members are already working this client's tickets of that
// same service (derived from real assignee/owner history — the existing
// client/team assignment data — never a new, separately-maintained roster).
async function resolveRequestRecipients(cid, service) {
  const [team, relatedTickets] = await Promise.all([
    L.sbSelect('team_members', 'select=id,name,email,role,department,status'),
    L.sbSelect('tickets', 'select=assignees,owner&client=eq.' + encodeURIComponent(cid) +
      '&type=eq.' + encodeURIComponent(service) + '&is_deleted=not.is.true'),
  ]);
  const activeTeam = (team || []).filter(m => m.status !== 'offboarded');
  const teamById = {};
  activeTeam.forEach(m => { teamById[m.id] = m; });

  const relatedIds = new Set();
  (relatedTickets || []).forEach(t => { [...(t.assignees || []), t.owner].filter(Boolean).forEach(id => relatedIds.add(id)); });

  const recipients = activeTeam.filter(m => L.isAdminOrOps(m) || relatedIds.has(m.id));
  const emails = {};
  recipients.forEach(m => { if (m.email) emails[m.email] = true; });
  return emails;
}

module.exports = L.withClient(async function (req, res, session) {
  const cid = session.cid;
  const ticketId = String((req.query && req.query.id) || '');

  // -------- No id, POST: client creates a new ticket request --------
  // Enters the SAME tickets table every other ticket already lives in —
  // never a second ticket system. Starts life as status:'pending_approval'
  // (not an active ticket yet) and only ever becomes a normal ticket via the
  // internal Approve action (index.html), which is what actually sets
  // status:'new' + assignees/priority/due. source:'client_portal' plus the
  // requester's name/email/timestamp in quick_meta.client_request is the
  // structured, filterable "this came from the Client Portal" marker the
  // internal team needs — never just a display string.
  if (!ticketId && req.method === 'POST') {
    if (session.role === 'preview') return L.send(res, 403, { error: 'Preview mode is read-only' });
    const body = await L.readBody(req);
    const title = String(body.title || '').trim().slice(0, 200);
    const description = String(body.description || '').trim().slice(0, 5000);
    const service = String(body.service || '').trim();
    const projectIn = body.project && typeof body.project === 'object' ? body.project : null;
    const project = projectIn && projectIn.id && projectIn.label
      ? { id: String(projectIn.id).slice(0, 100), label: String(projectIn.label).slice(0, 150) }
      : null;
    const requestedDue = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due || '')) ? body.due : null;
    const attachmentsIn = Array.isArray(body.attachments) ? body.attachments.slice(0, 5) : [];

    if (!title) return L.send(res, 400, { error: 'Ticket title is required' });
    if (!description) return L.send(res, 400, { error: 'Description is required' });
    if (!SERVICE_LABELS[service]) return L.send(res, 400, { error: 'Please select a valid service' });

    const clientRows = await L.sbSelect('clients', 'select=id,name,contact_name,contact_email,contact_phone,status&id=eq.' + encodeURIComponent(cid) + '&limit=1');
    const client = clientRows && clientRows[0];
    if (!client) return L.send(res, 404, { error: 'Client not found' });
    if (client.status === 'offboarded') return L.send(res, 403, { error: 'This account can no longer submit new requests' });

    let tid;
    try { tid = await L.nextTicketId(); } catch (e) { return L.send(res, 500, { error: 'Could not allocate a ticket number' }); }

    let attachments = [];
    try {
      attachments = await Promise.all(attachmentsIn.map(async (f, i) => {
        const path = 'tickets/' + tid + '/request_' + Date.now() + '_' + i + '_' + L.safeFileName(f.name);
        const url = await L.uploadBase64ToStorage('ticket-attachments', path, f.dataBase64, f.mimeType);
        return { name: f.name || 'file', url, type: f.mimeType || null };
      }));
    } catch (e) {
      return L.send(res, 400, { error: 'Attachment upload failed: ' + (e.message || 'unknown error') });
    }

    const now = new Date().toISOString();
    const payload = {
      id: tid,
      title,
      client: cid,
      type: service,
      status: 'pending_approval',
      priority: 'normal',
      sprint: false,
      due: '',
      overdue: false, blocked: false, blocked_reason: '',
      assignees: [], owner: '',
      description,
      contact: { name: client.contact_name || '', email: client.contact_email || '', phone: client.contact_phone || '' },
      attachments,
      tasks: [], comms: [],
      quick_meta: {
        project,
        client_request: {
          requested_by_name: client.name,
          requested_by_email: session.email,
          requested_at: now,
          requested_due: requestedDue,
        },
      },
      source: 'client_portal',
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };
    await L.sbFetch('tickets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(payload) });

    // Best-effort — a notification failure must never fail the request itself.
    try {
      const emails = await resolveRequestRecipients(cid, service);
      await notifyClientRequest(
        emails, tid, title,
        '📋 New client request — awaiting approval',
        client.name + ' requested "' + title + '" (' + SERVICE_LABELS[service] + ')'
      );
    } catch (e) { console.error('[portal/tickets] request notify failed', e && e.message); }

    return L.send(res, 200, { ok: true, ticket: { id: tid, status: 'pending_approval', statusLabel: STATUS_LABELS.pending_approval } });
  }

  // -------- No id, GET: list --------
  if (!ticketId) {
    const enc = encodeURIComponent(cid);
    const rows = await L.sbSelect('tickets',
      'select=id,title,status,priority,due,overdue,blocked,type,comms,created_at,updated_at,client_last_viewed_at,source,quick_meta' +
      '&client=eq.' + enc + '&is_deleted=not.is.true&order=updated_at.desc');

    const tickets = (rows || []).map(t => {
      const visible = L.sanitizeComms(t.comms);
      const last = visible[visible.length - 1];
      // Unread = a staff message exists after the client last opened this
      // ticket. The client's own messages never mark it unread for them —
      // loadOwnedTicket/POST below always stamp client_last_viewed_at at the
      // moment of their own action.
      const lastStaffTime = visible.filter(m => !m.fromClient).map(m => m.time).sort().pop() || null;
      const unread = !!lastStaffTime && (!t.client_last_viewed_at || new Date(lastStaffTime) > new Date(t.client_last_viewed_at));
      // Cheap boolean only here (no plan/workflow lookup) — the frequency
      // label is only computed on the single-ticket detail view below.
      const isRecurring = !!((t.quick_meta && t.quick_meta.recurring_frequency) || t.source === 'recurring_workflow');
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        statusLabel: STATUS_LABELS[t.status] || t.status,
        progress: progressFor(t.status),
        priority: t.priority,
        type: t.type,
        serviceLabel: SERVICE_LABELS[t.type] || t.type,
        due: t.due,
        overdue: !!t.overdue,
        blocked: !!t.blocked,
        isRecurring,
        messageCount: visible.length,
        lastMessageAt: last ? last.time : null,
        lastMessagePreview: last ? (last.deleted ? 'Message deleted' : String(last.text || last.transcript || (last.attachments && last.attachments.length ? '📎 Attachment' : (last.audioUrl ? '🎤 Voice note' : ''))).slice(0, 120)) : null,
        unread,
        updated_at: t.updated_at,
        created_at: t.created_at,
      };
    });

    return L.send(res, 200, { tickets });
  }

  // -------- id present: POST appends a client message --------
  if (req.method === 'POST') {
    if (session.role === 'preview') return L.send(res, 403, { error: 'Preview mode is read-only' });
    const body = await L.readBody(req);
    const text = String(body.text || '').trim();
    const notes = String(body.notes || '').trim();
    const attachmentsIn = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
    const audioIn = body.audio && typeof body.audio === 'object' ? body.audio : null;
    const transcript = String(body.transcript || '').trim();
    const loomUrl = String((body.loom && body.loom.url) || '').trim();
    const explicitMentions = Array.isArray(body.mentions) ? body.mentions : [];

    const hasContent = text || notes || attachmentsIn.length || audioIn || loomUrl;
    if (!hasContent) return L.send(res, 400, { error: 'Message is empty' });
    if (text.length > 5000) return L.send(res, 400, { error: 'Message too long' });
    if (loomUrl && !isLoomUrl(loomUrl)) return L.send(res, 400, { error: 'That doesn\'t look like a Loom link' });

    const t = await loadOwnedTicket(cid, ticketId);
    if (!t) return L.send(res, 404, { error: 'Ticket not found' });

    // Team lookup — used for both @mention resolution and (elsewhere)
    // author-name display. Admin/Operations are always in the candidate
    // pool; named mentions are restricted to people actually on this ticket.
    const team = await L.sbSelect('team_members', 'select=id,name,email,role,department');
    const teamById = {};
    (team || []).forEach(m => { teamById[m.id] = m; });
    const ticketPeopleIds = new Set([...(t.assignees || []), t.owner].filter(Boolean));
    const candidates = (team || []).filter(m => ticketPeopleIds.has(m.id) || L.isAdminOrOps(m));

    // Uploads — real storage objects, never persisted as base64 (the base64
    // only exists transiently in this request on its way to the bucket).
    let attachments = [];
    try {
      attachments = await Promise.all(attachmentsIn.map(async (f, i) => {
        const path = 'tickets/' + ticketId + '/portal_' + Date.now() + '_' + i + '_' + L.safeFileName(f.name);
        const url = await L.uploadBase64ToStorage('ticket-attachments', path, f.dataBase64, f.mimeType);
        return { name: f.name || 'file', url, type: f.mimeType || null };
      }));
    } catch (e) {
      return L.send(res, 400, { error: 'Attachment upload failed: ' + (e.message || 'unknown error') });
    }

    let audioUrl = null, audioDuration = null;
    if (audioIn && audioIn.dataBase64) {
      try {
        const path = 'tickets/' + ticketId + '/portal_voice_' + Date.now() + '.webm';
        audioUrl = await L.uploadBase64ToStorage('ticket-attachments', path, audioIn.dataBase64, audioIn.mimeType || 'audio/webm');
        audioDuration = audioIn.duration || null;
      } catch (e) {
        return L.send(res, 400, { error: 'Voice note upload failed: ' + (e.message || 'unknown error') });
      }
    }

    let loom = null;
    if (loomUrl) loom = (await fetchLoomMeta(loomUrl)) || { url: loomUrl, title: 'Loom video', thumbnail: '' };

    const legacyCommId = 'c' + Date.now();
    // Durable, race-free append (see appendTicketCommunication in _lib.js) —
    // replaces the old "SELECT comms, splice in JS, PATCH whole row"
    // pattern, which a concurrent internal desk send or a second client
    // portal reply could race against and silently lose messages to.
    const commId = await L.appendTicketCommunication({
      ticketId, clientId: cid, senderType: 'client', senderId: 'client',
      direction: 'client_to_staff', visibility: 'client_visible',
      messageType: audioUrl ? 'voice_note' : (!text && attachments.length) ? 'attachment' : 'text',
      body: text, attachments,
      idempotencyKey: 'portal_' + ticketId + '_' + legacyCommId,
      legacyCommId, createdBy: 'client_portal:' + cid,
      metadata: Object.assign({},
        notes ? { notes } : {}, audioUrl ? { audioUrl } : {},
        audioDuration ? { audioDuration } : {}, transcript ? { transcript } : {},
        loom ? { loom } : {}),
    });

    // The client has, by definition, just seen their own message — stamp
    // client_last_viewed_at (comms itself is no longer written here at all;
    // the trigger above already updated it atomically).
    const now = new Date().toISOString();
    await L.sbFetch('tickets?id=eq.' + encodeURIComponent(ticketId), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ client_last_viewed_at: now }),
    });

    // Notify (best-effort; never fail the message on this) — assignees +
    // owner always, Admin/Operations always, plus anyone explicitly
    // @mentioned in the text or picked in the composer. One deduplicated
    // batch insert by email.
    try {
      const mentionedByText = L.extractMentions(text, candidates);
      const mentionedExplicit = explicitMentions.map(id => {
        if (id === 'admin' || id === 'operations') return null; // handled by extractMentions('@Admin'...) if typed; explicit group picks resolve via isAdminOrOps below
        return teamById[id];
      }).filter(Boolean);
      const wantsAdminGroup = explicitMentions.includes('admin') || explicitMentions.includes('operations');

      const notifyIds = new Set([...(t.assignees || []), t.owner].filter(Boolean));
      (team || []).filter(L.isAdminOrOps).forEach(m => notifyIds.add(m.id));
      mentionedByText.forEach(m => notifyIds.add(m.id));
      mentionedExplicit.forEach(m => notifyIds.add(m.id));
      if (wantsAdminGroup) (team || []).filter(L.isAdminOrOps).forEach(m => notifyIds.add(m.id));

      const emails = {};
      notifyIds.forEach(id => { const m = teamById[id]; if (m && m.email) emails[m.email] = true; });

      const kind = audioUrl ? 'a voice note' : loom ? 'a Loom video' : attachments.length ? 'an attachment' : 'a message';
      const preview = text ? '"' + text.slice(0, 80) + '"' : 'Sent ' + kind;
      await notifyStaff(emails, ticketId, 'New client update', preview + ' — re: ' + (t.title || 'ticket'), commId);
    } catch (e) { console.error('[portal/tickets] notify failed', e && e.message); }

    return L.send(res, 200, { ok: true });
  }

  // -------- id present: PATCH edits the client's own comment --------
  // Requirement: clients can edit their own sent text, and — for a comment
  // that carries a voice note — its transcript and/or the audio itself
  // (a re-record/replace). Never touches a staff comment (mode !== 'client-in')
  // and never turns a text-only comment into a voice note or vice versa.
  if (req.method === 'PATCH') {
    if (session.role === 'preview') return L.send(res, 403, { error: 'Preview mode is read-only' });
    const body = await L.readBody(req);
    const commentId = String(body.commentId || '').trim();
    if (!commentId) return L.send(res, 400, { error: 'commentId is required' });

    const t = await loadOwnedTicket(cid, ticketId);
    if (!t) return L.send(res, 404, { error: 'Ticket not found' });

    // Read-only lookup to validate ownership/state before the atomic patch
    // below — the actual write re-reads comms fresh inside one UPDATE
    // statement (edit_ticket_comm), so this copy is only used for the
    // pre-checks, never written back as a whole array.
    const comms = Array.isArray(t.comms) ? t.comms : [];
    const idx = comms.findIndex(c => c && c.id === commentId);
    if (idx === -1) return L.send(res, 404, { error: 'Message not found' });
    const comm = comms[idx];
    // Ownership: only the client's own comments are editable — never a
    // staff comment, regardless of its comm mode.
    if (comm.mode !== 'client-in') return L.send(res, 403, { error: 'You can only edit your own messages' });
    if (comm.deleted) return L.send(res, 400, { error: 'This message has already been deleted' });

    const hasText = typeof body.text === 'string';
    const hasTranscript = typeof body.transcript === 'string';
    const hasAudio = !!(body.audio && typeof body.audio === 'object' && body.audio.dataBase64);
    if (!hasText && !hasTranscript && !hasAudio) return L.send(res, 400, { error: 'Nothing to update' });

    // Only the changed fields go into `patch` — edit_ticket_comm merges this
    // atomically into the CURRENT row's matching array element server-side
    // (re-reading comms fresh inside its one UPDATE statement), so there is
    // no separate SELECT-then-PATCH gap for a concurrent write to land in.
    const patch = { edited: true, editedAt: new Date().toISOString() };

    if (hasText) {
      const text = body.text.trim();
      if (text.length > 5000) return L.send(res, 400, { error: 'Message too long' });
      if (!text && !(comm.attachments && comm.attachments.length) && !comm.loom && !comm.audioUrl && !comm.notes) {
        return L.send(res, 400, { error: 'Message cannot be empty' });
      }
      patch.text = text;
    }
    if (hasTranscript && !hasAudio) {
      if (!comm.audioUrl) return L.send(res, 400, { error: 'This message has no voice note to edit' });
      patch.transcript = body.transcript.trim().slice(0, 5000);
    }
    if (hasAudio) {
      if (!comm.audioUrl) return L.send(res, 400, { error: 'This message has no voice note to replace' });
      try {
        const oldPath = L.storagePathFromPublicUrl('ticket-attachments', comm.audioUrl);
        const path = 'tickets/' + ticketId + '/portal_voice_' + Date.now() + '.webm';
        const url = await L.uploadBase64ToStorage('ticket-attachments', path, body.audio.dataBase64, body.audio.mimeType || 'audio/webm');
        patch.audioUrl = url;
        patch.audioDuration = body.audio.duration || null;
        // A re-recorded voice note replaces its transcript unless a fresh
        // one came with it — an old transcript describing audio that no
        // longer exists would be actively misleading, not "synchronised".
        patch.transcript = hasTranscript ? body.transcript.trim().slice(0, 5000) : '';
        if (oldPath) L.deleteFromStorage('ticket-attachments', oldPath).catch(() => {});
      } catch (e) {
        return L.send(res, 400, { error: 'Voice note upload failed: ' + (e.message || 'unknown error') });
      }
    }

    const now = new Date().toISOString();
    await L.sbFetch('rpc/edit_ticket_comm', {
      method: 'POST',
      body: JSON.stringify({ p_ticket_id: ticketId, p_comm_id: commentId, p_patch: patch }),
    });
    await L.sbFetch('tickets?id=eq.' + encodeURIComponent(ticketId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ client_last_viewed_at: now }),
    });
    return L.send(res, 200, { ok: true });
  }

  // -------- id present: DELETE soft-deletes the client's own comment --------
  // The comm entry stays in place (id/author/mode/time preserved) so the
  // thread's order and history are never disturbed — only its content is
  // cleared and it's flagged `deleted` so the client (and staff) see a
  // "Message deleted" placeholder instead of a gap or a silently vanished
  // message.
  if (req.method === 'DELETE') {
    if (session.role === 'preview') return L.send(res, 403, { error: 'Preview mode is read-only' });
    const body = await L.readBody(req);
    const commentId = String((req.query && req.query.commentId) || body.commentId || '').trim();
    if (!commentId) return L.send(res, 400, { error: 'commentId is required' });

    const t = await loadOwnedTicket(cid, ticketId);
    if (!t) return L.send(res, 404, { error: 'Ticket not found' });

    // Read-only pre-check; the actual clear happens atomically below.
    const comms = Array.isArray(t.comms) ? t.comms : [];
    const idx = comms.findIndex(c => c && c.id === commentId);
    if (idx === -1) return L.send(res, 404, { error: 'Message not found' });
    const comm = comms[idx];
    if (comm.mode !== 'client-in') return L.send(res, 403, { error: 'You can only delete your own messages' });
    if (comm.deleted) return L.send(res, 400, { error: 'This message has already been deleted' });

    // Best-effort cleanup of the underlying storage objects — never blocks
    // the delete itself.
    try {
      if (comm.audioUrl) {
        const p = L.storagePathFromPublicUrl('ticket-attachments', comm.audioUrl);
        if (p) L.deleteFromStorage('ticket-attachments', p).catch(() => {});
      }
      (comm.attachments || []).forEach(a => {
        const p = a && a.url && L.storagePathFromPublicUrl('ticket-attachments', a.url);
        if (p) L.deleteFromStorage('ticket-attachments', p).catch(() => {});
      });
    } catch (e) { /* best-effort */ }

    // Merged atomically into the CURRENT array element (edit_ticket_comm) —
    // every content field is explicitly cleared (not just left absent) so a
    // deleted message's content can never be re-exposed via a raw API
    // response even if a UI path forgets to check the `deleted` flag first.
    const now = new Date().toISOString();
    await L.sbFetch('rpc/edit_ticket_comm', {
      method: 'POST',
      body: JSON.stringify({
        p_ticket_id: ticketId, p_comm_id: commentId,
        p_patch: {
          deleted: true, deletedAt: now,
          text: '', notes: '', attachments: [], transcript: '',
          audioUrl: null, audioDuration: null, loom: null, subject: null,
        },
      }),
    });
    await L.sbFetch('tickets?id=eq.' + encodeURIComponent(ticketId), {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ client_last_viewed_at: now }),
    });
    return L.send(res, 200, { ok: true });
  }

  // -------- id present: GET ticket detail --------
  const t = await loadOwnedTicket(cid, ticketId);
  if (!t) return L.send(res, 404, { error: 'Ticket not found' });

  const team = await L.sbSelect('team_members', 'select=id,name,role,department,profile_photo_url');
  const teamById = {};
  (team || []).forEach(m => { teamById[m.id] = m; });

  const assignedTo = Array.from(new Set([...(t.assignees || []), t.owner].filter(Boolean)))
    .map(id => teamById[id]).filter(Boolean)
    .map(m => ({ id: m.id, name: m.name, photo: m.profile_photo_url || null }));

  // Mentionable pool shown in the composer's @-list: ticket-associated
  // people + the always-available Admin/Operations group — never the full
  // internal roster, and never email/id, only name.
  const mentionable = (team || [])
    .filter(m => assignedTo.some(a => a.id === m.id) || L.isAdminOrOps(m))
    .map(m => ({ id: m.id, name: m.name, group: L.isAdminOrOps(m) && !assignedTo.some(a => a.id === m.id) ? 'Admin/Operations' : 'On this ticket' }));

  // "Action required" (Phase 5, 2026-09): whether there's a staff update the
  // client hasn't seen YET, as of the moment this page started loading — the
  // exact same signal the Tickets list's own `unread` dot already uses
  // (last staff message time vs. the client's PREVIOUS client_last_viewed_at,
  // read here before it gets overwritten by the "mark viewed" write below).
  // Never a new/invented workflow flag.
  const thread = L.sanitizeComms(t.comms, teamById);
  const lastStaffTime = thread.filter(m => !m.fromClient).map(m => m.time).sort().pop() || null;
  const unread = !!lastStaffTime && (!t.client_last_viewed_at || new Date(lastStaffTime) > new Date(t.client_last_viewed_at));

  // Mark viewed — a GET from the client means they've seen everything up to now.
  L.sbFetch('tickets?id=eq.' + encodeURIComponent(ticketId), {
    method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ client_last_viewed_at: new Date().toISOString() }),
  }).catch(() => {});

  const recurring = await recurringInfo(t);

  // Client-facing view of quick_meta.client_request (Phase 3 ticket-request
  // flow) — the structured audit trail lives entirely in that one object;
  // this just resolves approved_by/rejected_by (internal team-member ids)
  // to a display name and drops everything else internal-only (no ids,
  // no emails of staff, nothing else).
  const cr = t.quick_meta && t.quick_meta.client_request;
  const clientRequest = cr ? {
    requestedAt: cr.requested_at || null,
    requestedDue: cr.requested_due || null,
    approvedByName: cr.approved_by ? ((teamById[cr.approved_by] || {}).name || null) : null,
    approvedAt: cr.approved_at || null,
    rejectedAt: cr.rejected_at || null,
    rejectionReason: cr.rejection_reason || null,
  } : null;

  return L.send(res, 200, {
    ticket: {
      id: t.id,
      title: t.title,
      description: t.description || '',
      status: t.status,
      statusLabel: STATUS_LABELS[t.status] || t.status,
      progress: progressFor(t.status),
      priority: t.priority,
      type: t.type,
      serviceLabel: SERVICE_LABELS[t.type] || t.type,
      project: recurring.project,
      isRecurring: recurring.isRecurring,
      recurringLabel: recurring.recurringLabel,
      nextDue: recurring.nextDue,
      due: t.due,
      overdue: !!t.overdue,
      blocked: !!t.blocked,
      created_at: t.created_at,
      updated_at: t.updated_at,
      assignedTo,
      mentionable,
      clientRequest,
      unread,
      thread,
    },
  });
});
