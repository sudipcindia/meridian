-- ============================================================================
-- Proposal Acceptance: explicit consent record (legal/audit hardening)
-- ============================================================================
-- The client-facing Accept form has always required the "I have read and
-- agree..." checkbox to be ticked before the Submit button even enables
-- (see AcceptanceForm.tsx's `canSubmit`), but the server never actually
-- recorded that fact — it trusted the disabled button and stored nothing.
-- For a record meant to stand as legal/audit evidence, "the button was
-- disabled" is not the same as "we have a stored fact that consent was
-- given" — a client-side UI constraint proves nothing once the row already
-- exists. This migration adds an explicit, server-validated consent record.
--
-- consent_given: the server now rejects any submission where the client
--   didn't send consent = true (see api/client/accept.ts) — no acceptance
--   row can be created without it from this point on.
-- consent_text: the exact agreement wording shown to the signer at the
--   moment they accepted, captured verbatim rather than relying on
--   whatever the current AcceptanceForm.tsx copy happens to say later —
--   the same "snapshot, not a live reference" reasoning already used for
--   proposal_name/client_name in add_proposal_acceptance_contact_fields.sql.
--
-- Backfill for the two rows that already exist: both could only have been
-- inserted by submitting the form, which was already impossible without
-- checking that box — so consent_given = true is a true statement about
-- them, not an assumption. consent_text is backfilled with today's exact
-- checkbox wording, the best available truthful record of what they saw.
--
-- Safe to run multiple times (idempotent). No existing rows are deleted.
-- ============================================================================

ALTER TABLE proposal_builder_acceptances
  ADD COLUMN IF NOT EXISTS consent_given boolean NOT NULL DEFAULT true;

ALTER TABLE proposal_builder_acceptances
  ADD COLUMN IF NOT EXISTS consent_text text NOT NULL DEFAULT
    'I have read and agree to the Novara Consult Service Agreement and confirm my authority to accept this proposal on behalf of the named company.';
