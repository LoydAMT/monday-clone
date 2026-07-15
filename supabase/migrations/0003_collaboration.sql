-- ============================================================================
-- Phase 2: real multi-user collaboration + notifications
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- profiles — mirrors auth.users(id, email) so client code can look users up
-- by email and display who's who without touching the auth schema directly.
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select using (auth.uid() is not null);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts that already existed before this migration.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================================
-- workspace_members — replaces single-owner access with real membership/roles
-- ============================================================================

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')) default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index if not exists workspace_members_user_id_idx on public.workspace_members (user_id);

alter table public.workspace_members enable row level security;

drop policy if exists "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select" on public.workspace_members
  for select using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Insert allows two cases: bootstrapping yourself as owner of a workspace you
-- just created (workspaces.user_id still records the creator), or an existing
-- owner adding someone else.
drop policy if exists "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    (
      user_id = auth.uid() and role = 'owner' and exists (
        select 1 from public.workspaces w
        where w.id = workspace_members.workspace_id and w.user_id = auth.uid()
      )
    )
    or exists (
      select 1 from public.workspace_members owner_check
      where owner_check.workspace_id = workspace_members.workspace_id
        and owner_check.user_id = auth.uid()
        and owner_check.role = 'owner'
    )
  );

-- Delete allows an owner to remove anyone, or anyone to remove themselves.
drop policy if exists "workspace_members_delete" on public.workspace_members;
create policy "workspace_members_delete" on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members owner_check
      where owner_check.workspace_id = workspace_members.workspace_id
        and owner_check.user_id = auth.uid()
        and owner_check.role = 'owner'
    )
  );

-- Backfill: every existing workspace's creator becomes its owner member.
insert into public.workspace_members (workspace_id, user_id, role)
select id, user_id, 'owner' from public.workspaces
on conflict (workspace_id, user_id) do nothing;

-- ============================================================================
-- is_workspace_member — shared RLS helper.
--
-- Every policy below on workspaces/boards/groups/columns/items/comments/
-- activity_log used to bottom out in `w.user_id = auth.uid()`. That single
-- predicate now needs to become a workspace_members lookup in ~28 places, so
-- a helper function replaces the copy-pasted inline exists() this codebase
-- otherwise prefers — security definer so it isn't affected by RLS on
-- workspace_members itself (the standard Supabase pattern for this).
-- ============================================================================

create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- Re-point existing RLS at workspace membership instead of sole ownership
-- ============================================================================

-- workspaces: any member can see it; only the original creator can rename/delete
-- (unchanged — no UI does this yet).
drop policy if exists "workspaces_select_own" on public.workspaces;
create policy "workspaces_select_own" on public.workspaces
  for select using (public.is_workspace_member(id));

-- boards: workspace_id is a direct column, so no join is needed at all now.
drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own" on public.boards
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own" on public.boards
  for insert with check (public.is_workspace_member(workspace_id));

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own" on public.boards
  for update using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own" on public.boards
  for delete using (public.is_workspace_member(workspace_id));

-- groups: one join up to boards for workspace_id.
drop policy if exists "groups_select_own" on public.groups;
create policy "groups_select_own" on public.groups
  for select using (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_member(b.workspace_id))
  );

drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own" on public.groups
  for insert with check (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_member(b.workspace_id))
  );

drop policy if exists "groups_update_own" on public.groups;
create policy "groups_update_own" on public.groups
  for update using (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_member(b.workspace_id))
  ) with check (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_member(b.workspace_id))
  );

drop policy if exists "groups_delete_own" on public.groups;
create policy "groups_delete_own" on public.groups
  for delete using (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_member(b.workspace_id))
  );

-- columns: same shape as groups.
drop policy if exists "columns_select_own" on public.columns;
create policy "columns_select_own" on public.columns
  for select using (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_member(b.workspace_id))
  );

drop policy if exists "columns_insert_own" on public.columns;
create policy "columns_insert_own" on public.columns
  for insert with check (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_member(b.workspace_id))
  );

drop policy if exists "columns_update_own" on public.columns;
create policy "columns_update_own" on public.columns
  for update using (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_member(b.workspace_id))
  ) with check (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_member(b.workspace_id))
  );

drop policy if exists "columns_delete_own" on public.columns;
create policy "columns_delete_own" on public.columns
  for delete using (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_member(b.workspace_id))
  );

-- items: groups -> boards for workspace_id.
drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_member(b.workspace_id)
    )
  ) with check (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_member(b.workspace_id)
    )
  );

-- comments: items -> groups -> boards for workspace_id, plus author-only write.
drop policy if exists "comments_select_own" on public.comments;
create policy "comments_select_own" on public.comments
  for select using (
    exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = comments.item_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = comments.item_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete using (user_id = auth.uid());

-- activity_log: same chain as comments, immutable (select + insert only).
drop policy if exists "activity_log_select_own" on public.activity_log;
create policy "activity_log_select_own" on public.activity_log
  for select using (
    exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = activity_log.item_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "activity_log_insert_own" on public.activity_log;
create policy "activity_log_insert_own" on public.activity_log
  for insert with check (
    actor_id = auth.uid()
    and exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = activity_log.item_id and public.is_workspace_member(b.workspace_id)
    )
  );

-- ============================================================================
-- notifications
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications (user_id);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

-- Insert requires both the inserter and the recipient to be members of the
-- same workspace — you can notify a teammate, not an arbitrary user id.
drop policy if exists "notifications_insert_shared_workspace" on public.notifications;
create policy "notifications_insert_shared_workspace" on public.notifications
  for insert with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = notifications.workspace_id and wm.user_id = notifications.user_id
    )
  );

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = auth.uid());

-- ============================================================================
-- Realtime
-- ============================================================================

alter publication supabase_realtime add table public.workspace_members;
alter publication supabase_realtime add table public.notifications;
