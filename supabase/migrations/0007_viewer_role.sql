-- ============================================================================
-- Viewer role: can see everything, can comment/upload files, cannot create,
-- edit, or delete boards/groups/columns/items.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add constraint workspace_members_role_check
  check (role in ('owner', 'member', 'viewer'));

-- Same shape/rationale as is_workspace_member() from 0003 (security definer so
-- it isn't affected by workspace_members' own RLS), but additionally requires
-- an editing role.
create or replace function public.is_workspace_editor(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid() and wm.role in ('owner', 'member')
  );
$$;

-- ============================================================================
-- boards/groups/columns/items: insert/update/delete require editor status.
-- select policies are untouched — viewers must still see everything.
-- ============================================================================

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own" on public.boards
  for insert with check (public.is_workspace_editor(workspace_id));

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own" on public.boards
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));

drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own" on public.boards
  for delete using (public.is_workspace_editor(workspace_id));

drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own" on public.groups
  for insert with check (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "groups_update_own" on public.groups;
create policy "groups_update_own" on public.groups
  for update using (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_editor(b.workspace_id))
  ) with check (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "groups_delete_own" on public.groups;
create policy "groups_delete_own" on public.groups
  for delete using (
    exists (select 1 from public.boards b where b.id = groups.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "columns_insert_own" on public.columns;
create policy "columns_insert_own" on public.columns
  for insert with check (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "columns_update_own" on public.columns;
create policy "columns_update_own" on public.columns
  for update using (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_editor(b.workspace_id))
  ) with check (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "columns_delete_own" on public.columns;
create policy "columns_delete_own" on public.columns
  for delete using (
    exists (select 1 from public.boards b where b.id = columns.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_editor(b.workspace_id)
    )
  );

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_editor(b.workspace_id)
    )
  ) with check (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_editor(b.workspace_id)
    )
  );

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (
    exists (
      select 1 from public.groups g join public.boards b on b.id = g.board_id
      where g.id = items.group_id and public.is_workspace_editor(b.workspace_id)
    )
  );

-- ============================================================================
-- attachments: insert/select stay membership-gated (viewers can upload/view).
-- delete tightens from "any member" to "uploader, or an editor" so a viewer
-- can remove their own upload but not someone else's.
-- ============================================================================

drop policy if exists "attachments_delete_own" on public.attachments;
create policy "attachments_delete_own" on public.attachments
  for delete using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = attachments.item_id and public.is_workspace_editor(b.workspace_id)
    )
  );
