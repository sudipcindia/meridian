// GET /api/portal/me  -> client profile + health score + KPIs + service-specific breakdown
//
// Phase (2026-09-13, service-specific dashboard): rebuilt to be driven by the
// Master Client Directory's own `clients.services` tags (the same source of
// truth the internal app uses — see CLIENT_SERVICES in index.html) instead
// of the deprecated Client Plans/performance_plans "projects" concept. Each
// service's stats come from this client's own tickets filtered by
// ticket.type === serviceId, so a client with SEO+GTM+Website sees exactly
// those three sections, each scoped to its own tickets — never another
// service's or another client's data mixed in.
//
// Promises are never computed or returned here (2026-09-13: Client Portal
// must not expose internal team commitments in any form) — the health score
// is derived from ticket signals only.
const L = require('./_lib');

const OPEN_STATUSES = new Set(['new', 'inprogress', 'review', 'approved']); // not done/delivered
const DONE_STATUSES = new Set(['done', 'delivered']);

// Mirrors STATUS_L in index.html / STATUS_LABELS in api/portal/tickets.js —
// one status vocabulary, relabelled in three places by hand (same existing
// convention as the rest of this codebase).
const STATUS_LABELS = {
  new: 'New', inprogress: 'In Progress', review: 'Internal Review',
  approved: 'Approved', delivered: 'Delivered', done: 'Done',
};

// Client-facing recurring options are ONLY Daily/Weekly/Monthly (2026-09
// Client Portal recurring-visibility phase) — mirrors
// CLIENT_FREQ_LABELS in api/portal/tickets.js exactly.
const CLIENT_FREQ_LABELS = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

// Resolves a client-facing recurring label for the Active Tickets dashboard
// widget — same source of truth as api/portal/tickets.js's recurringInfo(),
// just without the next_run lookup (not shown on this card) and batched
// across all of this client's tickets in at most one extra query instead of
// one per ticket:
//  - quick_meta.recurring_frequency (Quick Task) or quick_meta.frequency
//    (workflow-engine tickets, stamped at creation as of Phase 1) resolve
//    with no DB lookup at all.
//  - Only a ticket from the engine that predates that stamp (no frequency
//    in quick_meta) needs its originating workflow recovered by title match
//    — those tickets' plan_ids are fetched once, batched, not per ticket.
async function resolveRecurringLabels(tickets) {
  const labels = {}; // ticket.id -> label string | null
  const legacy = []; // tickets needing a best-effort plan/workflow lookup

  for (const t of tickets) {
    const qm = t.quick_meta || {};
    if (qm.recurring_frequency) { labels[t.id] = CLIENT_FREQ_LABELS[qm.recurring_frequency] || null; continue; }
    if (t.source !== 'recurring_workflow') { labels[t.id] = null; continue; }
    if (qm.frequency) { labels[t.id] = CLIENT_FREQ_LABELS[qm.frequency] || null; continue; }
    legacy.push(t);
  }

  if (legacy.length) {
    const planIds = Array.from(new Set(legacy.map(t => t.plan_id).filter(Boolean)));
    if (planIds.length) {
      try {
        const rows = await L.sbSelect('performance_plans',
          'select=id,plan&id=in.(' + planIds.map(encodeURIComponent).join(',') + ')');
        const workflowsByPlan = {};
        (rows || []).forEach(r => { workflowsByPlan[r.id] = (r.plan && r.plan.workflows) || []; });
        legacy.forEach(t => {
          const workflows = workflowsByPlan[t.plan_id] || [];
          const wf = workflows.find(w => {
            const wfTitle = w.template_key === 'gtm_performance_review'
              ? 'Review campaign performance — check lead volume'
              : (w.task_title || w.name);
            return wfTitle && t.title && t.title.endsWith(wfTitle);
          });
          labels[t.id] = wf && wf.frequency ? (CLIENT_FREQ_LABELS[wf.frequency] || null) : null;
        });
      } catch (e) {
        legacy.forEach(t => { labels[t.id] = null; });
      }
    } else {
      legacy.forEach(t => { labels[t.id] = null; });
    }
  }

  return labels;
}

