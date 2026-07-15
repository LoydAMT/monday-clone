-- ============================================================================
-- Phase 1: item details, subitems, richer columns — schema additions
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- Column types
-- ============================================================================

alter table public.columns drop constraint if exists columns_type_check;
alter table public.columns add constraint columns_type_check
  check (type in ('text', 'status', 'people', 'date', 'numeric', 'dropdown', 'checkbox', 'link', 'rating', 'timeline'));

-- ============================================================================
-- Subitems
-- ============================================================================

alter table public.items add column if not exists parent_item_id uuid references public.items (id) on delete cascade;
create index if not exists items_parent_item_id_idx on public.items (parent_item_id);

-- ============================================================================
-- Comments + activity log
-- ============================================================================

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists comments_item_id_idx on public.comments (item_id);
create index if not exists activity_log_item_id_idx on public.activity_log (item_id);

drop trigger if exists set_updated_at on public.comments;
create trigger set_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.comments enable row level security;
alter table public.activity_log enable row level security;

-- comments: ownership cascades through items -> groups -> boards -> workspaces,
-- plus the comment must belong to the requesting user
drop policy if exists "comments_select_own" on public.comments;
create policy "comments_select_own" on public.comments
  for select using (
    exists (
      select 1 from public.items i
      join public.groups g on g.id = i.group_id
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where i.id = comments.item_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.items i
      join public.groups g on g.id = i.group_id
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where i.id = comments.item_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update using (
    user_id = auth.uid()
    and exists (
      select 1 from public.items i
      join public.groups g on g.id = i.group_id
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where i.id = comments.item_id and w.user_id = auth.uid()
    )
  ) with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.items i
      join public.groups g on g.id = i.group_id
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where i.id = comments.item_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete using (
    user_id = auth.uid()
    and exists (
      select 1 from public.items i
      join public.groups g on g.id = i.group_id
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where i.id = comments.item_id and w.user_id = auth.uid()
    )
  );

-- activity_log: same ownership chain, immutable (select + insert only)
drop policy if exists "activity_log_select_own" on public.activity_log;
create policy "activity_log_select_own" on public.activity_log
  for select using (
    exists (
      select 1 from public.items i
      join public.groups g on g.id = i.group_id
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where i.id = activity_log.item_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "activity_log_insert_own" on public.activity_log;
create policy "activity_log_insert_own" on public.activity_log
  for insert with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.items i
      join public.groups g on g.id = i.group_id
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where i.id = activity_log.item_id and w.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Realtime
-- ============================================================================

alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.activity_log;
