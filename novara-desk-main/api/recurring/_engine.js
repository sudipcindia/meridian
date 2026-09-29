// ============================================================================
// Recurring Workflow engine — SERVER-SIDE execution (Phase 5A, 2026-09)
// ----------------------------------------------------------------------------
// This is NOT a second engine. It mirrors, rule-for-rule, the deterministic
// client-side logic already built and QA'd in index.html
// (wfIsDue / _calcNextDate / _createTicketForWorkflow / _processWorkflow /
// runWorkflowsForPlan) so the same workflow can execute correctly whether a
// staff member clicks "Run due workflows" in the browser, or this file runs
// on a schedule with nobody watching. Same ticket shape, same GTM stage
// machine, same priority/assignee handling, same "review only, never the
// rework stages" GTM boundary. No AI anywhere in this file.
//
// Filename is `_`-prefixed so Vercel does not route it as its own function
// (same convention as api/portal/_lib.js) — only run-due.js counts against
// the serverless function limit.
// ============================================================================
const L = require('../portal/_lib');

// Kept here for reference/consistency with index.html's GTM_WORKFLOW_STAGES —
// the scheduler never advances rework stages itself (that stays a manual,
// Operations-triggered action in the UI: advanceGTMDecision/advanceGTMStage).
// Listed so a future reader can see at a glance that this file intentionally
// does not implement stages 1-6.
const GTM_REWORK_STAGE_KEYS = [
  'rework_icp', 'rescrape_data', 'review_content',
  'launch_campaign', 'ab_test_linkedin', 'ab_test_email',
];

// Mirrors index.html's own VALID_TICKET_TYPES (derived there from
// QT_SERVICES) — this server runtime can't share that module, so this list
// is kept identical by hand. Was missing social/email/content/uiux/sales/
// weboptimisation (2026-09 taxonomy additions), which meant a workflow set
// to any of those services silently created its ticket as 'other' instead.
const VALID_TICKET_TYPES = new Set([
  'monthly', 'sales', 'seo', 'ppc', 'social', 'web',
  'weboptimisation', 'uiux', 'fix', 'email', 'content', 'other',
]);

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Identical rule to index.html's _calcNextDate. 'daily'/'weekly' added for
// the 2026-09 Client Portal recurring-visibility phase (Sales/Outreach
// workflows now need them) — previously only index.html's copy had 'weekly'
// (for recurring promises) and neither copy had 'daily' at all, so a
// workflow saved with frequency:'daily' would have silently rescheduled
// itself a month out the first time this server-side engine (not the
// client-side "Run now" button) processed it.
function calcNextDate(fromDate, freq) {
  const d = fromDate ? new Date(fromDate) : new Date();
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'every_2_weeks') d.setDate(d.getDate() + 14);
  else if (freq === 'every_10_days') d.setDate(d.getDate() + 10);
  else if (freq === 'every_14_days') d.setDate(d.getDate() + 14);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else d.setMonth(d.getMonth() + 1); // safe default, matches 'monthly'
  return d.toISOString().slice(0, 10);
}

// Identical rule to index.html's wfIsDue.
function wfIsDue(wf, todayIso) {
  return !!wf && wf.active && !!wf.next_run && wf.next_run <= todayIso;
}

// Was: read every NVR-* row and use MAX+1 with no re-verification and no
// atomicity — a genuinely separate implementation from index.html's client-
// side genTicketId(), with the same underlying class of bug (2026-09
// incident, see supabase/migrations/ticket_id_generation_atomic_sequence.sql
// for the full root-cause writeup): nothing stopped this MAX+1 candidate
// from colliding with an id that existed but wasn't reflected in this read,
// and nothing made two near-simultaneous invocations of this function safe.
//
// Fixed by calling the exact same public.next_ticket_id() Postgres RPC that
// index.html's genTicketId() now calls — one atomic sequence, shared by
// every ticket-creation path (client and server), so there is exactly one
// place that can ever hand out a ticket id.
async function genTicketIdServer() {
  const id = await L.sbFetch('rpc/next_ticket_id', { method: 'POST', body: '{}' });
  if (typeof id !== 'string' || !id) throw new Error('next_ticket_id() RPC returned no id');
  return id;
}

// Same ticket shape as index.html's _createTicketForWorkflow, built from the
// service-role REST API instead of the browser supabase client. A straight
// POST (not upsert) — genTicketIdServer() already guarantees a fresh id, so a
// collision here should genuinely fail loudly rather than silently overwrite.
async function createTicketForWorkflow(client, pp, wf, title, priority, stageKey) {
  const tid = await genTicketIdServer();
  const ticketType = VALID_TICKET_TYPES.has(wf.service) ? wf.service : 'other';
  const payload = {
    id: tid,
    title: `[Workflow] ${client.name} — ${title}`,
    client: pp.client_id,
    type: ticketType,
    status: 'new',
    priority: priority || wf.priority || 'normal',
    sprint: true,
    due: '',
    overdue: false, blocked: false, blocked_reason: '',
    assignees: wf.assignee_id ? [wf.assignee_id] : [],
    owner: wf.assignee_id || '',
    description: `Recurring workflow: ${wf.name}${stageKey ? ` (stage: ${stageKey})` : ''} — created by scheduled execution`,
    contact: {
      name: client.contact_name || '',
      email: client.contact_email || '',
      phone: client.contact_phone || '',
    },
    attachments: [], tasks: [], comms: [],
    plan_id: pp.id,
    source: 'recurring_workflow',
    // workflow_id + frequency: a direct, reliable link back to the
    // originating workflow (2026-09 Client Portal recurring-visibility
    // phase) so the Client Portal doesn't have to guess it from a title
    // match. Additive to the existing quick_meta.project field, never a
    // second recurring-tracking system — workflow_id is never surfaced to
    // the client, only used server-side (api/portal/tickets.js) to resolve
    // next_run. Kept identical to index.html's client-side mirror
    // (_createTicketForWorkflow) by hand, same convention as the rest of
    // this file.
    quick_meta: Object.assign({}, wf.project ? { project: wf.project } : {}, { workflow_id: wf.id, frequency: wf.frequency || null }),
  };
  await L.sbFetch('tickets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(payload),
  });
  return tid;
}

