-- ============================================================================
-- Let an owner reassign another member's role, and restrict board deletion
-- to owners only (any editor can still create/edit boards).
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- workspace_members: an owner can change anyone else's role, but not their
-- own (prevents a lone owner from accidentally demoting themselves and
-- locking the workspace out of having an owner).
drop policy if exists "workspace_members_update" on public.workspace_members;
create policy "workspace_members_update" on public.workspace_members
  for update using (
    user_id != auth.uid() and public.workspace_member_role(workspace_id, auth.uid()) = 'owner'
  ) with check (
    user_id != auth.uid() and public.workspace_member_role(workspace_id, auth.uid()) = 'owner'
  );

-- boards: deleting a board now requires the 'owner' role specifically —
-- a plain 'member' can still create/rename/duplicate boards (unchanged),
-- just not delete them.
drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own" on public.boards
  for delete using (public.workspace_member_role(workspace_id, auth.uid()) = 'owner');
