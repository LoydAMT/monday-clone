-- ============================================================================
-- Fix: lib/seed.ts used a "count workspaces, then insert if zero" check with
-- no locking. Next.js can invoke the dashboard layout more than once around
-- the same time (route prefetch, fast refresh, concurrent navigations),
-- so two requests could both read count=0 before either insert committed —
-- producing duplicate "My Workspace" / "Product Launch" seeds. This table
-- turns that check into a single atomic insert: whoever's insert succeeds
-- first owns the seed; everyone else's insert conflicts and they skip.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create table if not exists public.user_seed_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  seeded_at timestamptz not null default now()
);

alter table public.user_seed_state enable row level security;

drop policy if exists "user_seed_state_own" on public.user_seed_state;
create policy "user_seed_state_own" on public.user_seed_state
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Mark every user who already has at least one workspace as "seeded" so this
-- migration doesn't itself trigger a fresh seed for existing accounts.
insert into public.user_seed_state (user_id)
select distinct user_id from public.workspaces
on conflict (user_id) do nothing;
