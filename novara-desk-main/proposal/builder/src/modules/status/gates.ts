import type { ProposalStatus } from '../../types/proposal.js'

/**
 * Single source of truth for the status-gating lists that used to be
 * hand-copied across client and server (Phase 09 hardening pass — each
 * copy was previously kept in sync manually via a "Mirrors X" comment,
 * a real drift risk). Importable from both `src/` and `api/` — plain
 * string-array constants, no Node/browser-specific APIs, matching the
 * existing cross-boundary import pattern already used by
 * `api/_lib/pdf/proposalPdfAdapter.ts` importing `src/modules/pdf`.
 *
 * These are UX-layer conveniences only (disabling a button, skipping a
 * fetch) — the real security boundary is each server endpoint re-checking
 * the same list itself, which every consumer below still does.
 */

/** Only these lifecycle statuses may produce or view a PDF. */
export const PDF_VIEWABLE_STATUSES: ProposalStatus[] = ['approved', 'ready_for_pdf', 'ready', 'sent', 'signed']

/** Only a proposal that has cleared the Phase 05 approval gate may be sent to a client. */
export const SENDABLE_STATUSES: ProposalStatus[] = ['approved', 'ready_for_pdf', 'ready']

/**
 * A proposal's client link is viewable as soon as it's Approved — not only
 * after an email send flips it to "sent". This lets staff copy/open the
 * link (or share it manually via WhatsApp/Slack/Teams/SMS) before, instead
 * of, or after actually emailing it. Same set as PDF_VIEWABLE_STATUSES:
 * both represent "this proposal is finished enough to show externally".
 */
export const CLIENT_VIEWABLE_STATUSES: ProposalStatus[] = PDF_VIEWABLE_STATUSES
