// GET /api/portal/reports               -> the client's published performance reports
// GET /api/portal/reports?section=gtm   -> GTM/campaign performance data (Phase 6, 2026-09)
// Read-only. Reuses the existing `reports` table (already populated by the
// internal Reports module, index.html) — no new table, no duplicate
// backend logic. `created_by` (an internal staff id) is intentionally
// omitted from the response; everything else on a report row is already
// written as client-facing narrative/chart content by staff.
//
// GTM section: Campaign Performance reuses `performance_plans.plan.goals[]`
// — the same client-scoped KPI data already shown to staff in the internal
// Performance Doc tab (Goals & KPIs), scoped by the existing
// `client_id=eq.<session.cid>` pattern used everywhere else in this file.
//
// Recent GTM Leads (Phase 7, 2026-09-10): outreach_opportunities now has a
// real, nullable client_id FK to clients.id (migration
// add_client_id_to_outreach_opportunities) — added because there was
// previously no safe way to scope individual leads to one portal client.
// Historical rows are NOT backfilled by name/company matching (deliberately
// — a wrong guess would leak one client's leads to another's portal); they
// stay client_id IS NULL and simply never appear here. Only opportunities a
// staff member has explicitly linked via the Outreach module's "Link to
// existing client" field are ever returned. Scoped the same way as every
// other query in this file: client_id=eq.<session.cid>, never a
// client-suppliable value.
//
// Phase 8 (2026-09-10): added a KPI summary and a stage breakdown, both
// computed server-side from the SAME already-fetched opportunity rows (zero
// extra queries — see the "Data loading" requirement). Real production
// stage data was inspected before building this: as of this phase, every
// real opportunity sits in exactly one of two stages — the legacy
// "opportunity" bucket or "closed_won" (confirmed via `SELECT stage_key,
// count(*) ... GROUP BY`) — so the KPI/breakdown logic deliberately keys off
// the already-reliable, staff-maintained `is_open`/`is_won` flags on
// outreach_stages (Open/Won/Lost), not a hand-picked list of stage names
// that doesn't reflect what's actually in the data (e.g. "New"/"Contacted"/
// "Qualified" from the brief's own illustrative examples have zero real
// rows today and no reliable way to distinguish them from "Open"). "New" as
// a KPI was deliberately NOT added — there's no distinct, reliable
// definition of "new" versus "active" available (no separate flag, no safe
// recency threshold) — see docs/development-log.md.
// cleanStageLabel() strips only a trailing internal parenthetical
// annotation (e.g. "(legacy — needs review)") for display — the stored
// `outreach_stages.label` value itself is never modified.
const L = require('./_lib');

function cleanStageLabel(label) {
  return String(label || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

async function handleGtm(req, res, session) {
  const enc = encodeURIComponent(session.cid);
  const [planRows, oppRows, stageRows] = await Promise.all([
    L.sbSelect('performance_plans', 'select=plan&client_id=eq.' + enc),
    L.sbSelect('outreach_opportunities', 'select=id,client_name,company,stage_key,project_type,created_at&client_id=eq.' + enc + '&order=created_at.desc&limit=50'),
    L.sbSelect('outreach_stages', 'select=key,label,color,is_open,is_won'),
  ]);

  const goals = [];
  (planRows || []).forEach(pp => {
    const list = (pp.plan && Array.isArray(pp.plan.goals)) ? pp.plan.goals : [];
    list.forEach(g => {
      if (!g) return;
      const current = g.current_progress != null ? g.current_progress : (g.current_value != null ? g.current_value : null);
      goals.push({
        title: g.title || g.kpi || 'Goal',
        service: g.service || null,
        unit: g.unit || null,
        current,
        target: g.target_value != null ? g.target_value : null,
        progress_pct: g.progress_pct != null ? g.progress_pct : null,
        status: g.status || null,
        by_date: g.by_date || null,
      });
    });
  });

  const stageInfo = {};
  (stageRows || []).forEach(s => { stageInfo[s.key] = s; });
  const opps = oppRows || [];

  const leads = opps.map(o => {
    const s = stageInfo[o.stage_key];
    return {
      name: o.client_name || null,
      company: o.company || null,
      status: s ? cleanStageLabel(s.label) : (o.stage_key || null),
      statusColor: s ? s.color : null,
      source: o.project_type || null,
      date: o.created_at || null,
    };
  });

  const kpi = {
    total: opps.length,
    active: opps.filter(o => { const s = stageInfo[o.stage_key]; return s ? s.is_open : false; }).length,
    won: opps.filter(o => { const s = stageInfo[o.stage_key]; return s ? s.is_won : false; }).length,
    lost: opps.filter(o => { const s = stageInfo[o.stage_key]; return s ? (!s.is_open && !s.is_won) : false; }).length,
  };

  const stageCounts = {};
  opps.forEach(o => { stageCounts[o.stage_key] = (stageCounts[o.stage_key] || 0) + 1; });
  const stageBreakdown = Object.keys(stageCounts).map(key => {
    const s = stageInfo[key];
    return {
      key,
      label: s ? cleanStageLabel(s.label) : key,
      color: s ? s.color : '#94A3B8',
      count: stageCounts[key],
      pct: opps.length ? Math.round((stageCounts[key] / opps.length) * 100) : 0,
    };
  }).sort((a, b) => b.count - a.count);

  return L.send(res, 200, {
    goals,
    kpi,
    stageBreakdown,
    leadsConnected: true,
    leads,
  });
}

// Client Reports (2026-09-28): client_report_deliveries holds the new
// manually-sent PDF/URL reports (Clients → [client] → Reports → Send
// Report, index.html) — a separate table from `reports` (see
// add_client_report_deliveries.sql for why). Merged into the SAME response
// array as the existing narrative reports, each mapped into a
// narrative-report-COMPATIBLE shape (title/summary/created_at) so
// portal-app.js's existing card list needs only a small kind==='delivery'
// branch, never a second list/fetch/section. Scoped by the same
// client_id=eq.<session.cid>&is_deleted=eq.false pattern already used for
// `reports` just below — a client can only ever see their own, published
// (never soft-deleted) reports, same isolation guarantee either table has
// always had.
async function fetchReportDeliveries(cid) {
  const enc = encodeURIComponent(cid);
  const rows = await L.sbSelect('client_report_deliveries',
    'select=id,title,description,report_type,file_url,external_url,sent_at' +
    '&client_id=eq.' + enc + '&is_deleted=eq.false&order=sent_at.desc&limit=100');
  return (rows || []).map(r => ({
    id: 'delivery_' + r.id,
    kind: 'delivery',
    type: r.report_type === 'url' ? 'link' : 'pdf',
    title: r.title,
    summary: r.description || '',
    created_at: r.sent_at,
    file_url: r.file_url || null,
    external_url: r.external_url || null,
  }));
}

module.exports = L.withClient(async function (req, res, session) {
  const section = (req.query && req.query.section) || '';
  if (section === 'gtm') return handleGtm(req, res, session);

  const enc = encodeURIComponent(session.cid);
  const [narrativeRows, deliveries] = await Promise.all([
    L.sbSelect('reports',
      'select=id,type,title,summary,sections,chart_data,period_start,period_end,created_at' +
      '&client_id=eq.' + enc + '&is_deleted=eq.false&order=period_end.desc.nullslast,created_at.desc&limit=100'),
    fetchReportDeliveries(session.cid),
  ]);
  const narrative = (narrativeRows || []).map(r => Object.assign({ kind: 'performance' }, r));
  const merged = [...deliveries, ...narrative].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return L.send(res, 200, { reports: merged });
});
