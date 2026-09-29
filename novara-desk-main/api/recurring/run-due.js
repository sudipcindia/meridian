// GET|POST /api/recurring/run-due   (VERCEL CRON ONLY — see vercel.json)
// ----------------------------------------------------------------------------
// Server-side scheduled execution for Recurring Workflows (Phase 5A, 2026-09).
// Reuses the shared deterministic engine in _engine.js — see that file for the
// full rule set. This handler's only job is: authenticate the caller, load
// every performance_plan that has any workflows, and hand each one to the
// shared engine. No AI. No client-suppliable input at all (Vercel Cron sends
// a bare authenticated request with no body/query the caller controls), so
// there is no cross-tenant injection surface by construction — every ticket
// this ever creates is scoped to the plan's own client_id, read from the
// database, never from a request parameter.
const L = require('../portal/_lib');
const { processPlanDueWorkflows } = require('./_engine');

module.exports = async function handler(req, res) {
  try {
    // Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on
    // requests it triggers for a cron job, when CRON_SECRET is set as a
    // project env var — this is Vercel's own documented mechanism for
    // verifying a request genuinely came from the configured scheduler
    // (not an arbitrary public caller). Client-side permission checks
    // (restrictedAreaAllowed, etc.) are irrelevant here on purpose — this is
    // a server-to-server trigger, not a staff action.
    if (!process.env.CRON_SECRET) {
      console.error('[recurring/run-due] CRON_SECRET not configured — refusing to run');
      return L.send(res, 500, { error: 'Scheduler not configured (missing CRON_SECRET)' });
    }
    const auth = req.headers['authorization'] || req.headers['Authorization'] || '';
    if (auth !== 'Bearer ' + process.env.CRON_SECRET) {
      return L.send(res, 401, { error: 'Unauthorized' });
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return L.send(res, 500, { error: 'Not configured (missing env vars)' });
    }

    // Fetch every plan (cheap — ~14 rows today) and let the engine skip any
    // with no workflows, exactly mirroring the existing client-side
    // runAllRecurringWorkflows()'s "iterate everything, no-op if empty"
    // approach — no fragile jsonb-path filter needed at this table size.
    const plans = await L.sbSelect('performance_plans', 'select=id,client_id,plan,updated_at');

    const summary = [];
    let ticketsCreated = 0, failures = 0;
    for (const pp of (plans || [])) {
      if (!pp.plan || !Array.isArray(pp.plan.workflows) || !pp.plan.workflows.length) continue;
      const results = await processPlanDueWorkflows(pp);
      if (!results.length) continue;
      summary.push({ plan_id: pp.id, results });
      results.forEach(r => {
        if (r.status === 'created' || r.status === 'created_unconfirmed') ticketsCreated++;
        if (r.status === 'failed') failures++;
      });
    }

    // AUDIT (no client data / secrets logged): what ran, how many tickets,
    // how many failures — enough to spot a stuck workflow without exposing
    // per-client detail in logs.
    console.log('[recurring/run-due] AUDIT', {
      at: new Date().toISOString(),
      plansScanned: (plans || []).length,
      plansWithActivity: summary.length,
      ticketsCreated, failures,
    });

    return L.send(res, 200, { ok: true, plansScanned: (plans || []).length, ticketsCreated, failures, summary });
  } catch (e) {
    console.error('[recurring/run-due]', e && e.message);
    return L.send(res, 500, { error: 'Server error' });
  }
};
