-- ============================================================================
-- Sales / CRM module — a standalone system (not the board/column/item grid),
-- structured like the inventory module in 0015_inventory.sql: its own tables,
-- routes and UI, workspace-scoped, editor-gated writes.
--
-- The shape is company-centric: a customer company holds contact persons,
-- communications and tasks, and owns any number of deals (inquiries/RFQs).
-- A deal carries the pipeline stage, its quotations, and its site visits.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- sales_companies — the customer/company profile
-- ============================================================================

create table if not exists public.sales_companies (
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
  -- Account manager. set null (not cascade) for the same reason as
  -- inventory_items.created_by — sales records outlive the account that owns
  -- them; an unassigned company is still a valid company.
  owner_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Case-insensitive, mirroring inventory_locations — the company picker offers
-- "type to create", so without this the same customer accumulates near-
-- duplicate profiles ("Acme Corp" vs "acme corp") and its history splits.
create unique index if not exists sales_companies_workspace_name_idx
  on public.sales_companies (workspace_id, lower(name));

drop trigger if exists sales_companies_set_updated_at on public.sales_companies;
create trigger sales_companies_set_updated_at before update on public.sales_companies
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sales_contacts — contact persons at a company
-- ============================================================================

create table if not exists public.sales_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.sales_companies (id) on delete cascade,
  name text not null,
  position text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_contacts_company_id_idx on public.sales_contacts (company_id);

-- A company has at most one primary contact. Partial unique index rather than
-- a trigger that demotes the previous one, so the "only one" rule is a
-- database fact; lib/sales-mutations.ts clears the old primary before setting
-- a new one.
create unique index if not exists sales_contacts_one_primary_idx
  on public.sales_contacts (company_id) where is_primary;

drop trigger if exists sales_contacts_set_updated_at on public.sales_contacts;
create trigger sales_contacts_set_updated_at before update on public.sales_contacts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sales_deals — one inquiry/RFQ tracked through the pipeline
--
-- Stages are the pipeline in order:
--   lead → qualified → site_inspection → quotation_preparation →
--   quotation_submitted → follow_up → negotiation → po_received →
--   project_awarded → completed
-- plus `lost`, the one off-ramp reachable from any stage. Kept as a text
-- check constraint (not an enum) so adding a stage later is an alter of this
-- constraint rather than an enum migration; lib/sales-stages.ts holds the
-- matching client-side list and ordering.
-- ============================================================================

create table if not exists public.sales_deals (
  id uuid primary key default gen_random_uuid(),
  -- Denormalized from sales_companies so the pipeline board can filter by
  -- workspace in one indexed predicate and RLS reads like every other table
  -- here. The insert/update policies below enforce that it always matches the
  -- company's own workspace.
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid not null references public.sales_companies (id) on delete cascade,
  contact_id uuid references public.sales_contacts (id) on delete set null,
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
  -- Only meaningful on a lost deal; the UI asks for it when the stage moves
  -- to 'lost' and clears it when the deal reopens.
  lost_reason text,
  -- Stamped by lib/sales-mutations.ts on the transition from an open stage
  -- into a closed one (po_received onwards, or lost) and cleared when the
  -- deal reopens — so it records when the deal was actually won or lost, not
  -- when it last moved between the post-win stages.
  closed_at timestamptz,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_deals_workspace_id_idx on public.sales_deals (workspace_id);
create index if not exists sales_deals_company_id_idx on public.sales_deals (company_id);
-- The "what's due" queries (follow-ups board, overdue badges) filter on this
-- within a workspace.
create index if not exists sales_deals_follow_up_idx
  on public.sales_deals (workspace_id, next_follow_up_on) where next_follow_up_on is not null;

drop trigger if exists sales_deals_set_updated_at on public.sales_deals;
create trigger sales_deals_set_updated_at before update on public.sales_deals
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sales_quotations — quotations submitted against a deal, one row per revision
-- ============================================================================

create table if not exists public.sales_quotations (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.sales_deals (id) on delete cascade,
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
  -- Re-quoting is a new revision of the same number, not a second row with
  -- the same one.
  unique (deal_id, quote_number, revision),
  constraint valid_until_after_submitted
    check (valid_until is null or submitted_on is null or valid_until >= submitted_on)
);

create index if not exists sales_quotations_deal_id_idx on public.sales_quotations (deal_id);

drop trigger if exists sales_quotations_set_updated_at on public.sales_quotations;
create trigger sales_quotations_set_updated_at before update on public.sales_quotations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sales_site_visits — site inspections scheduled/completed for a deal
-- ============================================================================

create table if not exists public.sales_site_visits (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.sales_deals (id) on delete cascade,
  scheduled_at timestamptz not null,
  completed_at timestamptz,
  site_address text,
  -- Filled in after the visit — what was measured/seen on site.
  findings text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_site_visits_deal_id_idx on public.sales_site_visits (deal_id);

drop trigger if exists sales_site_visits_set_updated_at on public.sales_site_visits;
create trigger sales_site_visits_set_updated_at before update on public.sales_site_visits
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sales_activities — the communication log (emails, calls, meetings, notes)
--
-- company_id is required and deal_id optional, so the company profile can show
-- one unbroken history even for contact that predates (or outlives) any single
-- deal. The insert/update policies enforce that a supplied deal_id belongs to
-- the same company.
-- ============================================================================

create table if not exists public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.sales_companies (id) on delete cascade,
  deal_id uuid references public.sales_deals (id) on delete cascade,
  type text not null check (type in ('email', 'call', 'meeting', 'note')),
  direction text check (direction in ('inbound', 'outbound')),
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_activities_company_id_idx
  on public.sales_activities (company_id, occurred_at desc);
create index if not exists sales_activities_deal_id_idx on public.sales_activities (deal_id);

drop trigger if exists sales_activities_set_updated_at on public.sales_activities;
create trigger sales_activities_set_updated_at before update on public.sales_activities
  for each row execute function public.set_updated_at();

-- ============================================================================
-- sales_tasks — follow-up tasks and reminders, hung off a company and/or deal
-- ============================================================================

create table if not exists public.sales_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_id uuid references public.sales_companies (id) on delete cascade,
  deal_id uuid references public.sales_deals (id) on delete cascade,
  title text not null,
  details text,
  due_at timestamptz,
  assigned_to uuid references auth.users (id) on delete set null,
  done_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_tasks_workspace_due_idx on public.sales_tasks (workspace_id, due_at);
create index if not exists sales_tasks_company_id_idx on public.sales_tasks (company_id);
create index if not exists sales_tasks_deal_id_idx on public.sales_tasks (deal_id);

drop trigger if exists sales_tasks_set_updated_at on public.sales_tasks;
create trigger sales_tasks_set_updated_at before update on public.sales_tasks
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS helpers — resolve a child row to its workspace, mirroring
-- inventory_item_workspace_id() from 0015_inventory.sql so every policy below
-- reads the same way as the rest of this codebase's RLS.
-- ============================================================================

create or replace function public.sales_company_workspace_id(p_company_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.sales_companies where id = p_company_id;
$$;

create or replace function public.sales_deal_workspace_id(p_deal_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.sales_deals where id = p_deal_id;
$$;

create or replace function public.sales_deal_company_id(p_deal_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.sales_deals where id = p_deal_id;
$$;

-- ============================================================================
-- Row Level Security — member-gated reads, editor-gated writes, the same tier
-- as boards/items/inventory.
-- ============================================================================

alter table public.sales_companies enable row level security;
alter table public.sales_contacts enable row level security;
alter table public.sales_deals enable row level security;
alter table public.sales_quotations enable row level security;
alter table public.sales_site_visits enable row level security;
alter table public.sales_activities enable row level security;
alter table public.sales_tasks enable row level security;

-- sales_companies
drop policy if exists "sales_companies_select" on public.sales_companies;
create policy "sales_companies_select" on public.sales_companies
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "sales_companies_insert" on public.sales_companies;
create policy "sales_companies_insert" on public.sales_companies
  for insert with check (public.is_workspace_editor(workspace_id));

drop policy if exists "sales_companies_update" on public.sales_companies;
create policy "sales_companies_update" on public.sales_companies
  for update using (public.is_workspace_editor(workspace_id))
  with check (public.is_workspace_editor(workspace_id));

-- Deleting a company cascades to its contacts, deals, quotations, visits,
-- activities and tasks — owner-only, one tier above the editor writes above.
drop policy if exists "sales_companies_delete" on public.sales_companies;
create policy "sales_companies_delete" on public.sales_companies
  for delete using (public.workspace_member_role(workspace_id, auth.uid()) = 'owner');

-- sales_contacts
drop policy if exists "sales_contacts_select" on public.sales_contacts;
create policy "sales_contacts_select" on public.sales_contacts
  for select using (public.is_workspace_member(public.sales_company_workspace_id(company_id)));

drop policy if exists "sales_contacts_insert" on public.sales_contacts;
create policy "sales_contacts_insert" on public.sales_contacts
  for insert with check (public.is_workspace_editor(public.sales_company_workspace_id(company_id)));

drop policy if exists "sales_contacts_update" on public.sales_contacts;
create policy "sales_contacts_update" on public.sales_contacts
  for update using (public.is_workspace_editor(public.sales_company_workspace_id(company_id)))
  with check (public.is_workspace_editor(public.sales_company_workspace_id(company_id)));

drop policy if exists "sales_contacts_delete" on public.sales_contacts;
create policy "sales_contacts_delete" on public.sales_contacts
  for delete using (public.is_workspace_editor(public.sales_company_workspace_id(company_id)));

-- sales_deals: writes also confirm the company lives in the same workspace as
-- the denormalized workspace_id — same reasoning as inventory_stock's
-- item/location workspace equality check in 0015_inventory.sql.
drop policy if exists "sales_deals_select" on public.sales_deals;
create policy "sales_deals_select" on public.sales_deals
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "sales_deals_insert" on public.sales_deals;
create policy "sales_deals_insert" on public.sales_deals
  for insert with check (
    public.is_workspace_editor(workspace_id)
    and workspace_id = public.sales_company_workspace_id(company_id)
  );

drop policy if exists "sales_deals_update" on public.sales_deals;
create policy "sales_deals_update" on public.sales_deals
  for update using (public.is_workspace_editor(workspace_id))
  with check (
    public.is_workspace_editor(workspace_id)
    and workspace_id = public.sales_company_workspace_id(company_id)
  );

drop policy if exists "sales_deals_delete" on public.sales_deals;
create policy "sales_deals_delete" on public.sales_deals
  for delete using (public.is_workspace_editor(workspace_id));

-- sales_quotations
drop policy if exists "sales_quotations_select" on public.sales_quotations;
create policy "sales_quotations_select" on public.sales_quotations
  for select using (public.is_workspace_member(public.sales_deal_workspace_id(deal_id)));

drop policy if exists "sales_quotations_insert" on public.sales_quotations;
create policy "sales_quotations_insert" on public.sales_quotations
  for insert with check (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)));

drop policy if exists "sales_quotations_update" on public.sales_quotations;
create policy "sales_quotations_update" on public.sales_quotations
  for update using (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)))
  with check (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)));

