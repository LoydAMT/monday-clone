-- ============================================================================
-- "Linked record" columns — let an item on one board reference item(s) on
-- another board in the same workspace (e.g. a Deal linking to a Company),
-- with a reverse "linked from" lookup available from either side. Run this
-- in the Supabase SQL Editor (Project > SQL Editor > New query).
-- ============================================================================

alter table public.columns drop constraint if exists columns_type_check;
alter table public.columns add constraint columns_type_check
  check (type in ('text', 'status', 'people', 'date', 'numeric', 'dropdown', 'checkbox', 'link', 'rating', 'timeline', 'file', 'progress', 'linked_record'));

create table if not exists public.linked_items (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.columns (id) on delete cascade,
  source_item_id uuid not null references public.items (id) on delete cascade,
  target_item_id uuid not null references public.items (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (column_id, source_item_id, target_item_id)
);

create index if not exists linked_items_source_item_id_idx on public.linked_items (source_item_id);
create index if not exists linked_items_target_item_id_idx on public.linked_items (target_item_id);
create index if not exists linked_items_column_id_idx on public.linked_items (column_id);

alter table public.linked_items enable row level security;

-- Reusable helper (same idiom as is_workspace_member/is_workspace_editor in
-- 0003_collaboration.sql / 0007_viewer_role.sql) — resolves an item to its
-- workspace so RLS can compare *both* sides of a link against each other,
-- not just check each side independently. Two independent checks ("editor on
-- source" + "member on target") would NOT stop a cross-workspace link for a
-- user who happens to belong to both workspaces — this closes that gap.
create or replace function public.item_workspace_id(p_item_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select b.workspace_id
  from public.items i
  join public.groups g on g.id = i.group_id
  join public.boards b on b.id = g.board_id
  where i.id = p_item_id;
$$;

-- Insert/delete only (no update — a link is either created or removed, same
-- as attachments). Not added to the supabase_realtime publication, matching
-- attachments (the closest existing precedent): nothing in this app does
-- live cross-client cell sync today.

drop policy if exists "linked_items_select" on public.linked_items;
create policy "linked_items_select" on public.linked_items
  for select using (
    public.is_workspace_member(public.item_workspace_id(linked_items.source_item_id))
  );

drop policy if exists "linked_items_insert" on public.linked_items;
create policy "linked_items_insert" on public.linked_items
  for insert with check (
    public.item_workspace_id(linked_items.source_item_id) = public.item_workspace_id(linked_items.target_item_id)
    and public.is_workspace_editor(public.item_workspace_id(linked_items.source_item_id))
  );

drop policy if exists "linked_items_delete" on public.linked_items;
create policy "linked_items_delete" on public.linked_items
  for delete using (
    public.is_workspace_editor(public.item_workspace_id(linked_items.source_item_id))
  );
