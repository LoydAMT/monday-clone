-- ============================================================================
-- Fix: 42P17 "infinite recursion detected in policy for relation
-- workspace_members". 0003_collaboration.sql gave every OTHER table's RLS a
-- security-definer helper (is_workspace_member) specifically so checking
-- membership wouldn't re-trigger workspace_members' own RLS recursively —
-- but workspace_members' own select/insert/delete policies were written as
-- raw self-referencing exists() subqueries against workspace_members itself,
-- which Postgres correctly refuses to plan as a cycle. Same fix, applied to
-- the one table that was missed.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create or replace function public.workspace_member_role(ws_id uuid, uid uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.workspace_members where workspace_id = ws_id and user_id = uid limit 1;
$$;

drop policy if exists "workspace_members_select" on public.workspace_members;
create policy "workspace_members_select" on public.workspace_members
  for select using (
    public.workspace_member_role(workspace_id, auth.uid()) is not null
  );

-- Insert allows two cases: bootstrapping yourself as owner of a workspace you
-- just created (workspaces.user_id still records the creator — no self-
-- reference, so this half is untouched), or an existing owner adding someone
-- else (now checked via the function instead of a raw self-join).
drop policy if exists "workspace_members_insert" on public.workspace_members;
create policy "workspace_members_insert" on public.workspace_members
  for insert with check (
    (
      user_id = auth.uid() and role = 'owner' and exists (
        select 1 from public.workspaces w
        where w.id = workspace_members.workspace_id and w.user_id = auth.uid()
      )
    )
    or public.workspace_member_role(workspace_id, auth.uid()) = 'owner'
  );

drop policy if exists "workspace_members_delete" on public.workspace_members;
create policy "workspace_members_delete" on public.workspace_members
  for delete using (
    user_id = auth.uid()
    or public.workspace_member_role(workspace_id, auth.uid()) = 'owner'
  );