drop policy if exists "sales_quotations_delete" on public.sales_quotations;
create policy "sales_quotations_delete" on public.sales_quotations
  for delete using (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)));

-- sales_site_visits
drop policy if exists "sales_site_visits_select" on public.sales_site_visits;
create policy "sales_site_visits_select" on public.sales_site_visits
  for select using (public.is_workspace_member(public.sales_deal_workspace_id(deal_id)));

drop policy if exists "sales_site_visits_insert" on public.sales_site_visits;
create policy "sales_site_visits_insert" on public.sales_site_visits
  for insert with check (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)));

drop policy if exists "sales_site_visits_update" on public.sales_site_visits;
create policy "sales_site_visits_update" on public.sales_site_visits
  for update using (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)))
  with check (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)));

drop policy if exists "sales_site_visits_delete" on public.sales_site_visits;
create policy "sales_site_visits_delete" on public.sales_site_visits
  for delete using (public.is_workspace_editor(public.sales_deal_workspace_id(deal_id)));

-- sales_activities: a logged communication is a record of what happened, so
-- editing/removing one is the author's own call (or an editor's cleanup) —
-- narrower than the blanket editor write used elsewhere in this module.
drop policy if exists "sales_activities_select" on public.sales_activities;
create policy "sales_activities_select" on public.sales_activities
  for select using (public.is_workspace_member(public.sales_company_workspace_id(company_id)));