// Mirrors QT_SERVICES/CLIENT_SERVICES in index.html — the one, existing
// service vocabulary. 'sales'/'gtm' are intentionally excluded from the
// per-service *ticket* breakdown below (few/no tickets are typed that way —
// that work shows up as leads/campaigns via /api/portal/reports?section=gtm
// instead) but are still valid entries in clients.services, so the frontend
// knows to show the GTM Performance section for a client tagged with them.
const SERVICE_META = {
  monthly: { label: 'Monthly Retainer', icon: 'refresh' },
  sales: { label: 'Sales/Outreach', icon: 'trend' },
  gtm: { label: 'GTM', icon: 'target' },
  seo: { label: 'SEO', icon: 'chart' },
  ppc: { label: 'PPC / Paid Ads', icon: 'trend' },
  social: { label: 'Social Media', icon: 'users' },
  web: { label: 'Web Development', icon: 'folder' },
  fix: { label: 'Web Fix / One-off', icon: 'flag' },
  email: { label: 'Email Campaign', icon: 'bell' },
  content: { label: 'Content', icon: 'folder' },
  other: { label: 'Other', icon: 'folder' },
};
// A client's tickets don't always carry a `type` matching one of their
// tagged services 1:1 historically (e.g. plain 'other') — group anything
// unmatched under the client's own services where there's exactly one
// obvious fit, otherwise leave it out of the per-service breakdown (it still
// counts toward the top-level KPIs above).
function serviceMetaFor(id) { return SERVICE_META[id] || { label: id.charAt(0).toUpperCase() + id.slice(1), icon: 'folder' }; }

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

