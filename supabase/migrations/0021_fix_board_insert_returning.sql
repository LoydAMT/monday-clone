-- ============================================================================
-- Fix: owners could not create boards through the app after 0020.
--
-- boards_select_own called can_access_board(id), which resolves the board by
-- re-reading public.boards. The function is STABLE, so it sees the snapshot
-- from the start of the statement — and during `insert ... returning` the row
-- being inserted is not in that snapshot. RETURNING applies the SELECT policy,
-- so the lookup found nothing, can_access_board returned false, and the insert
-- was rejected with "new row violates row-level security policy".
--
-- A plain `insert` (no RETURNING) succeeded, which is what made this easy to
-- miss — but lib/mutations.ts creates boards with .insert().select(), i.e.
-- exactly the RETURNING form.
--
-- The fix takes the workspace from the row under test instead of looking the
-- board up, so nothing depends on the new row being visible yet. Child tables
-- are unaffected: they resolve a *parent* board that already existed before
-- the statement, so the snapshot always contains it.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- Same rules as can_access_board, but for a caller that already holds the
-- board's workspace_id — i.e. a policy on public.boards itself.
create or replace function public.can_access_board_in(p_board_id uuid, p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select case
      when wm.role = 'owner' then true
      when not ('boards' = any (wm.features)) then false
      when wm.board_access = 'all' then true
      else exists (
        select 1 from public.board_members bm
        where bm.board_id = p_board_id and bm.user_id = wm.user_id
      )
    end
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
  ), false);
$$;

create or replace function public.can_edit_board_in(p_board_id uuid, p_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_access_board_in(p_board_id, p_workspace_id)
     and public.is_workspace_editor(p_workspace_id);
$$;

-- Re-point boards' own policies at the self-contained variants. can_access_board
-- / can_edit_board stay as they are and remain correct for every child table.
drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own" on public.boards
  for select using (public.can_access_board_in(id, workspace_id));

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own" on public.boards
  for update using (public.can_edit_board_in(id, workspace_id))
  with check (public.can_edit_board_in(id, workspace_id));
