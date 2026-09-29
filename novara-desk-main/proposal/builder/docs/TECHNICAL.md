# Proposal Builder — Technical Documentation

Written at the end of Phase 09 (Production Hardening & Enterprise QA). Covers the system as it exists after Phases 01–09.

## 1. Architecture

The Proposal Builder is an isolated Vite + React + TypeScript application living under `proposal/builder/` inside the main Novara Desk repository. It shares the main app's Supabase project (same database, same Supabase Auth users) but is otherwise a fully separate deployment — its own `package.json`, its own Vercel project, its own routes. It never modifies the main app (`index.html`) except for one additive, read-only "Proposals" tab inside Ops Intel (Phase 08).

**Frozen master template.** `proposal/components/proposal/` contains the 11 approved proposal page components (Cover, page02–page11). This directory is read-only for the lifetime of the project — every phase's plan explicitly forbids editing it. Every client proposal is a *Document* (its own row of variables + content overrides), never a copy of the template's source files.

**Three layers:**
1. **Frontend (`src/`)** — React app, Supabase Auth-gated for staff, one public unauthenticated route for clients.
2. **Backend (`api/`)** — Vercel Serverless Functions, using the service-role Supabase key. This is where all real security enforcement lives (see §Security below) — RLS alone is not sufficient because every server function bypasses it.
3. **Database (`supabase/migrations/add_proposal_*.sql`)** — 9 tables, 2 private Storage buckets, all namespaced `proposal_builder_*` / `proposal-*` so they can never collide with existing Novara Desk tables.

**Key architectural decisions carried through every phase:**
- **No second rendering engine.** The Editor's live preview, the PDF engine's print view, and the client's read-only view all render the exact same `LiveTemplatePreview` component wrapping the frozen template. Variables/content overrides are applied via DOM text-patching (`modules/editor/domPatch.ts`), never by forking the template's JSX.
- **Adapter pattern for PDF generation.** `api/_lib/pdf/engine.ts` is a generic, document-agnostic Puppeteer/Chromium wrapper. `api/_lib/pdf/proposalPdfAdapter.ts` is the only file that knows "proposal" exists — a future Quotation/Invoice/Contract type would get its own sibling adapter, never touching `engine.ts`.
- **Opaque tokens, not JWTs**, for the client share link (`api/_lib/share/tokens.ts`) — a 256-bit random string, chosen specifically so revocation is a single-column check rather than needing a deny-list.
- **One activity table serves both the "Activity Timeline" and "Audit Trail" requirements** (Phase 08) — append-only, free-text `action` column, no separate parallel logging system.

## 2. Database

All tables live in the same Supabase project as Novara Desk's `team_members`/`notifications` tables (read, never modified).

| Table | Purpose | Written by |
|---|---|---|
| `proposal_builder_proposals` | Metadata: client/company name, email, status, prepared-by, `first_viewed_at` | Staff UI, `api/client/resolve.ts` |
| `proposal_builder_documents` | One row per proposal: pages, variables, content overrides, `document_version` | Staff UI (Editor) |
| `proposal_builder_document_versions` | Append-only snapshot of every save | Editor autosave |
| `proposal_builder_review_notes` | Append-only reviewer comments + system-generated status-change notes | Review panel |
| `proposal_builder_pdfs` | Cache of generated draft PDFs, keyed `(document_id, document_version)` | `api/_lib/pdf/proposalPdfAdapter.ts` |
| `proposal_builder_share_links` | One opaque token per active client link; `revoked_at`/`expires_at` reserved | `api/proposals/send.ts` |
| `proposal_builder_acceptances` | One row per client acceptance: signer, method, signature, exact document_version | `api/client/accept.ts` |
| `proposal_builder_signed_pdfs` | The final signature-stamped PDF, linked to its `acceptance_id` | `api/client/accept.ts` |
| `proposal_builder_activity` | Append-only activity/audit log: action, actor, detail, timestamp | Every lifecycle event, client and server |

**Storage buckets** (both private, service-role or signed-URL access only): `proposal-pdfs`, `proposal-signatures`.

**RLS.** Every table above has a `staff_access` policy: `TO authenticated USING (auth.jwt()->>'email' IN (SELECT email FROM team_members))`. Storage bucket policies were tightened to the same rule in Phase 09 (previously public — see Security). None of this protects the client-facing endpoints, since those always use the service-role key, which bypasses RLS entirely by design — see the Security section for what actually protects those.

**Indexes:** `(proposal_id, created_at DESC)` on `activity`, `share_links`, `acceptances`; unique `(document_id, document_version)` on `pdfs`; unique `token` on `share_links`; unique `acceptance_id` on `signed_pdfs`.

