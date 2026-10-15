-- ============================================================================
-- Sales file attachments — contracts, drawings, RFQ documents, quotation PDFs,
-- purchase orders and the like, kept against a customer and optionally against
-- one of its deals.
--
-- Shaped like sales_activities: company_id is required and deal_id optional, so
-- the company profile can list everything on file for a customer (including
-- files attached to its deals) while a deal's own modal lists just that deal's.
--
-- Files live in a private `sales-files` bucket at
--   {workspace_id}/{company_id}/{uuid}-{filename}
-- so the storage policies can resolve the workspace from the first folder
-- segment, as the inventory-photos bucket does.
--
-- Access follows the rest of the sales module (0020): anyone with the sales
-- feature can read, editors write. There is no update policy — a file is
-- replaced by deleting it and uploading another.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create table if not exists public.sales_attachments (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized from sales_companies so RLS and the storage policies read
  -- like every other sales table; the insert policy enforces that it matches
  -- the company's own workspace.
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.sales_companies (id) on delete cascade,
  deal_id uuid references public.sales_deals (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size >= 0),
  content_type text,
  -- set null (not cascade): a file outlives the account that uploaded it,
  -- same reasoning as the created_by columns in 0019_sales.sql.
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sales_attachments_company_id_idx
  on public.sales_attachments (company_id, created_at desc);
create index if not exists sales_attachments_deal_id_idx on public.sales_attachments (deal_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.sales_attachments enable row level security;

drop policy if exists "sales_attachments_select" on public.sales_attachments;
create policy "sales_attachments_select" on public.sales_attachments
  for select using (public.can_view_module(workspace_id, 'sales'));

drop policy if exists "sales_attachments_insert" on public.sales_attachments;
create policy "sales_attachments_insert" on public.sales_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and public.can_edit_module(workspace_id, 'sales')
    and workspace_id = public.sales_company_workspace_id(company_id)
    and (deal_id is null or public.sales_deal_company_id(deal_id) = company_id)
  );

drop policy if exists "sales_attachments_delete" on public.sales_attachments;
create policy "sales_attachments_delete" on public.sales_attachments
  for delete using (public.can_edit_module(workspace_id, 'sales'));

-- ============================================================================
-- Storage bucket — private (reached only through RLS-gated signed URLs / SDK
-- calls). The 10MB cap mirrors MAX_SALES_FILE_SIZE_BYTES in
-- lib/sales-attachments.ts but is enforced here too, so it holds for clients
-- other than this app.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('sales-files', 'sales-files', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "sales_files_storage_select" on storage.objects;
create policy "sales_files_storage_select" on storage.objects
  for select using (
    bucket_id = 'sales-files'
    and public.can_view_module((storage.foldername(name))[1]::uuid, 'sales')
  );

drop policy if exists "sales_files_storage_insert" on storage.objects;
create policy "sales_files_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'sales-files'
    and public.can_edit_module((storage.foldername(name))[1]::uuid, 'sales')
  );

drop policy if exists "sales_files_storage_delete" on storage.objects;
create policy "sales_files_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'sales-files'
    and public.can_edit_module((storage.foldername(name))[1]::uuid, 'sales')
  );
