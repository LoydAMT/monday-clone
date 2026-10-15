-- ============================================================================
-- One-time copy of the existing Sales data into Internal Sales.
--
-- Requires 0025_internal_sales.sql. Rows keep their original ids, so every
-- relationship (deal -> company, quotation -> deal, ...) carries over as is,
-- and a re-run is harmless: rows already copied are skipped (on conflict do
-- nothing), which also means it never overwrites edits made in Internal Sales
-- after the first run.
--
-- It is a snapshot. After it runs the two modules are independent — changes
-- in one do not appear in the other, and the original Sales data is left
-- exactly as it was.
--
-- NOT copied:
--   * File attachments. The rows are skipped on purpose: an Internal Sales
--     row pointing at the original Sales file would share one stored object,
--     so deleting the file in either module would break the other. SQL can't
--     copy the stored bytes, so re-attach files in Internal Sales by hand.
--   * Notifications.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- Companies first, then everything that points at them, in dependency order.

insert into public.internal_sales_companies
  (id, workspace_id, name, industry, website, email, phone, address, city, country, tax_id, notes,
   owner_id, created_by, created_at, updated_at)
select id, workspace_id, name, industry, website, email, phone, address, city, country, tax_id, notes,
       owner_id, created_by, created_at, updated_at
from public.sales_companies
on conflict (id) do nothing;

insert into public.internal_sales_contacts
  (id, company_id, name, position, email, phone, address, is_primary, notes, created_by, created_at, updated_at)
select id, company_id, name, position, email, phone, address, is_primary, notes, created_by, created_at, updated_at
from public.sales_contacts
on conflict (id) do nothing;

insert into public.internal_sales_deals
  (id, workspace_id, company_id, contact_id, title, reference_no, stage, value, currency, source,
   expected_order_date, next_follow_up_on, owner_id, lost_reason, closed_at, description,
   created_by, created_at, updated_at)
select id, workspace_id, company_id, contact_id, title, reference_no, stage, value, currency, source,
       expected_order_date, next_follow_up_on, owner_id, lost_reason, closed_at, description,
       created_by, created_at, updated_at
from public.sales_deals
on conflict (id) do nothing;

insert into public.internal_sales_quotations
  (id, deal_id, quote_number, revision, amount, currency, status, submitted_on, valid_until, notes,
   created_by, created_at, updated_at)
select id, deal_id, quote_number, revision, amount, currency, status, submitted_on, valid_until, notes,
       created_by, created_at, updated_at
from public.sales_quotations
on conflict (id) do nothing;

insert into public.internal_sales_site_visits
  (id, deal_id, scheduled_at, completed_at, site_address, findings, created_by, created_at, updated_at)
select id, deal_id, scheduled_at, completed_at, site_address, findings, created_by, created_at, updated_at
from public.sales_site_visits
on conflict (id) do nothing;

insert into public.internal_sales_activities
  (id, company_id, deal_id, type, direction, subject, body, occurred_at, created_by, created_at, updated_at)
select id, company_id, deal_id, type, direction, subject, body, occurred_at, created_by, created_at, updated_at
from public.sales_activities
on conflict (id) do nothing;

insert into public.internal_sales_tasks
  (id, workspace_id, company_id, deal_id, title, details, due_at, assigned_to, done_at,
   created_by, created_at, updated_at)
select id, workspace_id, company_id, deal_id, title, details, due_at, assigned_to, done_at,
       created_by, created_at, updated_at
from public.sales_tasks
on conflict (id) do nothing;

insert into public.internal_sales_deal_costs
  (id, deal_id, category, description, amount, created_by, created_at, updated_at)
select id, deal_id, category, description, amount, created_by, created_at, updated_at
from public.sales_deal_costs
on conflict (id) do nothing;
