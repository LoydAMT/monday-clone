-- ============================================================================
-- Two additions to a deal's paperwork:
--
--   1. Files can hang off a single quotation (the customer's PO, the signed
--      quote, a revised BOQ) instead of only the deal or company. quotation_id
--      is optional on sales_attachments; when set, the file also carries its
--      deal_id, so deal- and company-level views keep working unchanged.
--
--   2. sales_deal_costs — the cost lines behind a deal's profit & loss. The
--      revenue side is not stored: it is derived in the app from the deal's
--      accepted quotations (falling back to the deal value), so it can never
--      drift out of step with the quotations themselves.
--
-- Requires 0023_sales_attachments.sql.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- Quotation-level files
-- ============================================================================

alter table public.sales_attachments
  add column if not exists quotation_id uuid references public.sales_quotations (id) on delete cascade;

create index if not exists sales_attachments_quotation_id_idx on public.sales_attachments (quotation_id);

create or replace function public.sales_quotation_deal_id(p_quotation_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select deal_id from public.sales_quotations where id = p_quotation_id;
$$;

-- Same checks as 0023, plus: a quotation file must name the deal the
-- quotation belongs to.
drop policy if exists "sales_attachments_insert" on public.sales_attachments;
create policy "sales_attachments_insert" on public.sales_attachments
  for insert with check (
    uploaded_by = auth.uid()
    and public.can_edit_module(workspace_id, 'sales')
    and workspace_id = public.sales_company_workspace_id(company_id)
    and (deal_id is null or public.sales_deal_company_id(deal_id) = company_id)
    and (quotation_id is null or (deal_id is not null and public.sales_quotation_deal_id(quotation_id) = deal_id))
  );

-- ============================================================================
-- sales_deal_costs — cost lines for the deal's P&L
-- ============================================================================

create table if not exists public.sales_deal_costs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.sales_deals (id) on delete cascade,
  -- Text check rather than an enum, like sales_deals.stage; lib/sales-stages.ts
  -- holds the matching client-side list.
  category text not null default 'materials'
    check (category in ('materials', 'labor', 'subcontractor', 'equipment', 'transport', 'overhead', 'other')),
  description text not null,
  -- Always in the deal's own currency; the P&L doesn't convert.
  amount numeric(14, 2) not null check (amount >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_deal_costs_deal_id_idx on public.sales_deal_costs (deal_id);

drop trigger if exists sales_deal_costs_set_updated_at on public.sales_deal_costs;
create trigger sales_deal_costs_set_updated_at before update on public.sales_deal_costs
  for each row execute function public.set_updated_at();

alter table public.sales_deal_costs enable row level security;

drop policy if exists "sales_deal_costs_select" on public.sales_deal_costs;
create policy "sales_deal_costs_select" on public.sales_deal_costs
  for select using (public.can_view_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_deal_costs_insert" on public.sales_deal_costs;
create policy "sales_deal_costs_insert" on public.sales_deal_costs
  for insert with check (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_deal_costs_update" on public.sales_deal_costs;
create policy "sales_deal_costs_update" on public.sales_deal_costs
  for update using (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'))
  with check (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_deal_costs_delete" on public.sales_deal_costs;
create policy "sales_deal_costs_delete" on public.sales_deal_costs
  for delete using (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));