module.exports = L.withClient(async function (req, res, session) {
  const cid = session.cid;
  const enc = encodeURIComponent(cid);

  const [clientRows, tickets, team] = await Promise.all([
    L.sbSelect('clients', 'select=id,name,type,status,services,offboarded_at&id=eq.' + enc + '&limit=1'),
    L.sbSelect('tickets', 'select=id,title,status,priority,due,overdue,blocked,assignees,owner,type,source,plan_id,quick_meta,created_at,updated_at&client=eq.' + enc + '&is_deleted=not.is.true&order=updated_at.desc'),
    L.sbSelect('team_members', 'select=id,name,initials,color,role,department,profile_photo_url'),
  ]);

  const client = clientRows && clientRows[0];
  if (!client) return L.send(res, 404, { error: 'Client not found' });

  const teamById = {};
  (team || []).forEach(m => { teamById[m.id] = m; });

  const now = Date.now();
  const monthStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); })();
  const tx = Array.isArray(tickets) ? tickets : [];

  const openT = tx.filter(t => OPEN_STATUSES.has(t.status));
  const overdueT = openT.filter(t => t.overdue || (t.due && new Date(t.due).getTime() < now));
  const blockedT = openT.filter(t => t.blocked);
  const reviewT = tx.filter(t => t.status === 'review'); // awaiting client review/approval
  const doneT = tx.filter(t => DONE_STATUSES.has(t.status));
  const completedMonth = doneT.filter(t => t.updated_at && new Date(t.updated_at).getTime() >= monthStart);

  // --- Health score (100 = healthy; ticket signals only, no Promises) ---
  const reasons = [];
  let score = 100;
  if (openT.length) {
    const op = (overdueT.length / openT.length) * 35;
    const bp = (blockedT.length / openT.length) * 25;
    score -= op + bp;
    if (overdueT.length) reasons.push(overdueT.length + ' overdue item' + (overdueT.length > 1 ? 's' : ''));
    if (blockedT.length) reasons.push(blockedT.length + ' blocked item' + (blockedT.length > 1 ? 's' : ''));
  }
  score = clamp(Math.round(score), 0, 100);
  const level = score >= 85 ? 'excellent' : score >= 70 ? 'healthy' : score >= 50 ? 'attention' : 'at-risk';
  if (!reasons.length) reasons.push('Everything on track');

  // --- Service-specific breakdown — driven by the Master Client Directory's
  // own services tags, each scoped strictly to this client's own tickets of
  // that type. A client with no tickets of a tagged service still gets that
  // service's (empty) section, so "SEO" shows up as soon as it's tagged even
  // before any ticket exists — not silently missing. ---
  const clientServices = Array.isArray(client.services) ? client.services : [];
  const byType = {};
  tx.forEach(t => { const key = t.type || 'other'; (byType[key] = byType[key] || []).push(t); });

  const services = clientServices.map(id => {
    const meta = serviceMetaFor(id);
    const list = byType[id] || [];
    const done = list.filter(t => DONE_STATUSES.has(t.status)).length;
    const teamIds = new Set();
    list.forEach(t => [...(t.assignees || []), t.owner].filter(Boolean).forEach(a => teamIds.add(a)));
    return {
      id, label: meta.label, icon: meta.icon,
      total: list.length, done,
      active: list.filter(t => OPEN_STATUSES.has(t.status)).length,
      overdue: list.filter(t => t.overdue).length,
      progress: list.length ? Math.round((done / list.length) * 100) : 0,
      status: list.length === 0 ? 'planning' : (done >= list.length ? 'complete' : 'active'),
      team: Array.from(teamIds).map(aid => {
        const m = teamById[aid];
        return m ? { id: m.id, name: m.name, initials: m.initials, color: m.color, photo: m.profile_photo_url || null } : null;
      }).filter(Boolean),
    };
  });

  // Recently completed work — real tickets, not Promises — for the
  // "Completed Work" section on Overview. Active Tickets (below) shares the
  // same recurring-label resolution, so both lists' recurring lookups are
  // batched into one resolveRecurringLabels() call rather than two.
  const topDone = doneT
    .slice()
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, 8);

  // Active Tickets (Phase 2, Client Portal dashboard) — the same openT set
  // already computed for the openTickets KPI above, nearest due date first
  // (a ticket with no due date sorts after every ticket that has one; .sort
  // is stable, so ties and no-due tickets keep openT's own updated_at-desc
  // order). Capped at 10 — this only ever surfaces real ticket rows already
  // in the table, never a future/not-yet-generated recurring occurrence.
  const activeTicketsSorted = openT.slice().sort((a, b) => {
    const aHas = !!a.due, bHas = !!b.due;
    if (aHas && bHas) return new Date(a.due) - new Date(b.due);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return 0;
  });
  const topActive = activeTicketsSorted.slice(0, 10);

  const recurringLabels = await resolveRecurringLabels(topActive.concat(topDone));

  // Phase 5, 2026-09: completedWork now carries the same shape a client
  // needs to actually understand a finished piece of work at a glance
  // (ticket #, its real status label — 'done' and 'delivered' both land
  // here but are never flattened to a single fake "Done" string — service,
  // and whether it was recurring) instead of just a bare title.
  const completedWork = topDone.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    statusLabel: STATUS_LABELS[t.status] || t.status,
    delivered_at: t.updated_at,
    service: serviceMetaFor(t.type || 'other').label,
    isRecurring: !!recurringLabels[t.id],
    recurringLabel: recurringLabels[t.id] || null,
  }));

  const activeTickets = topActive.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    statusLabel: STATUS_LABELS[t.status] || t.status,
    due: t.due || null,
    recurringLabel: recurringLabels[t.id] || null,
  }));

  return L.send(res, 200, {
    client: { id: client.id, name: client.name, type: client.type },
    health: { score, level, reasons },
    kpis: {
      activeProjects: services.filter(p => p.status !== 'complete').length,
      openTickets: openT.length,
      completedThisMonth: completedMonth.length,
      atRisk: overdueT.length + blockedT.length,
      pendingApprovals: reviewT.length,
    },
    services: clientServices,
    projects: services,
    completedWork,
    activeTickets,
  });
});
