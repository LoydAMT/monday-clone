-- ============================================================================
-- Inventory management module — a standalone system (not the board/column/item
-- grid): products, per-location stock, stock-adjustment history, and photos.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- inventory_locations
-- ============================================================================

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitive so the "type to create" combobox can't produce
-- near-duplicate location names (e.g. "Warehouse A" vs "warehouse a").
create unique index if not exists inventory_locations_workspace_name_idx
  on public.inventory_locations (workspace_id, lower(name));

-- ============================================================================
-- inventory_items — the products/goods being tracked
-- ============================================================================

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  sku text,
  category text,
  description text,
  unit_cost numeric(12, 2),
  reorder_point integer not null default 0 check (reorder_point >= 0),
  -- set null (not cascade, unlike attachments.uploaded_by) — inventory
  -- records are business data that should outlive the account that created them.
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_workspace_id_idx on public.inventory_items (workspace_id);

drop trigger if exists set_updated_at on public.inventory_items;
create trigger set_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- inventory_stock — quantity of an item at a given location
-- ============================================================================

create table if not exists public.inventory_stock (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  -- restrict, not cascade — a location with live stock shouldn't silently
  -- disappear (v1's UI has no location-delete control; this is defense in
  -- depth for a future admin action or direct SQL edit).
  location_id uuid not null references public.inventory_locations (id) on delete restrict,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_id, location_id)
);

create index if not exists inventory_stock_item_id_idx on public.inventory_stock (item_id);
create index if not exists inventory_stock_location_id_idx on public.inventory_stock (location_id);

drop trigger if exists set_updated_at on public.inventory_stock;
create trigger set_updated_at before update on public.inventory_stock
  for each row execute function public.set_updated_at();

-- ============================================================================
-- inventory_stock_movements — immutable audit trail of quantity changes
-- ============================================================================

create table if not exists public.inventory_stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  location_id uuid references public.inventory_locations (id) on delete set null,
  -- Denormalized snapshot (written by lib/inventory-mutations.ts, not a
  -- trigger) so history stays legible even after location_id is nulled out.
  location_name text not null,
  change integer not null check (change <> 0),
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_stock_movements_item_id_idx on public.inventory_stock_movements (item_id);

-- ============================================================================
-- inventory_photos — mirrors public.attachments, FK'd to inventory_items
-- ============================================================================

create table if not exists public.inventory_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  content_type text,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists inventory_photos_item_id_idx on public.inventory_photos (item_id);

-- ============================================================================
-- RLS helper — resolves an inventory_items row to its workspace, mirroring
-- item_workspace_id() from 0014_linked_records.sql, so every child table's
-- policies read the same way as the rest of this codebase's RLS.
-- ============================================================================

create or replace function public.inventory_item_workspace_id(p_item_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.inventory_items where id = p_item_id;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.inventory_locations enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_stock enable row level security;
alter table public.inventory_stock_movements enable row level security;
alter table public.inventory_photos enable row level security;

-- inventory_locations: editor-gated writes, member-gated reads (same tier as
-- boards/groups/columns/items).
drop policy if exists "inventory_locations_select" on public.inventory_locations;
create policy "inventory_locations_select" on public.inventory_locations
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "inventory_locations_insert" on public.inventory_locations;
create policy "inventory_locations_insert" on public.inventory_locations
  for insert with check (public.is_workspace_editor(workspace_id));

drop policy if exists "inventory_locations_update" on public.inventory_locations;
create policy "inventory_locations_update" on public.inventory_locations
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));

drop policy if exists "inventory_locations_delete" on public.inventory_locations;
create policy "inventory_locations_delete" on public.inventory_locations
  for delete using (public.is_workspace_editor(workspace_id));

-- inventory_items
drop policy if exists "inventory_items_select" on public.inventory_items;
create policy "inventory_items_select" on public.inventory_items
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "inventory_items_insert" on public.inventory_items;
create policy "inventory_items_insert" on public.inventory_items
  for insert with check (public.is_workspace_editor(workspace_id));

drop policy if exists "inventory_items_update" on public.inventory_items;
create policy "inventory_items_update" on public.inventory_items
  for update using (public.is_workspace_editor(workspace_id)) with check (public.is_workspace_editor(workspace_id));

