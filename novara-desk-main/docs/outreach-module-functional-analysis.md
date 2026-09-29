# Outreach / Upwork Sales Pipeline — Functional Analysis Document

**Source of truth analysed:** `docs/Upwork Sales Pipeline Tracker.xlsx`
**Analysis method:** full structural extraction via `openpyxl` — every sheet, every formula (not just formula text but computed values), every data validation (including the extended `x14` dropdowns that don't show up in a casual read), every conditional-formatting rule and its actual color, every embedded chart and its series references, all hidden sheets. Cross-referenced against the live Novara Desk codebase (sidebar/nav mechanism, design tokens, existing module patterns) so the recommendations below are grounded in what actually exists, not assumed.

**Status:** Analysis only. No application code has been written. This document is the approval gate before Phase 1 begins.

---

## 1. Workbook structure at a glance

10 sheets total — 7 visible, 3 hidden:

| Sheet | Visibility | Role | Rows of real data |
|---|---|---|---|
| Daily Tracker | visible | **Input** — daily outreach log | 15 days (Jul 1–16, 2026) |
| Sales Pipeline | visible | **Input** — open opportunities (CRM) | 9 opportunities |
| Closed Deals | visible | **Input** — won deals, re-entered manually | 6 deals |
| Credits Tracker | visible | **Input** — Upwork Connects purchases | 3 purchases |
| Monthly Summary | visible | **Reporting** — 100% formula rollup, no input | 18 pre-built months (Jul-26→Dec-27) |
| Dashboard | visible | **Reporting** — executive KPI + 12 charts, zero input | — |
| Onboarding | visible | **Separate workflow** — client onboarding checklist, unrelated data shape | 1 template (client "Simon") |
| How to Use | **hidden** | Documentation sheet, plain text | — |
| ChartData | **hidden** | Helper aggregation tables that feed Dashboard charts | — |
| Lists | **hidden** | Dropdown source lists + a stage→probability map | — |

No named ranges exist. No VBA/macros exist. No named-range or macro migration risk.

---

## 2. What the business actually does (reconstructed end-to-end)

This isn't just a lead tracker — reading all sheets together tells a specific story:

**Novara sells outreach/lead-gen services, and finds its own clients through Upwork.** The team spends Upwork "Connects" (credits, tracked in *Credits Tracker*) to submit proposals to prospective clients on Upwork. Each day's proposal/response activity is logged in *Daily Tracker*. A response that turns into a real conversation becomes a row in *Sales Pipeline*, progressing through stages (Proposal Sent → Responded → Discovery → Proposal Submitted → Negotiation → Closed Won/Lost) with manual follow-up tracking. When a deal is won, it's **re-entered by hand** into *Closed Deals* with revenue and payment status. Once won, the *Onboarding* checklist kicks in — but notice its action items ("purchase sending domains," "SMTP infrastructure," "inbox warm-up," "launch outbound campaign," "ICP and messaging strategy") describe standing up a **cold email campaign for that client** — i.e. Novara's actual service offering. So the full loop is:

```
Upwork Connects (spend) → Proposals sent (Daily Tracker) → Opportunities (Sales Pipeline)
   → Closed Won (Closed Deals, re-entered) → Client Onboarding (separate checklist)
```

Everything rolls up into *Monthly Summary* and *Dashboard* automatically via formulas.

This framing matters for the DB design: Upwork Connects are an **internal cost/spend** line (not client-billable), "Deal Owner" should map to real `team_members` (the department taxonomy `department='Outreach'` already exists in this codebase — see §7), and Onboarding is a genuinely different data shape (a task checklist) that shouldn't be forced into the CRM schema.

---

## 3. Sheet-by-sheet detail

### 3.1 Daily Tracker (input)

| Column | Type | Source |
|---|---|---|
| Date | date | manual |
| Day | text | `=TEXT(A,"ddd")` |
| Month | text | `=TEXT(A,"mmm-yy")` |
| Proposals Sent | number | manual |
| Responses Received | number | manual |
| Response Rate (%) | % | `=IFERROR(E/D,0)` |
| Notes | text | manual |

Pre-filled with every date in 2026; formulas pre-extended to row 1001 ("just keep entering dates below the last pre-filled row" per the hidden How to Use sheet). Only 15 real rows exist (Jul 1–16, 2026). Zebra-stripe conditional formatting only, no status colors.

### 3.2 Sales Pipeline (input — the core CRM table)

| Column | Type | Source |
|---|---|---|
| Client Name | text | manual |
| Company | text | manual |
| Proposal Date | date | manual (empty on all 9 real rows) |
| Proposal Value ($) | currency | manual |
| Current Stage | **dropdown** | `Lists!$A$2:$A$11` (10 values) |
| Expected Revenue ($) | currency | manual |
| Last Follow-up | date | manual |
| Deal Owner | **dropdown** | `Lists!$G$2:$G$5` (You, Team Member 1–3 — placeholder names, not real people) |
| Won/Lost Reason | text | manual |
| Closed Date | date | manual |

Summary box (`L:M`):
- **Weighted Pipeline Value** = `SUMIFS(Expected Revenue, Stage, "<>Closed Won", Stage, "<>Closed Lost")` — despite the name, this is **not actually probability-weighted**. `Lists` column B defines a probability % per stage (10%→100%) that is **never referenced by any formula in the workbook**. It's dead data — likely an intended feature that was never wired up.
- **Average Deal Size** = `AVERAGEIF(Proposal Value, "<>")`
- **Average Sales Cycle (Days)** = `AVERAGEIFS(#REF!, Closed Date, "<>")` — **broken**, see §4.
- **Total Active Opportunities** = `COUNTIFS(Client Name, "<>", Stage, "<>Closed Won", Stage, "<>Closed Lost")`

Conditional formatting: 6 distinct fill colors keyed to exact stage text (Closed Won=green `#C6EFCE`/text `#1E6B33`, Closed Lost=red `#F4C7C3`/text `#A31515`, Negotiation=orange `#FCE4C4`, Proposal Submitted=blue `#C9DDF2`, Follow-up=yellow `#FFF2B2`, On Hold=gray `#E2E2E2`), plus an **overdue-row highlight** (`AND(follow-up date < TODAY, stage still open)` → red).

**Data-quality finding:** all 9 real opportunity rows use `"Opportunity"` as their Current Stage value — this is **not one of the 10 dropdown options**. It was typed as free text rather than selected. This silently breaks every stage-based chart (see §4) even though it doesn't break the pipeline-value/count summaries (those only exclude the two closed stages by name, so "Opportunity" still counts as open).

### 3.3 Closed Deals (input — manually duplicated from Sales Pipeline)

| Column | Type | Source |
|---|---|---|
| Client | text | manual (re-typed, not linked to Sales Pipeline row) |
| Company | text | manual |
| Closed Date | date | manual |
| Proposal Date | date | manual (**empty on all 6 real rows**) |
| Revenue ($) | currency | manual |
| Sales Cycle (Days) | number | `=IF(AND(Closed<>"",Proposal<>""), Closed-Proposal, "")` |
| Project Type | **dropdown** | `Lists!$H$2:$H$8` (8 types) |
| Payment Received (Y/N) | **dropdown** | `Lists!$K$2:$K$4` (Yes/No/Partial) |
| Notes | text | manual |

Summary (`K:L`): Total Revenue Closed (`SUM`), Number of Deals Closed (`COUNTIFS`), Average/Highest/Lowest Deal Value.

**Structural flaw:** this sheet has **no relationship to Sales Pipeline** — winning a deal means retyping the client name from scratch. There is no "Won/Lost Reason" column here (that only exists on Sales Pipeline), so the reason a deal closed isn't visible next to the revenue. And because Proposal Date is empty on every real row, the auto-calculated Sales Cycle is **blank for all 6 real deals** — the metric exists in formula but has never actually produced a value in practice.

**No "Closed Lost" deals exist anywhere in this workbook.** Sales Pipeline's dropdown has a "Closed Lost" option, but none of the 9 real rows use it, and Closed Deals has no lost-deal equivalent at all. Historical loss data simply doesn't exist to migrate — it's untracked, not hidden.

### 3.4 Credits Tracker (input)

| Column | Type | Source |
|---|---|---|
| Date | date | manual |
| Credits Purchased | number | manual |
| Amount Paid | currency | manual |
| Currency | **dropdown** | `Lists!$I$2:$I$7` (USD/EUR/GBP/INR/AUD/CAD) — **defined but unused**, see below |
| Cost per Credit | currency | `=IF(OR(Credits="",Credits=0),"",C/B)` |
| Notes | text | manual |

Summary (`H:I`): Total Credits Purchased, Total Money Spent, Average Monthly Spend. Separate monthly breakdown table (`K:M`, pre-built Jan-2026→Dec-2027) via `SUMIFS` bucketed by month.

**Currency finding:** the `Currency` dropdown column exists but every real row leaves it blank — instead, the `Amount Paid` cell itself is manually formatted as GBP (`£`), while every dollar figure elsewhere in the workbook (Proposal Value, Revenue, Pipeline Value) is formatted as USD (`$`). There is **no FX conversion anywhere**. The Dashboard KPI "Total Spend on Credits" is a raw GBP number sitting next to five USD KPI cards with no currency label distinguishing them. This needs an explicit decision before migration (§8).

### 3.5 Monthly Summary (100% derived — no input)

16 columns per month, all formula: Proposals Sent, Responses, Response Rate (from Daily Tracker via `SUMIFS`/date-range); Active Deals, Active Pipeline Value (from Sales Pipeline — **see flaw below**); Deals Closed, Revenue Closed (from Closed Deals via date-range); Win Rate, Loss Rate (**broken**, see §4); Avg Deal Size, Avg Revenue/Proposal, Avg Revenue/Response (all derived ratios); Credits Purchased, Spend on Credits (from Credits Tracker); Cumulative Revenue (running `SUM`).

**Structural flaw:** "Active Deals" and "Active Pipeline Value" for *every* month row (including Aug-27, a future month) both point at Sales Pipeline's **current live totals** (`'Sales Pipeline'!$M$6` / `$M$2`) — not a snapshot of what the pipeline looked like in that specific month. Excel has no built-in way to snapshot historical state, so every month shows *today's* pipeline value. **These two columns are not real historical data and must not be migrated as if they were.** This is the single clearest case where the new system should do something Excel structurally cannot: a real point-in-time snapshot table (§7).

### 3.6 Dashboard (reporting — zero input)

6 primary KPI cards: Total Proposals Sent, Total Responses, Response Rate, Active Opportunities, Pipeline Value, Closed Deals.
5 secondary KPI cards: Closed Revenue, Average Deal Size, **Average Sales Cycle (Days) — always shows 0, broken formula upstream**, Upwork Credits Purchased, Total Spend on Credits (in GBP, unlabelled).

**12 embedded charts** (the hidden "How to Use" sheet claims 14 — likely stale documentation from before 2 charts were removed or broken):

| # | Chart | Type | Status |
|---|---|---|---|
| 1 | Proposals Sent by Day (Jul 2026) | Line | Works |
| 2 | Responses by Day (Jul 2026) | Line | Works |
| 3 | Response Rate Trend (Jul 2026) | Line | Works |
| 4 | Pipeline Value by Stage | Bar | **Broken** — always 0 (stage-name mismatch, §4) |
| 5 | Closed Revenue by Month | Bar | Works |
| 6 | Win vs Lost Deals | Pie | **Broken** — `#REF!` |
| 7 | Proposal Stage Funnel (Active Pipeline) | Bar | **Broken** — always 0 (same stage mismatch) |
| 8 | Top 10 Clients by Revenue | Bar | Works |
| 9 | Credits Purchased by Month | Bar | Works |
| 10 | Revenue vs Credits Spend by Month | Line (2 series) | Works |
| 11 | Proposal Conversion Funnel (All-Time) | Bar | **Broken** — `#REF!` |
| 12 | Monthly Performance Comparison | Bar (3 series) | Works |

**4 of 12 charts are currently non-functional** in the live workbook. This is not a migration risk to avoid — it's an opportunity: the new system should fix all four, since the underlying data (stage names, win/loss outcome) is either fixable via a data-cleanup pass or simply needs a real column that Excel's deleted reference used to provide.

### 3.7 ChartData (hidden helper sheet — "do not edit")

Four aggregation blocks feeding the charts above:
- Rows 4–13: stage → count/value (feeds charts #4, #7) — broken by the same stage-mismatch issue.
- Rows 17–18: Won/Lost outcome count (feeds chart #6) — `=COUNTIF('Daily Tracker'!#REF!,"Won")`. The column this once pointed at (an outcome column on Daily Tracker) was deleted at some point after this formula was built. **This confirms Daily Tracker used to track per-day Won/Lost outcomes and no longer does** — that capability needs to be reintroduced in the new schema if per-proposal outcome tracking matters (recommend modeling it via Sales Pipeline stage transitions instead, which is more correct than a Daily Tracker column ever was).
- Rows 22–28: funnel-by-stage lookup (feeds chart #11) — same `#REF!` cause.
- Rows 32–41: Top 10 clients by revenue, via `LARGE` + `INDEX/MATCH` against Closed Deals — **works correctly**, no dependency on the broken column.

### 3.8 Lists (hidden helper sheet)

10 columns of dropdown source values. Notably, **3 of the 8 lists are defined but never actually used by any data validation in the workbook**: `Priority` (High/Medium/Low), `DealStatus` (Open/Won/Lost), and `PaymentMethod` (6 methods). These appear to be planned-but-abandoned fields. `Stage`'s probability-% column (10%→100%) is likewise defined but never referenced (see §3.2). Worth deciding whether to build these into the new schema pre-emptively or leave them out until actually needed — recommend the latter (don't build unused fields).

### 3.9 Onboarding (visible, but a different workflow entirely)

Not a CRM table — a **17-item task checklist** (Action Item / Owner [dropdown: Client, Novara, Both] / Target Timing / Status [dropdown: Completed, In Progress, Pending]) currently filled in for one client ("Simon"). Items describe setting up a cold-email outreach campaign: contract signing, sending-domain purchase, SMTP/inbox warm-up, ICP definition, data enrichment, campaign launch. This is a **single hardcoded template**, not one instance per client — today, onboarding a second client would mean duplicating the whole sheet by hand.

This is a genuinely different data shape (task list, not opportunity record) and belongs in the implementation plan as its own optional phase, not folded into the pipeline schema.

---

## 4. Every broken/flawed calculation (complete list)

| Location | Formula | Problem | Real-world effect |
|---|---|---|---|
| Sales Pipeline `M5` | `AVERAGEIFS(#REF!,...)` | Deleted column reference | Dashboard's "Average Sales Cycle" KPI always shows 0 |
| Monthly Summary `I:J` (×18 rows) | `COUNTIFS('Daily Tracker'!#REF!,"Won"...)` | Same deleted column | Win Rate / Loss Rate always 0% for every month |
| ChartData `B17:B18` | `COUNTIF('Daily Tracker'!#REF!,"Won"/"Lost")` | Same | "Win vs Lost Deals" pie chart broken |
| ChartData `B22:B28` | `COUNTIF('Daily Tracker'!#REF!,"Yes")` | Same | "Proposal Conversion Funnel" chart broken |
| ChartData `B4:C13` | `COUNTIF/SUMIF` on exact stage text | Real data uses `"Opportunity"`, not a canonical stage | "Pipeline Value by Stage" and "Proposal Stage Funnel" charts show all zeros |
| Sales Pipeline `M3` "Weighted Pipeline Value" | Plain `SUMIFS`, no probability factor | Name implies weighting; formula doesn't weight | Metric name is misleading; probability data exists in Lists but is unused |
| Closed Deals `F` (Sales Cycle) | `Closed Date - Proposal Date` | Proposal Date empty on every real row | Sales Cycle blank for all 6 real deals |
| Monthly Summary `E:F` (Active Deals/Value) | Points at Sales Pipeline's *current* totals for every month | Excel can't snapshot historical state | Every month (including future ones) shows today's pipeline, not that month's |

**Root cause common to 5 of these 8 issues:** a column on Daily Tracker that used to track per-proposal Won/Lost outcome was deleted after several downstream formulas were already built referencing it. The new system doesn't need to recreate that column — outcome should live on the opportunity record itself (via Stage), which is a cleaner model than Excel's original design ever was.

---

## 5. Cross-sheet dependency map

```
Lists (dropdown source + probability map)
   └──▶ data validation on: Sales Pipeline (Stage, Deal Owner)
                             Closed Deals (Project Type, Payment Received)
                             Credits Tracker (Currency — unused in practice)

Daily Tracker ──▶ Dashboard (total proposals/responses, response rate)
              ──▶ Monthly Summary (per-month proposals/responses)
              ──▶ ChartData rows 17-28 (BROKEN — deleted column)

Sales Pipeline ──▶ Dashboard (active opportunities, pipeline value, avg sales cycle[broken])
               ──▶ ChartData rows 4-13 (BROKEN — stage-name mismatch)
               ──▶ Monthly Summary (active deals/value — FLAWED, always current snapshot)

Closed Deals ──▶ Dashboard (total revenue, avg deal size)
             ──▶ Monthly Summary (deals closed count/revenue by month)
             ──▶ ChartData rows 32-41 (Top 10 clients — WORKS)

Credits Tracker ──▶ Dashboard (credits purchased, total spend)
                ──▶ Monthly Summary (credits/spend by month)

Monthly Summary ──▶ Dashboard charts (Closed Revenue by Month, Revenue vs Credits, Monthly Performance)

ChartData ──▶ Dashboard charts (Stage breakdown, Win/Lost, Funnel, Top 10 clients)

Onboarding — fully standalone, no formula links to any other sheet
```

---

## 6. Business rules to encode in the new system

1. **Stage set** (ordered, with terminal states): Proposal Sent → Responded → Discovery Call Scheduled → Discovery Completed → Proposal Submitted → Negotiation → Follow-up / On Hold (parallel, not sequential) → Closed Won / Closed Lost (terminal).
2. **Response Rate** = Responses ÷ Proposals (guard divide-by-zero), computed both per-day and cumulatively.
3. **Open Pipeline Value** = sum of Expected Revenue where stage not in (Closed Won, Closed Lost). *Recommend renaming from "Weighted"* and, as a genuine enhancement, optionally offering a true probability-weighted variant using the stage-probability map that already exists in Lists but was never wired up.
4. **Sales Cycle (days)** = Closed Date − Proposal Date, only meaningful once Proposal Date is reliably captured (currently isn't, in practice).
5. **Overdue flag** = an open opportunity whose Last Follow-up date is in the past.
6. **Cost per Credit** = Amount Paid ÷ Credits Purchased.
7. **Currency**: every monetary field needs an explicit currency code stored alongside the amount — no implicit "whatever the cell happened to be formatted as." Recommend USD as the default/primary reporting currency (matching the majority of existing data) with currency stored per-record; defer live FX conversion unless the business actually needs blended multi-currency totals.

---

## 7. Database design recommendations

Target: Supabase/Postgres, matching this repo's existing conventions (flat `supabase/migrations/*.sql`, idempotent `ADD COLUMN IF NOT EXISTS` style, RLS policies keyed off `team_members`, no separate migration tool).

**Key structural decision: one opportunities table, not two.** Excel's split between Sales Pipeline and Closed Deals forces manual re-entry the moment a deal closes (§3.3) and loses the connection between an opportunity and its outcome. The new schema should **not repeat this** — "Closed Won" and "Closed Lost" become stage values on the same record, and "Closed Deals" becomes a filtered view/query over opportunities, not a separate table.

```sql
-- Stage lookup (replaces Lists!A:B) — ordered, with the probability data actually wired up this time
outreach_stages (
  id, key text unique,            -- 'proposal_sent' | 'responded' | ... | 'closed_won' | 'closed_lost'
  label text, sort_order int,
  probability_pct numeric,        -- from Lists!B — now actually usable for weighted pipeline value
  is_open boolean,                -- false for closed_won/closed_lost
  is_won boolean,                 -- true only for closed_won
  color text                      -- badge color, seeded from the dxf colors already extracted (§3.2)
)

-- Core CRM table (replaces Sales Pipeline + Closed Deals combined)
outreach_opportunities (
  id uuid pk, client_name text, company text,
  proposal_date date, proposal_value numeric, currency text default 'USD',
  stage_id fk -> outreach_stages,
  expected_revenue numeric,
  last_follow_up_date date,
  deal_owner_id fk -> team_members,   -- replaces the placeholder "You/Team Member 1-3" list
  won_lost_reason text,
  closed_date date,
  project_type text,                  -- from Lists!H, only relevant once won
  payment_received text,              -- 'yes' | 'no' | 'partial'
  notes text,
  created_at, updated_at
)

-- Daily activity log (replaces Daily Tracker)
outreach_daily_activity (
  id, activity_date date unique, proposals_sent int, responses_received int,
  notes text, logged_by fk -> team_members, created_at
)
-- response_rate computed at query time, not stored

-- Credits/Connects ledger (replaces Credits Tracker)
outreach_credits_purchases (
  id, purchase_date date, credits_purchased int, amount_paid numeric,
  currency text default 'GBP', notes text, created_at
)

-- FIXES the Monthly Summary snapshot flaw (§3.5) — real point-in-time history,
-- populated by a daily scheduled job, not recomputed from "current" state
outreach_pipeline_snapshots (
  id, snapshot_date date, active_opportunities_count int, active_pipeline_value numeric
)

-- Deferred/Phase 6 — Onboarding, modeled properly as one-per-client instead of one hardcoded sheet
outreach_onboarding_checklists (id, opportunity_id fk, client_name text, created_at)
outreach_onboarding_tasks (id, checklist_id fk, action_item text, owner text, target_date date, status text, sort_order int)
```

`Monthly Summary` and the Dashboard KPI/chart aggregations become SQL views (or computed on the client from the base tables) rather than a stored, hand-extended-to-row-1000 sheet — no analog needed for Excel's "pre-built through Dec-2027" pattern; a `GROUP BY date_trunc('month', ...)` query has no upper bound to pre-plan for.

RLS: mirror the existing pattern in this codebase (role/department checks against `team_members`), and reuse `department = 'Outreach'` (already present in `team_department.sql` / `add_yusuf_ayaz_outreach.sql`) for scoping who sees this module, extending `restrictedAreaAllowed()` accordingly.

---

## 8. UI recommendations

**Architecture decision (confirmed):** the Outreach module will be built as a native vanilla-JS module inside `index.html`, matching the existing app exactly — same hand-rolled hash router (`nav()`/`render()`), same `--nd2-*` design tokens, same CSS-transition-based motion, no build step, no Framer Motion, no React. This was a genuine fork in the road: the brief originally asked for Framer Motion, but the main app is a single ~19,500-line static file with zero bundler, and Framer Motion only exists in the separate proposal-builder React app. Introducing a build step into the main app — or mounting an isolated React micro-frontend — was the alternative; it was explicitly turned down in favor of zero new tooling and zero risk to the rest of the app. Motion in this module will use plain CSS transitions against `--nd2-fast`/`--nd2-med`/`--nd2-ease`, matching how the newest parts of the existing dashboard already animate.

There already **is** an "Operations" sidebar group (Plans, Standup, Ops Intel, Reports) — adding "Outreach" there is a direct extension of an existing pattern, not a new one.

The rest of the UI recommendation:

- **Design tokens**: use the existing `--nd2-*` system (warm-neutral surfaces, `#FF5B04` accent, `--nd2-good/warning/serious/critical` status colors) already defined for the newest parts of this app (Dashboard V3) — not the older legacy token set.
- **Components to reuse, not reinvent**: `.nd2-card` (generic card, already used for both chart cards and the tickets table), `.nd2-kpi-chip` (stat tiles — maps directly to the 11 Dashboard KPI cards in the workbook), `.nd2-tabs`, `.nd2-content-grid` (main content + right rail layout — good fit for an opportunity detail view), `.dsh-tbl` (table styling with the existing "show more" pattern for the opportunities list).
- **Charts**: follow the established "hand-styled SVG" pattern (`nd2RenderDonut`, `nd2RenderBarList`, `nd2RenderTrend`) used for the newest dashboard work, not Chart.js (which stays in Ops Intel/Reports as legacy, untouched).
- **Status badges**: seed directly from the exact conditional-formatting colors already extracted from the workbook in §3.2/§3.3 — this preserves visual continuity for the team who already associate those colors with those stages.

---

## 9. Dashboard recommendations

- Rebuild all 11 KPI cards using `.nd2-kpi-chip`, 6 primary + 5 secondary, matching the workbook's own grouping.
- Rebuild all 12 charts using the hand-styled SVG pattern — and **fix the 4 that are currently broken** (§4) as part of Phase 4, since the underlying data model fix (stage cleanup, outcome tracking via stage instead of a deleted column) happens naturally once the new schema is in place.
- Add a genuine enhancement Excel never had: **probability-weighted pipeline value**, using the stage-probability data that already exists in Lists but was never wired up — likely the single most requested feature once shown, since "Weighted Pipeline Value" already claims to do this.
- Add **per-owner (rep) performance breakdown** — Deal Owner exists on every opportunity today but is never reported on anywhere in the workbook. This is a natural enterprise-SaaS addition with zero new data required.
- Replace Monthly Summary's flawed "Active Deals/Value" columns with real historical snapshots (§7), so trend charts over time are actually trustworthy.

---

## 10. Risks during migration

| Risk | Detail | Recommended handling |
|---|---|---|
| Stage mismatch | All 9 real opportunities use `"Opportunity"`, not a canonical stage | Manual review + mapping decision before import (likely: prompt for correct stage per row, or default to a sensible stage like "Discovery Completed" pending confirmation) |
| Currency ambiguity | Pipeline in USD-formatted cells, Credits in GBP-formatted cells, no FX anywhere | Store currency explicitly per record; do not auto-convert; surface both currencies clearly in the UI rather than merging into one total |
| Sales Pipeline ↔ Closed Deals duplication | Won deals are manually retyped, no link between the two sheets | During import, fuzzy-match by client name to merge into single opportunity records; flag unmatched rows for manual review rather than silently guessing |
| Historical Win/Lost data doesn't exist | The tracking column was deleted before real data accumulated; 0 "Closed Lost" records exist anywhere | Accept that loss-tracking starts fresh in the new system — nothing to migrate here, nothing lost by not migrating it |
| Monthly Summary "Active Deals/Value" isn't real history | Every month shows today's snapshot | Do not migrate these two columns as historical fact; only backfill Proposals/Responses/Deals Closed/Revenue/Credits, which are genuinely date-scoped |
| Sales Cycle data gap | Proposal Date empty on all 6 real Closed Deals rows | Sales cycle will be unset for pre-migration deals; fine going forward once Proposal Date is captured consistently |
| Onboarding is single-template | Not one row per client today | Explicit scope decision needed: Phase 6 (deferred) vs. cut entirely for now |
| Unused Lists fields | Priority, DealStatus, PaymentMethod defined but never used by any real validation | Don't build these into the schema pre-emptively; add only if actually requested |

---

## 11. Suggested implementation phases

**Phase 0 — Decisions (before any code):** ✅ complete, all approved.
- ~~Architecture choice~~ — **decided**: vanilla-JS module matching the existing app exactly (§8).
- ~~Stage-mapping for the 9 "Opportunity"-labelled rows~~ — **decided**: preserve exactly as imported, no automatic remapping. `"Opportunity"` is seeded as its own legacy stage row rather than force-mapped to one of the 10 canonical stages; manual reassignment happens later, per-record, through the normal edit UI once it exists.
- ~~Currency handling~~ — **decided**: store currency per record (defaulting to what the source sheet actually used — USD for pipeline/deals, GBP for credits), no FX conversion logic in Phase 1. Every monetary column is paired with its own currency column from the start so conversion can be added later without a schema change.

**Phase 1 — Foundation:**
Database schema + migrations (`outreach_stages`, `outreach_opportunities`, `outreach_daily_activity`, `outreach_credits_purchases`), RLS policies scoped to `department='Outreach'` (extending the existing pattern), seed the stage lookup with real probability values, import the real historical data (15 days, 9 opportunities merged with 6 closed deals, 3 credit purchases) using the Phase-0 decisions.

**Phase 2 — Core CRM:**
Sidebar nav entry (Operations → Outreach, following the exact existing pattern), Daily Tracker equivalent (log view + entry form), Sales Pipeline equivalent (opportunity list, detail view, stage transitions, CRUD) — all read+write, using `.nd2-card`/`.nd2-tabs`/`.dsh-tbl`.

**Phase 3 — Closed deals & credits:**
Closed-deals view as a filtered query over opportunities (not a separate table), Credits Tracker CRUD.

**Phase 4 — Dashboard:**
11 KPI cards + 12 charts (hand-styled SVG), including the 4 previously-broken charts now working correctly, plus the new probability-weighted pipeline value and per-owner breakdown.

**Phase 5 — Real historical reporting:**
Pipeline snapshot job (fixes the Monthly Summary flaw), Monthly Summary equivalent as a real query over genuine history.

**Phase 6 — Deferred, optional:**
Client onboarding checklist module (own data shape, one checklist per client instead of one hardcoded template).

Every phase, on completion, will report: what was built, database changes, UI changes, business logic implemented, testing completed, and explicit proof that existing Novara Desk functionality is unaffected — exactly as requested.
