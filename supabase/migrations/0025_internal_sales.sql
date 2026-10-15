-- ============================================================================
-- Internal Sales — a second, fully separate copy of the Sales module.
--
-- It exists so a group of sales agents can work their own customers and deals
-- without seeing the main Sales module (or each other's projects in it). It is
-- a straight duplicate: same shape, same access rules, but its own tables,
-- storage bucket and feature flag, so nothing here can touch the original.
--
-- Visibility: gated by the new `internal_sales` feature. It is added to the
-- features check constraint but NOT to the column default, so existing and new
-- members don't get it. Workspace owners always pass can_view_module(), so the
-- result is "owners only" with no extra logic; an owner can later grant it to
-- a member from the member-access screen.
--
-- Table / column definitions are the final state of 0019_sales.sql,
-- 0022_sales_contact_address.sql, 0023_sales_attachments.sql and
-- 0024_sales_quotation_files_and_pnl.sql, renamed; policies are the final
-- state from 0020_granular_access.sql with 'sales' swapped for 'internal_sales'.
--
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query), then
-- run 0026_internal_sales_copy_data.sql to copy the existing Sales data over.
-- ============================================================================

-- ============================================================================
-- Feature flag
-- ============================================================================

alter table public.workspace_members drop constraint if exists workspace_members_features_check;
alter table public.workspace_members
  add constraint workspace_members_features_check
  check (features <@ array['boards', 'inventory', 'attendance', 'sales', 'internal_sales']::text[]);

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.internal_sales_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  industry text,
  website text,
  email text,
  phone text,
  address text,
  city text,
  country text,
  tax_id text,
  notes text,
  owner_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists internal_sales_companies_workspace_name_idx
  on public.internal_sales_companies (workspace_id, lower(name));

drop trigger if exists internal_sales_companies_set_updated_at on public.internal_sales_companies;
create trigger internal_sales_companies_set_updated_at before update on public.internal_sales_companies
  for each row execute function public.set_updated_at();

create table if not exists public.internal_sales_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.internal_sales_companies (id) on delete cascade,
  name text not null,
  position text,
  email text,
  phone text,
  address text,
  is_primary boolean not null default false,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_sales_contacts_company_id_idx on public.internal_sales_contacts (company_id);

create unique index if not exists internal_sales_contacts_one_primary_idx
  on public.internal_sales_contacts (company_id) where is_primary;

drop trigger if exists internal_sales_contacts_set_updated_at on public.internal_sales_contacts;
create trigger internal_sales_contacts_set_updated_at before update on public.internal_sales_contacts
  for each row execute function public.set_updated_at();

create table if not exists public.internal_sales_deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.internal_sales_companies (id) on delete cascade,
  contact_id uuid references public.internal_sales_contacts (id) on delete set null,
  title text not null,
  reference_no text,
  stage text not null default 'lead' check (
    stage in (
      'lead', 'qualified', 'site_inspection', 'quotation_preparation',
      'quotation_submitted', 'follow_up', 'negotiation', 'po_received',
      'project_awarded', 'completed', 'lost'
    )
  ),
  value numeric(14, 2) check (value is null or value >= 0),
  currency text not null default 'PHP',
  source text,
  expected_order_date date,
  next_follow_up_on date,
  owner_id uuid references auth.users (id) on delete set null,
  lost_reason text,
  closed_at timestamptz,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_sales_deals_workspace_id_idx on public.internal_sales_deals (workspace_id);
create index if not exists internal_sales_deals_company_id_idx on public.internal_sales_deals (company_id);
create index if not exists internal_sales_deals_follow_up_idx
  on public.internal_sales_deals (workspace_id, next_follow_up_on) where next_follow_up_on is not null;

drop trigger if exists internal_sales_deals_set_updated_at on public.internal_sales_deals;
create trigger internal_sales_deals_set_updated_at before update on public.internal_sales_deals
  for each row execute function public.set_updated_at();

