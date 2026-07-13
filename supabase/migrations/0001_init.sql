-- ============================================================================
-- Monday.com Clone — Initial Schema Migration
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text default '',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  color text not null default '#579bfc',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null,
  type text not null check (type in ('text', 'status', 'people', 'date', 'numeric')),
  options jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null default 'New Item',
  cells jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists boards_workspace_id_idx on public.boards (workspace_id);
create index if not exists groups_board_id_idx on public.groups (board_id);
create index if not exists columns_board_id_idx on public.columns (board_id);
create index if not exists items_group_id_idx on public.items (group_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.workspaces;
create trigger set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.boards;
create trigger set_updated_at before update on public.boards
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.groups;
create trigger set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.columns;
create trigger set_updated_at before update on public.columns
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.items;
create trigger set_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.workspaces enable row level security;
alter table public.boards enable row level security;
alter table public.groups enable row level security;
alter table public.columns enable row level security;
alter table public.items enable row level security;

-- workspaces: user owns directly via user_id
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own" on public.workspaces
  for select using (auth.uid() = user_id);

drop policy if exists "workspaces_insert_own" on public.workspaces;
create policy "workspaces_insert_own" on public.workspaces
  for insert with check (auth.uid() = user_id);

drop policy if exists "workspaces_update_own" on public.workspaces;
create policy "workspaces_update_own" on public.workspaces
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workspaces_delete_own" on public.workspaces;
create policy "workspaces_delete_own" on public.workspaces
  for delete using (auth.uid() = user_id);

-- boards: ownership cascades through workspaces.user_id
drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own" on public.boards
  for select using (
    exists (select 1 from public.workspaces w where w.id = boards.workspace_id and w.user_id = auth.uid())
  );

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own" on public.boards
  for insert with check (
    exists (select 1 from public.workspaces w where w.id = boards.workspace_id and w.user_id = auth.uid())
  );

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own" on public.boards
  for update using (
    exists (select 1 from public.workspaces w where w.id = boards.workspace_id and w.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.workspaces w where w.id = boards.workspace_id and w.user_id = auth.uid())
  );

drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own" on public.boards
  for delete using (
    exists (select 1 from public.workspaces w where w.id = boards.workspace_id and w.user_id = auth.uid())
  );

-- groups: ownership cascades through boards -> workspaces
drop policy if exists "groups_select_own" on public.groups;
create policy "groups_select_own" on public.groups
  for select using (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = groups.board_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own" on public.groups
  for insert with check (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = groups.board_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "groups_update_own" on public.groups;
create policy "groups_update_own" on public.groups
  for update using (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = groups.board_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = groups.board_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "groups_delete_own" on public.groups;
create policy "groups_delete_own" on public.groups
  for delete using (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = groups.board_id and w.user_id = auth.uid()
    )
  );

-- columns: ownership cascades through boards -> workspaces
drop policy if exists "columns_select_own" on public.columns;
create policy "columns_select_own" on public.columns
  for select using (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = columns.board_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "columns_insert_own" on public.columns;
create policy "columns_insert_own" on public.columns
  for insert with check (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = columns.board_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "columns_update_own" on public.columns;
create policy "columns_update_own" on public.columns
  for update using (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = columns.board_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = columns.board_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "columns_delete_own" on public.columns;
create policy "columns_delete_own" on public.columns
  for delete using (
    exists (
      select 1 from public.boards b
      join public.workspaces w on w.id = b.workspace_id
      where b.id = columns.board_id and w.user_id = auth.uid()
    )
  );

-- items: ownership cascades through groups -> boards -> workspaces
drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using (
    exists (
      select 1 from public.groups g
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where g.id = items.group_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (
    exists (
      select 1 from public.groups g
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where g.id = items.group_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (
    exists (
      select 1 from public.groups g
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where g.id = items.group_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.groups g
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where g.id = items.group_id and w.user_id = auth.uid()
    )
  );

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (
    exists (
      select 1 from public.groups g
      join public.boards b on b.id = g.board_id
      join public.workspaces w on w.id = b.workspace_id
      where g.id = items.group_id and w.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Realtime
-- ============================================================================

alter publication supabase_realtime add table public.boards;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.columns;
alter publication supabase_realtime add table public.items;
