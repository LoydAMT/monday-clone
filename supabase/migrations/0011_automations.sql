-- ============================================================================
-- Automations: "when Status -> X, notify someone" and
-- "when a date passes, change Status -> X".
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  trigger_type text not null check (trigger_type in ('status_changed', 'date_passed')),
  trigger_column_id uuid not null references public.columns (id) on delete cascade,
  -- status_changed: the status label that fires the rule. date_passed: unused (null).
  trigger_value text,
  action_type text not null check (action_type in ('notify', 'change_status')),
  -- change_status: which status column to update.
  action_column_id uuid references public.columns (id) on delete cascade,
  -- change_status: the label to set it to.
  action_value text,
  -- notify: who to notify.
  action_user_id uuid references auth.users (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists automations_board_id_idx on public.automations (board_id);

alter table public.automations enable row level security;

drop policy if exists "automations_select" on public.automations;
create policy "automations_select" on public.automations
  for select using (
    exists (select 1 from public.boards b where b.id = automations.board_id and public.is_workspace_member(b.workspace_id))
  );

drop policy if exists "automations_insert" on public.automations;
create policy "automations_insert" on public.automations
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.boards b where b.id = automations.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "automations_delete" on public.automations;
create policy "automations_delete" on public.automations
  for delete using (
    exists (select 1 from public.boards b where b.id = automations.board_id and public.is_workspace_editor(b.workspace_id))
  );

-- There's no server-side scheduler in this project, so the "date passes"
-- trigger is checked client-side whenever someone has the board open rather
-- than at the exact moment the date passes. This table records which
-- (automation, item) pairs already fired, so re-checking on every board load
-- doesn't re-apply the action and stomp on a status the user changed back
-- afterward — it only ever fires once per item.
create table if not exists public.automation_runs (
  automation_id uuid not null references public.automations (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  ran_at timestamptz not null default now(),
  primary key (automation_id, item_id)
);

alter table public.automation_runs enable row level security;

drop policy if exists "automation_runs_select" on public.automation_runs;
create policy "automation_runs_select" on public.automation_runs
  for select using (
    exists (
      select 1 from public.automations a join public.boards b on b.id = a.board_id
      where a.id = automation_runs.automation_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "automation_runs_insert" on public.automation_runs;
create policy "automation_runs_insert" on public.automation_runs
  for insert with check (
    exists (
      select 1 from public.automations a join public.boards b on b.id = a.board_id
      where a.id = automation_runs.automation_id and public.is_workspace_editor(b.workspace_id)
    )
  );