**Scalability:** row counts here will always be small relative to Novara's ticket volume (proposals are created per-engagement, not per-transaction). No partitioning or archival strategy is needed at this scale. If it ever becomes necessary, `proposal_builder_activity` is the only table likely to grow unboundedly — it already has a fetch-on-demand, cached-per-session read pattern (Ops Intel), so no schema change would be needed to add pagination later.

## 3. Workflow

```
Draft → In Review → (Changes Requested ⇄ In Review) → Approved → Ready for PDF/Ready
   → Sent (client emailed a unique link) → [Viewed, derived from first_viewed_at]
   → Signed (client accepted + e-signed) → Archived (any state, reversible)
```

Full end-to-end: Staff creates a proposal (duplicated from the frozen template) → edits variables/content in the Editor (autosaves, versioned) → optionally uses the AI Assistant per block → submits for Review (health-checked before "Approved" is allowed) → generates a PDF preview → sends to the client (mints a share link, emails it) → client opens the unauthenticated link, reads all pages, signs on the last page → server records the acceptance, stamps a final signed PDF, notifies Jayson/Operations/Developers, flips status to Signed → the whole history is visible read-only in Ops Intel's Proposals tab.

## 4. Deployment

Deployed as its own Vercel project, pointed at the `add-proposal-project` branch (this repo is monorepo-style; Vercel's project root is set to `proposal/builder/`). `vercel.json` configures extended `maxDuration`/`memory` for the two functions that drive headless Chromium (`api/pdf/generate.ts`, `api/client/accept.ts`) — both need enough budget for a cold Puppeteer/Chromium launch.

Local development: `npm run dev` (Vite only — the `api/*` serverless functions are **not** available under plain `vite dev`; use `vercel dev` to exercise them locally, or test against the deployed preview).

## 5. Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Client (build-time) | Same Supabase project as Novara Desk — safe to expose |
| `VITE_SUPABASE_ANON_KEY` | Client (build-time) | Anon key — safe to expose, RLS is the real gate |
| `SUPABASE_URL` | Server only | Used by `supabaseServer` (service-role client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only, **secret** | Bypasses RLS — never expose to the client |
| `ANTHROPIC_API_KEY` | Server only, **secret** | AI Assistant (Claude) |
| `RESEND_API_KEY` | Server only, **secret** | Outbound client/staff email |
| `PDF_INTERNAL_SECRET` | Server only, **secret** (new, Phase 09) | Shared secret only `engine.ts`'s own headless Chromium attaches, so `api/pdf/resolve.ts` rejects any other caller |
| `PUBLIC_BASE_URL` | Server, optional | Overrides Vercel's auto-detected deployment URL for building share/print links |
| `VERCEL_URL` | Server, auto-set by Vercel | Fallback if `PUBLIC_BASE_URL` isn't set |

## 6. Folder Structure

```
proposal/
  components/proposal/     ← FROZEN master template — never edit
  builder/
    src/
      pages/                ← one file per route
      components/           ← editor/, review/, client/, pdf/ subfolders by feature
      hooks/                 ← useProposalEditor, useProposals, useUnsavedChangesGuard
      lib/                   ← Supabase-backed data access (proposals, documents, reviews, auth, clientProposal)
      modules/               ← pure/business logic: variables, ai, pdf, review, versionHistory, activity, status
      context/               ← AuthContext
      masterTemplate/        ← pageComponents.ts (Vite-aliased import of the frozen template)
    api/
      _lib/                  ← server-only helpers, excluded from routing by Vercel's underscore convention
        pdf/, email/, notify/, share/, activity/, auth/
      client/                ← public, unauthenticated (resolve.ts, accept.ts)
      pdf/                   ← generate.ts (staff), resolve.ts (internal, Chromium-only)
      proposals/             ← send.ts (staff)
      generate.ts             ← AI Assistant backend
supabase/migrations/
  add_proposal_*.sql          ← every schema change for this project, in order
```

## 7. Future Maintenance

- **Adding a new document type** (Quotation, Invoice, Contract): write a sibling adapter next to `proposalPdfAdapter.ts`; `engine.ts` needs no changes.
- **Adding a new activity event**: call `logActivity()` (client or server variant) with a new free-text `action` — no migration needed.
- **Extending status gating**: all three status-gating lists (`PDF_VIEWABLE_STATUSES`, `SENDABLE_STATUSES`, `CLIENT_VIEWABLE_STATUSES`) live in one place, `src/modules/status/gates.ts` — update there, not per-component.
- **Auth model**: staff auth is real Supabase Auth (magic link) checked against `team_members`; there is no separate user/role table for this app. If finer-grained roles are ever needed (e.g. "only Admins can archive"), add that check alongside `requireStaffAuth`/`ProtectedRoute`, following the same pattern `index.html`'s `opsIntelAllowed()` uses.
- **The one thing that must never change**: `proposal/components/proposal/` is frozen. Any future design revision to the template itself is a deliberate, rare, explicit event — bump `MASTER_TEMPLATE.version`, never edit in place.