create table if not exists public.internal_sales_quotations (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.internal_sales_deals (id) on delete cascade,
  quote_number text not null,
  revision integer not null default 0 check (revision >= 0),
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'PHP',
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'accepted', 'rejected', 'expired')),
  submitted_on date,
  valid_until date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, quote_number, revision),
  constraint internal_sales_valid_until_after_submitted
    check (valid_until is null or submitted_on is null or valid_until >= submitted_on)
);

create index if not exists internal_sales_quotations_deal_id_idx on public.internal_sales_quotations (deal_id);

drop trigger if exists internal_sales_quotations_set_updated_at on public.internal_sales_quotations;
create trigger internal_sales_quotations_set_updated_at before update on public.internal_sales_quotations
  for each row execute function public.set_updated_at();

create table if not exists public.internal_sales_site_visits (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.internal_sales_deals (id) on delete cascade,
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  site_address text,
  findings text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_sales_site_visits_deal_id_idx on public.internal_sales_site_visits (deal_id);

drop trigger if exists internal_sales_site_visits_set_updated_at on public.internal_sales_site_visits;
create trigger internal_sales_site_visits_set_updated_at before update on public.internal_sales_site_visits
  for each row execute function public.set_updated_at();

create table if not exists public.internal_sales_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.internal_sales_companies (id) on delete cascade,
  deal_id uuid references public.internal_sales_deals (id) on delete cascade,
  type text not null check (type in ('email', 'call', 'meeting', 'note')),
  direction text check (direction in ('inbound', 'outbound')),
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_sales_activities_company_id_idx
  on public.internal_sales_activities (company_id, occurred_at desc);
create index if not exists internal_sales_activities_deal_id_idx on public.internal_sales_activities (deal_id);

drop trigger if exists internal_sales_activities_set_updated_at on public.internal_sales_activities;
create trigger internal_sales_activities_set_updated_at before update on public.internal_sales_activities
  for each row execute function public.set_updated_at();

create table if not exists public.internal_sales_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.internal_sales_companies (id) on delete cascade,
  deal_id uuid references public.internal_sales_deals (id) on delete cascade,
  title text not null,
  details text,
  due_at timestamptz,
  assigned_to uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_sales_tasks_workspace_due_idx on public.internal_sales_tasks (workspace_id, due_at);
create index if not exists internal_sales_tasks_company_id_idx on public.internal_sales_tasks (company_id);
create index if not exists internal_sales_tasks_deal_id_idx on public.internal_sales_tasks (deal_id);

drop trigger if exists internal_sales_tasks_set_updated_at on public.internal_sales_tasks;
create trigger internal_sales_tasks_set_updated_at before update on public.internal_sales_tasks
  for each row execute function public.set_updated_at();

create table if not exists public.internal_sales_deal_costs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.internal_sales_deals (id) on delete cascade,
  category text not null default 'materials'
    check (category in ('materials', 'labor', 'subcontractor', 'equipment', 'transport', 'overhead', 'other')),
  description text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_sales_deal_costs_deal_id_idx on public.internal_sales_deal_costs (deal_id);

drop trigger if exists internal_sales_deal_costs_set_updated_at on public.internal_sales_deal_costs;
create trigger internal_sales_deal_costs_set_updated_at before update on public.internal_sales_deal_costs
  for each row execute function public.set_updated_at();

-- Attachments are created after quotations so quotation_id can reference it.
create table if not exists public.internal_sales_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.internal_sales_companies (id) on delete cascade,
  deal_id uuid references public.internal_sales_deals (id) on delete cascade,
  quotation_id uuid references public.internal_sales_quotations (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null check (file_size >= 0),
  content_type text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists internal_sales_attachments_company_id_idx
  on public.internal_sales_attachments (company_id, created_at desc);
create index if not exists internal_sales_attachments_deal_id_idx on public.internal_sales_attachments (deal_id);
create index if not exists internal_sales_attachments_quotation_id_idx on public.internal_sales_attachments (quotation_id);

-- ============================================================================
-- RLS helpers
-- ============================================================================

create or replace function public.internal_sales_company_workspace_id(p_company_id uuid)
returns uuid language sql security definer set search_path = public stable
as $$ select workspace_id from public.internal_sales_companies where id = p_company_id; $$;

create or replace function public.internal_sales_deal_workspace_id(p_deal_id uuid)
returns uuid language sql security definer set search_path = public stable
as $$ select workspace_id from public.internal_sales_deals where id = p_deal_id; $$;

create or replace function public.internal_sales_deal_company_id(p_deal_id uuid)
returns uuid language sql security definer set search_path = public stable
as $$ select company_id from public.internal_sales_deals where id = p_deal_id; $$;

create or replace function public.internal_sales_quotation_deal_id(p_quotation_id uuid)
returns uuid language sql security definer set search_path = public stable
as $$ select deal_id from public.internal_sales_quotations where id = p_quotation_id; $$;

-- ============================================================================
-- Row Level Security — reads need the internal_sales feature (owners always
-- have it), writes need it plus the editor tier.
-- ============================================================================

alter table public.internal_sales_companies enable row level security;
alter table public.internal_sales_contacts enable row level security;
alter table public.internal_sales_deals enable row level security;
alter table public.internal_sales_quotations enable row level security;
alter table public.internal_sales_site_visits enable row level security;
alter table public.internal_sales_activities enable row level security;
alter table public.internal_sales_tasks enable row level security;
alter table public.internal_sales_deal_costs enable row level security;
alter table public.internal_sales_attachments enable row level security;

-- companies
drop policy if exists "internal_sales_companies_select" on public.internal_sales_companies;
create policy "internal_sales_companies_select" on public.internal_sales_companies
  for select using (public.can_view_module(workspace_id, 'internal_sales'));

drop policy if exists "internal_sales_companies_insert" on public.internal_sales_companies;
create policy "internal_sales_companies_insert" on public.internal_sales_companies
  for insert with check (public.can_edit_module(workspace_id, 'internal_sales'));

drop policy if exists "internal_sales_companies_update" on public.internal_sales_companies;
create policy "internal_sales_companies_update" on public.internal_sales_companies
  for update using (public.can_edit_module(workspace_id, 'internal_sales'))
  with check (public.can_edit_module(workspace_id, 'internal_sales'));

-- Deleting a company cascades to everything under it — owner-only, as in Sales.
drop policy if exists "internal_sales_companies_delete" on public.internal_sales_companies;
create policy "internal_sales_companies_delete" on public.internal_sales_companies
  for delete using (public.workspace_member_role(workspace_id, auth.uid()) = 'owner');

-- contacts
drop policy if exists "internal_sales_contacts_select" on public.internal_sales_contacts;
create policy "internal_sales_contacts_select" on public.internal_sales_contacts
  for select using (public.can_view_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales'));

drop policy if exists "internal_sales_contacts_insert" on public.internal_sales_contacts;
create policy "internal_sales_contacts_insert" on public.internal_sales_contacts
  for insert with check (public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales'));

drop policy if exists "internal_sales_contacts_update" on public.internal_sales_contacts;
create policy "internal_sales_contacts_update" on public.internal_sales_contacts
  for update using (public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales'))
  with check (public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales'));

drop policy if exists "internal_sales_contacts_delete" on public.internal_sales_contacts;
create policy "internal_sales_contacts_delete" on public.internal_sales_contacts
  for delete using (public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales'));

-- deals
drop policy if exists "internal_sales_deals_select" on public.internal_sales_deals;
create policy "internal_sales_deals_select" on public.internal_sales_deals
  for select using (public.can_view_module(workspace_id, 'internal_sales'));

drop policy if exists "internal_sales_deals_insert" on public.internal_sales_deals;
create policy "internal_sales_deals_insert" on public.internal_sales_deals
  for insert with check (
    public.can_edit_module(workspace_id, 'internal_sales')
    and workspace_id = public.internal_sales_company_workspace_id(company_id)
  );

drop policy if exists "internal_sales_deals_update" on public.internal_sales_deals;
create policy "internal_sales_deals_update" on public.internal_sales_deals
  for update using (public.can_edit_module(workspace_id, 'internal_sales'))
  with check (
    public.can_edit_module(workspace_id, 'internal_sales')
    and workspace_id = public.internal_sales_company_workspace_id(company_id)
  );

drop policy if exists "internal_sales_deals_delete" on public.internal_sales_deals;
create policy "internal_sales_deals_delete" on public.internal_sales_deals
  for delete using (public.can_edit_module(workspace_id, 'internal_sales'));

-- quotations
drop policy if exists "internal_sales_quotations_select" on public.internal_sales_quotations;
create policy "internal_sales_quotations_select" on public.internal_sales_quotations
  for select using (public.can_view_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_quotations_insert" on public.internal_sales_quotations;
create policy "internal_sales_quotations_insert" on public.internal_sales_quotations
  for insert with check (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_quotations_update" on public.internal_sales_quotations;
create policy "internal_sales_quotations_update" on public.internal_sales_quotations
  for update using (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'))
  with check (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_quotations_delete" on public.internal_sales_quotations;
create policy "internal_sales_quotations_delete" on public.internal_sales_quotations
  for delete using (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

-- site visits
drop policy if exists "internal_sales_site_visits_select" on public.internal_sales_site_visits;
create policy "internal_sales_site_visits_select" on public.internal_sales_site_visits
  for select using (public.can_view_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_site_visits_insert" on public.internal_sales_site_visits;
create policy "internal_sales_site_visits_insert" on public.internal_sales_site_visits
  for insert with check (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_site_visits_update" on public.internal_sales_site_visits;
create policy "internal_sales_site_visits_update" on public.internal_sales_site_visits
  for update using (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'))
  with check (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_site_visits_delete" on public.internal_sales_site_visits;
create policy "internal_sales_site_visits_delete" on public.internal_sales_site_visits
  for delete using (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

-- activities (authors manage their own entries; editors can clean up)
drop policy if exists "internal_sales_activities_select" on public.internal_sales_activities;
create policy "internal_sales_activities_select" on public.internal_sales_activities
  for select using (public.can_view_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales'));

drop policy if exists "internal_sales_activities_insert" on public.internal_sales_activities;
create policy "internal_sales_activities_insert" on public.internal_sales_activities
  for insert with check (
    created_by = auth.uid()
    and public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales')
    and (deal_id is null or public.internal_sales_deal_company_id(deal_id) = company_id)
  );

drop policy if exists "internal_sales_activities_update" on public.internal_sales_activities;
create policy "internal_sales_activities_update" on public.internal_sales_activities
  for update using (
    created_by = auth.uid()
    and public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales')
  ) with check (
    created_by = auth.uid()
    and public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales')
    and (deal_id is null or public.internal_sales_deal_company_id(deal_id) = company_id)
  );

drop policy if exists "internal_sales_activities_delete" on public.internal_sales_activities;
create policy "internal_sales_activities_delete" on public.internal_sales_activities
  for delete using (
    public.can_view_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales')
    and (
      created_by = auth.uid()
      or public.can_edit_module(public.internal_sales_company_workspace_id(company_id), 'internal_sales')
    )
  );

-- tasks
drop policy if exists "internal_sales_tasks_select" on public.internal_sales_tasks;
create policy "internal_sales_tasks_select" on public.internal_sales_tasks
  for select using (public.can_view_module(workspace_id, 'internal_sales'));

drop policy if exists "internal_sales_tasks_insert" on public.internal_sales_tasks;
create policy "internal_sales_tasks_insert" on public.internal_sales_tasks
  for insert with check (
    public.can_edit_module(workspace_id, 'internal_sales')
    and (company_id is null or workspace_id = public.internal_sales_company_workspace_id(company_id))
    and (deal_id is null or workspace_id = public.internal_sales_deal_workspace_id(deal_id))
  );

drop policy if exists "internal_sales_tasks_update" on public.internal_sales_tasks;
create policy "internal_sales_tasks_update" on public.internal_sales_tasks
  for update using (public.can_edit_module(workspace_id, 'internal_sales'))
  with check (
    public.can_edit_module(workspace_id, 'internal_sales')
    and (company_id is null or workspace_id = public.internal_sales_company_workspace_id(company_id))
    and (deal_id is null or workspace_id = public.internal_sales_deal_workspace_id(deal_id))
  );

drop policy if exists "internal_sales_tasks_delete" on public.internal_sales_tasks;
create policy "internal_sales_tasks_delete" on public.internal_sales_tasks
  for delete using (public.can_edit_module(workspace_id, 'internal_sales'));

-- deal costs
drop policy if exists "internal_sales_deal_costs_select" on public.internal_sales_deal_costs;
create policy "internal_sales_deal_costs_select" on public.internal_sales_deal_costs
  for select using (public.can_view_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_deal_costs_insert" on public.internal_sales_deal_costs;
create policy "internal_sales_deal_costs_insert" on public.internal_sales_deal_costs
  for insert with check (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_deal_costs_update" on public.internal_sales_deal_costs;
create policy "internal_sales_deal_costs_update" on public.internal_sales_deal_costs
  for update using (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'))
  with check (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

drop policy if exists "internal_sales_deal_costs_delete" on public.internal_sales_deal_costs;
create policy "internal_sales_deal_costs_delete" on public.internal_sales_deal_costs
  for delete using (public.can_edit_module(public.internal_sales_deal_workspace_id(deal_id), 'internal_sales'));

-- attachments (no update policy — replace a file by deleting and re-uploading)
drop policy if exists "internal_sales_attachments_select" on public.internal_sales_attachments;
create policy "internal_sales_attachments_select" on public.internal_sales_attachments
  for select using (public.can_view_module(workspace_id, 'internal_sales'));

drop policy if exists "internal_sales_attachments_insert" on public.internal_sales_attachments;
create policy "internal_sales_attachments_insert" on public.internal_sales_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and public.can_edit_module(workspace_id, 'internal_sales')
    and workspace_id = public.internal_sales_company_workspace_id(company_id)
    and (deal_id is null or public.internal_sales_deal_company_id(deal_id) = company_id)
    and (
      quotation_id is null
      or (deal_id is not null and public.internal_sales_quotation_deal_id(quotation_id) = deal_id)
    )
  );

drop policy if exists "internal_sales_attachments_delete" on public.internal_sales_attachments;
create policy "internal_sales_attachments_delete" on public.internal_sales_attachments
  for delete using (public.can_edit_module(workspace_id, 'internal_sales'));

-- ============================================================================
-- Storage bucket — private, 10MB cap, objects at
-- {workspace_id}/{company_id}/{uuid}-{filename}
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('internal-sales-files', 'internal-sales-files', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "internal_sales_files_storage_select" on storage.objects;
create policy "internal_sales_files_storage_select" on storage.objects
  for select using (
    bucket_id = 'internal-sales-files'
    and public.can_view_module((storage.foldername(name))[1]::uuid, 'internal_sales')
  );

drop policy if exists "internal_sales_files_storage_insert" on storage.objects;
create policy "internal_sales_files_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'internal-sales-files'
    and public.can_edit_module((storage.foldername(name))[1]::uuid, 'internal_sales')
  );

drop policy if exists "internal_sales_files_storage_delete" on storage.objects;
create policy "internal_sales_files_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'internal-sales-files'
    and public.can_edit_module((storage.foldername(name))[1]::uuid, 'internal_sales')
  );