drop policy if exists "sales_activities_insert" on public.sales_activities;
create policy "sales_activities_insert" on public.sales_activities
  for insert with check (
    created_by = auth.uid()
    and public.is_workspace_editor(public.sales_company_workspace_id(company_id))
    and (deal_id is null or public.sales_deal_company_id(deal_id) = company_id)
  );

-- The membership half of this repeats what select already enforces, but an
-- UPDATE policy's USING is evaluated independently of the SELECT policy — so
-- without it, someone removed from the workspace could still edit entries
-- they authored while they were a member.
drop policy if exists "sales_activities_update" on public.sales_activities;
create policy "sales_activities_update" on public.sales_activities
  for update using (
    created_by = auth.uid()
    and public.is_workspace_editor(public.sales_company_workspace_id(company_id))
  ) with check (
    created_by = auth.uid()
    and public.is_workspace_editor(public.sales_company_workspace_id(company_id))
    and (deal_id is null or public.sales_deal_company_id(deal_id) = company_id)
  );

drop policy if exists "sales_activities_delete" on public.sales_activities;
create policy "sales_activities_delete" on public.sales_activities
  for delete using (
    created_by = auth.uid()
    or public.is_workspace_editor(public.sales_company_workspace_id(company_id))
  );

-- sales_tasks: plain editor writes. Ticking a task off is an update like any
-- other, so there's deliberately no extra "assignee can always update their
-- own" clause — a viewer who gets assigned a task still can't write, matching
-- how viewers behave everywhere else.
drop policy if exists "sales_tasks_select" on public.sales_tasks;
create policy "sales_tasks_select" on public.sales_tasks
  for select using (public.is_workspace_member(workspace_id));

drop policy if exists "sales_tasks_insert" on public.sales_tasks;
create policy "sales_tasks_insert" on public.sales_tasks
  for insert with check (
    public.is_workspace_editor(workspace_id)
    and (company_id is null or workspace_id = public.sales_company_workspace_id(company_id))
    and (deal_id is null or workspace_id = public.sales_deal_workspace_id(deal_id))
  );

drop policy if exists "sales_tasks_update" on public.sales_tasks;
create policy "sales_tasks_update" on public.sales_tasks
  for update using (public.is_workspace_editor(workspace_id))
  with check (
    public.is_workspace_editor(workspace_id)
    and (company_id is null or workspace_id = public.sales_company_workspace_id(company_id))
    and (deal_id is null or workspace_id = public.sales_deal_workspace_id(deal_id))
  );

drop policy if exists "sales_tasks_delete" on public.sales_tasks;
create policy "sales_tasks_delete" on public.sales_tasks
  for delete using (public.is_workspace_editor(workspace_id));