drop policy if exists "inventory_items_delete" on public.inventory_items;
create policy "inventory_items_delete" on public.inventory_items
  for delete using (public.is_workspace_editor(workspace_id));

-- inventory_stock: insert/update also confirms the location belongs to the
-- same workspace as the item — same reasoning as linked_items_insert's
-- source/target workspace equality check in 0014_linked_records.sql.
drop policy if exists "inventory_stock_select" on public.inventory_stock;
create policy "inventory_stock_select" on public.inventory_stock
  for select using (public.is_workspace_member(public.inventory_item_workspace_id(item_id)));

drop policy if exists "inventory_stock_insert" on public.inventory_stock;
create policy "inventory_stock_insert" on public.inventory_stock
  for insert with check (
    public.is_workspace_editor(public.inventory_item_workspace_id(item_id))
    and public.inventory_item_workspace_id(item_id) = (
      select workspace_id from public.inventory_locations where id = location_id
    )
  );

drop policy if exists "inventory_stock_update" on public.inventory_stock;
create policy "inventory_stock_update" on public.inventory_stock
  for update using (
    public.is_workspace_editor(public.inventory_item_workspace_id(item_id))
  ) with check (
    public.is_workspace_editor(public.inventory_item_workspace_id(item_id))
    and public.inventory_item_workspace_id(item_id) = (
      select workspace_id from public.inventory_locations where id = location_id
    )
  );

drop policy if exists "inventory_stock_delete" on public.inventory_stock;
create policy "inventory_stock_delete" on public.inventory_stock
  for delete using (public.is_workspace_editor(public.inventory_item_workspace_id(item_id)));

-- inventory_stock_movements: immutable — select + insert only, no update/delete.
drop policy if exists "inventory_stock_movements_select" on public.inventory_stock_movements;
create policy "inventory_stock_movements_select" on public.inventory_stock_movements
  for select using (public.is_workspace_member(public.inventory_item_workspace_id(item_id)));

drop policy if exists "inventory_stock_movements_insert" on public.inventory_stock_movements;
create policy "inventory_stock_movements_insert" on public.inventory_stock_movements
  for insert with check (
    created_by = auth.uid()
    and public.is_workspace_editor(public.inventory_item_workspace_id(item_id))
  );

-- inventory_photos: membership-gated select/insert (viewers can upload/view,
-- matching attachments); delete requires uploader or editor.
drop policy if exists "inventory_photos_select" on public.inventory_photos;
create policy "inventory_photos_select" on public.inventory_photos
  for select using (public.is_workspace_member(public.inventory_item_workspace_id(item_id)));

drop policy if exists "inventory_photos_insert" on public.inventory_photos;
create policy "inventory_photos_insert" on public.inventory_photos
  for insert with check (
    uploaded_by = auth.uid()
    and public.is_workspace_member(public.inventory_item_workspace_id(item_id))
  );

drop policy if exists "inventory_photos_delete" on public.inventory_photos;
create policy "inventory_photos_delete" on public.inventory_photos
  for delete using (
    uploaded_by = auth.uid()
    or public.is_workspace_editor(public.inventory_item_workspace_id(item_id))
  );

-- ============================================================================
-- Storage bucket for inventory photos, private (accessed only via RLS-gated
-- signed URLs / SDK calls). Object paths are
-- {workspace_id}/{item_id}/{uuid}-{filename}, same convention as the
-- `attachments` bucket in 0006_trash_and_attachments.sql.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('inventory-photos', 'inventory-photos', false)
on conflict (id) do nothing;

drop policy if exists "inventory_photos_storage_select" on storage.objects;
create policy "inventory_photos_storage_select" on storage.objects
  for select using (
    bucket_id = 'inventory-photos' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "inventory_photos_storage_insert" on storage.objects;
create policy "inventory_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'inventory-photos' and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

-- Deliberately stricter than the `attachments` bucket's storage-level delete
-- policy (which only ever checks membership — 0007_viewer_role.sql tightened
-- the table row, not the storage object). `owner` is populated automatically
-- by Supabase Storage on upload.
drop policy if exists "inventory_photos_storage_delete" on storage.objects;
create policy "inventory_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'inventory-photos'
    and (
      owner = auth.uid()
      or public.is_workspace_editor((storage.foldername(name))[1]::uuid)
    )
  );
