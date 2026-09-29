-- Fix (2026-09 ticket ID collision bug): genTicketId() (client-side, index.html)
-- computed the "next" ticket number from the highest NVR-#### id currently
-- loaded into the browser's local `tickets` array -- which excludes
-- soft-deleted rows -- then did a single SELECT existence-check against the
-- DB and, on collision, bumped by exactly one more WITHOUT re-verifying that
-- second candidate either. When several consecutive ids at the top of the
-- range were soft-deleted (routine QA cleanup, or an ordinary "create then
-- immediately delete" workflow), the next real ticket created anywhere in
-- the app could land on one of those already-existing ids. saveTicketToDB()
-- upserts on conflict(id), so the collision silently overwrote the old row's
-- title/client/etc. instead of erroring -- and since the insert payload
-- never sets is_deleted for a brand-new ticket, the row kept its previous
-- is_deleted=true, so the "new" ticket vanished from every list on next
-- reload while its data lived on, hidden, under someone else's old id.
--
-- Fixed at the root by moving ID generation off the client entirely and
-- onto a dedicated Postgres sequence. A sequence's nextval() is atomic and
-- monotonic by construction -- Postgres guarantees two concurrent callers
-- can never receive the same value, and once a value is handed out it is
-- never handed out again, regardless of what later happens to the row it
-- was used for (soft-deleted, archived, or even hard-deleted -- the
-- sequence never looks at the tickets table again after being seeded here).
--
-- Seeded to one past the highest NVR-#### number found anywhere across the
-- tickets table (78 rows, active + soft-deleted) and every other table that
-- stores a ticket id by reference (notifications, ticket_standup_updates,
-- clients.telegram_active_ticket_id, telegram_sessions.selected_ticket_id).
-- tickets itself held the highest number at 1270, so the sequence starts at
-- 1271 -- no existing ticket id collides with anything the sequence will
-- ever produce. This migration only adds a new sequence and a new function;
-- it does not read, modify, or delete a single existing row.
create sequence if not exists public.ticket_id_seq
  as bigint
  increment by 1
  minvalue 1
  start with 1271;

-- SECURITY DEFINER so every ticket-creation call site (Quick Task, the
-- legacy "New Ticket" modal, client onboarding, and every Performance Plan /
-- recurring-workflow ticket creator -- all six currently route through the
-- client's single genTicketId() helper) only needs EXECUTE on this one
-- function, never USAGE on the sequence directly.
create or replace function public.next_ticket_id()
returns text
language sql
security definer
set search_path = public
as $$
  select 'NVR-' || nextval('public.ticket_id_seq')::text;
$$;

revoke all on function public.next_ticket_id() from public;
grant execute on function public.next_ticket_id() to authenticated;
