-- ============================================================================
-- Guest/public share links: a token-based read-only link for viewing a
-- board without an account. Run this in the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.board_share_links (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists board_share_links_board_id_idx on public.board_share_links (board_id);

alter table public.board_share_links enable row level security;

-- No public/anon select policy: guests never query this table directly — the
-- /share/[token] route reads it server-side with the service-role key
-- (bypassing RLS entirely), and the unguessable token itself is the
-- authorization check, not a workspace_members row. Only editors manage
-- their own board's links, using the same is_workspace_editor() helper
-- 0007_viewer_role.sql already added.

drop policy if exists "board_share_links_select" on public.board_share_links;
create policy "board_share_links_select" on public.board_share_links
  for select using (
    exists (select 1 from public.boards b where b.id = board_share_links.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "board_share_links_insert" on public.board_share_links;
create policy "board_share_links_insert" on public.board_share_links
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.boards b where b.id = board_share_links.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "board_share_links_update" on public.board_share_links;
create policy "board_share_links_update" on public.board_share_links
  for update using (
    exists (select 1 from public.boards b where b.id = board_share_links.board_id and public.is_workspace_editor(b.workspace_id))
  ) with check (
    exists (select 1 from public.boards b where b.id = board_share_links.board_id and public.is_workspace_editor(b.workspace_id))
  );

drop policy if exists "board_share_links_delete" on public.board_share_links;
create policy "board_share_links_delete" on public.board_share_links
  for delete using (
    exists (select 1 from public.boards b where b.id = board_share_links.board_id and public.is_workspace_editor(b.workspace_id))
  );
