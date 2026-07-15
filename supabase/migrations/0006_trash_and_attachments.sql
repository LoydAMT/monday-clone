-- ============================================================================
-- Phase 3: soft-delete (trash) for items + file attachments
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- Trash: soft delete
-- ============================================================================

alter table public.items add column if not exists deleted_at timestamptz;
create index if not exists items_deleted_at_idx on public.items (deleted_at);

-- ============================================================================
-- File attachments
-- ============================================================================

alter table public.columns drop constraint if exists columns_type_check;
alter table public.columns add constraint columns_type_check
  check (type in ('text', 'status', 'people', 'date', 'numeric', 'dropdown', 'checkbox', 'link', 'rating', 'timeline', 'file'));

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  content_type text,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists attachments_item_id_idx on public.attachments (item_id);

alter table public.attachments enable row level security;

-- Same items -> groups -> boards -> workspace chain used for comments/activity_log.
-- Unlike comments, select/delete are NOT author-restricted — attachments are
-- shared item content, like a cell value, so any workspace member can manage
-- them; only insert requires you to be the uploader you claim to be.
drop policy if exists "attachments_select_own" on public.attachments;
create policy "attachments_select_own" on public.attachments
  for select using (
    exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = attachments.item_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "attachments_insert_own" on public.attachments;
create policy "attachments_insert_own" on public.attachments
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = attachments.item_id and public.is_workspace_member(b.workspace_id)
    )
  );

drop policy if exists "attachments_delete_own" on public.attachments;
create policy "attachments_delete_own" on public.attachments
  for delete using (
    exists (
      select 1 from public.items i join public.groups g on g.id = i.group_id join public.boards b on b.id = g.board_id
      where i.id = attachments.item_id and public.is_workspace_member(b.workspace_id)
    )
  );

-- Storage bucket, private (accessed only via RLS-gated signed URLs / SDK calls).
-- Object paths are {workspace_id}/{item_id}/{uuid}-{filename}, so membership
-- can be checked straight from the path's first folder segment.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments_storage_select" on storage.objects;
create policy "attachments_storage_select" on storage.objects
  for select using (
    bucket_id = 'attachments' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "attachments_storage_insert" on storage.objects;
create policy "attachments_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'attachments' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "attachments_storage_delete" on storage.objects;
create policy "attachments_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'attachments' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
