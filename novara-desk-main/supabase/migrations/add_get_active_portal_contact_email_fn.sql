-- Fix (found during 2026-09-15 technical QA): client_portal_users has RLS
-- enabled with ZERO policies (confirmed via the Supabase security advisor),
-- so the staff-app's direct `supabase.from('client_portal_users').select(...)`
-- call in pushClientPortalNotification() (index.html) has always returned
-- nothing for every authenticated staff session — meaning the client's
-- portal bell/email notification on a client-visible ticket comment has been
-- silently broken since that feature was built.
--
-- Not fixed by adding an RLS policy on the base table: RLS is row-level, not
-- column-level, so any policy broad enough to let staff look up an email by
-- client_id would also make password_hash and setup_token selectable by any
-- authenticated (staff) browser session — exactly what "no password/hash/
-- token leakage" forbids, even though the caller is trusted staff.
--
-- Fixed with a SECURITY DEFINER function instead — the same pattern this
-- database already uses elsewhere (see outreach_take_pipeline_snapshot()).
-- It runs with the function owner's privileges (bypassing RLS) but can only
-- ever return the one email string it selects — there is no way to widen
-- the query to reach password_hash/setup_token through this function.
create or replace function public.get_active_portal_contact_email(p_client_id text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.client_portal_users
  where client_id = p_client_id and status = 'active'
  limit 1;
$$;

revoke all on function public.get_active_portal_contact_email(text) from public;
grant execute on function public.get_active_portal_contact_email(text) to authenticated;