// Optimistic-concurrency guarded plan save: only commits if `updated_at`
// still matches what we last read (no new migration/locking table — reuses
// the existing `updated_at` column exactly as PostgREST's own recommended
// compare-and-swap pattern). Returns the new updated_at on success, or null
// if another invocation already changed this plan first (lost the race —
// caller must NOT retry within the same invocation; the next scheduled tick
// re-evaluates from fresh state, so nothing is lost, just deferred one cycle).
async function guardedSavePlan(planId, planJson, expectedUpdatedAt) {
  const path = 'performance_plans?id=eq.' + encodeURIComponent(planId) +
    '&updated_at=eq.' + encodeURIComponent(expectedUpdatedAt);
  const nowIso = new Date().toISOString();
  const rows = await L.sbFetch(path, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ plan: planJson, updated_at: nowIso }),
  });
  if (!rows || !rows.length) return null;
  return nowIso;
}

// Best-effort, non-guarded save — used only to persist a failure note in
// run_history. Never advances next_run/gtm_stage (those are only ever
// advanced by guardedSavePlan, right after a ticket is confirmed created),
// so a lost race here has no correctness impact, only a possibly-missing
// failure note for this one cycle.
async function bestEffortSavePlan(planId, planJson) {
  try {
    await L.sbFetch('performance_plans?id=eq.' + encodeURIComponent(planId), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ plan: planJson }),
    });
  } catch (e) {
    console.error('[recurring/_engine] best-effort failure-note save failed', planId, e && e.message);
  }
}

// Processes every due, active workflow on one plan. For each:
//   1. Verify due + active + valid client + not an in-progress GTM cycle.
//   2. Create the ticket FIRST (ticket architecture identical to every other
//      ticket in the system — ends up in the assignee's existing For You).
//   3. Only on success, advance schedule state under the concurrency guard.
//   4. On failure, record it in run_history and leave next_run untouched —
//      never silently advance as though the work succeeded (so the next
//      scheduled tick retries automatically; no infinite tight loop, since
//      each retry is a full 24h apart and cheap/idempotent).
// AI is never called anywhere in this path.
async function processPlanDueWorkflows(pp) {
  const results = [];
  if (!pp || !pp.plan || !Array.isArray(pp.plan.workflows) || !pp.plan.workflows.length) return results;

  const clients = await L.sbSelect('clients',
    'select=id,name,status,contact_name,contact_email,contact_phone&id=eq.' + encodeURIComponent(pp.client_id) + '&limit=1');
  const client = clients && clients[0];
  if (!client || client.status === 'offboarded') return results;

  const today = todayStr();
  let currentUpdatedAt = pp.updated_at;
  const plan = pp.plan; // mutate in place; we control every write below

  for (const wf of plan.workflows) {
    if (!wfIsDue(wf, today)) continue;
    const isGtm = wf.template_key === 'gtm_performance_review';
    if (isGtm && wf.gtm_stage) continue; // a review/rework cycle is already open — refuse (idempotency)

    if (!Array.isArray(wf.run_history)) wf.run_history = [];
    const title = isGtm ? 'Review campaign performance — check lead volume' : (wf.task_title || wf.name);
    const priority = isGtm ? 'high' : wf.priority;
    const stageKey = isGtm ? 'review' : null;

    let tid = null, failMsg = null;
    try {
      tid = await createTicketForWorkflow(client, { id: pp.id, client_id: pp.client_id }, wf, title, priority, stageKey);
    } catch (e) {
      failMsg = String((e && e.message) || e).slice(0, 300);
    }

    if (failMsg) {
      wf.run_history.unshift({ date: today, stage: stageKey, error: true, message: failMsg });
      await bestEffortSavePlan(pp.id, plan);
      results.push({ workflow_id: wf.id, status: 'failed', error: failMsg });
      continue;
    }

    if (isGtm) {
      wf.gtm_stage = 'awaiting_decision';
      wf.last_run = wf.next_run || today;
      // next_run intentionally NOT advanced — matches the client-side rule:
      // a new review cycle can't start while this one is still open.
    } else {
      wf.last_run = wf.next_run || today;
      wf.next_run = calcNextDate(wf.next_run || today, wf.frequency);
    }
    wf.run_history.unshift({ date: today, stage: stageKey, ticket_id: tid });

    const newUpdatedAt = await guardedSavePlan(pp.id, plan, currentUpdatedAt);
    if (newUpdatedAt) {
      currentUpdatedAt = newUpdatedAt;
      results.push({ workflow_id: wf.id, status: 'created', ticket_id: tid, committed: true });
    } else {
      // Extremely rare: another invocation committed a change to this exact
      // plan between our read and this write. The ticket above was already
      // created (see docs/project-memory.md for why ticket-first was chosen
      // over claim-first). Do not retry the guarded write in this
      // invocation — re-reading and reconciling is left to the next tick.
      results.push({ workflow_id: wf.id, status: 'created_unconfirmed', ticket_id: tid, committed: false });
    }
  }

  return results;
}

module.exports = {
  GTM_REWORK_STAGE_KEYS,
  calcNextDate,
  wfIsDue,
  genTicketIdServer,
  createTicketForWorkflow,
  guardedSavePlan,
  processPlanDueWorkflows,
};
