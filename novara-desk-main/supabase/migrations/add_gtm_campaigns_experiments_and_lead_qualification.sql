-- GTM/Sales workflow extension: Campaigns + Experiments are genuinely new
-- concepts (confirmed absent anywhere in the schema/codebase before this
-- migration — see docs/development-log.md Phase 23 note). Everything else
-- in the requested GTM workflow (Lead/Opportunity/Pipeline/Won-Lost, ICP,
-- Recurring Workflows/rework loop, tickets, notifications) already exists
-- and is reused as-is; only these two tables plus a handful of qualification
-- columns on the existing outreach_opportunities table are added.

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id text references public.clients(id) on delete set null,
  name text not null,
  channel text not null default 'email' check (channel in ('email','linkedin','both','other')),
  owner_id text references public.team_members(id) on delete set null,
  status text not null default 'planning' check (status in ('planning','active','paused','completed')),
  priority text not null default 'normal' check (priority in ('normal','high','highest')),
  next_action text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.outreach_campaigns is 'GTM/Sales outbound campaigns (email/LinkedIn), optionally linked to a client (client_id) whose GTM service Novara is running. New in the GTM workflow extension — no prior campaign entity existed.';

create table if not exists public.outreach_experiments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.outreach_campaigns(id) on delete cascade,
  client_id text references public.clients(id) on delete set null,
  channel text not null default 'email' check (channel in ('email','linkedin')),
  hypothesis text not null,
  audience text,
  variant text,
  metric text,
  result text,
  decision text check (decision in ('scale','iterate','kill') or decision is null),
  status text not null default 'running' check (status in ('running','complete')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.outreach_experiments is 'Controlled Email/LinkedIn A/B experiments for the GTM workflow — hypothesis, audience, variant, metric, real result, and an explicit human decision. No automated/fake analytics.';

alter table public.outreach_opportunities
  add column if not exists campaign_id uuid references public.outreach_campaigns(id) on delete set null,
  add column if not exists icp_fit text check (icp_fit in ('strong','moderate','weak') or icp_fit is null),
  add column if not exists engagement_channel text check (engagement_channel in ('email','linkedin','both','other') or engagement_channel is null),
  add column if not exists is_qualified boolean not null default false,
  add column if not exists qualification_notes text,
  add column if not exists enrichment_status text not null default 'pending' check (enrichment_status in ('pending','enriched','stale'));

alter table public.outreach_campaigns enable row level security;
alter table public.outreach_experiments enable row level security;
create policy "auth_rw_outreach_campaigns" on public.outreach_campaigns for all to authenticated using (true) with check (true);
create policy "auth_rw_outreach_experiments" on public.outreach_experiments for all to authenticated using (true) with check (true);

create index if not exists idx_outreach_campaigns_client on public.outreach_campaigns(client_id);
create index if not exists idx_outreach_experiments_campaign on public.outreach_experiments(campaign_id);
create index if not exists idx_outreach_opportunities_campaign on public.outreach_opportunities(campaign_id);
