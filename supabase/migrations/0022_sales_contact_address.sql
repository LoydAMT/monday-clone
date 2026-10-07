-- ============================================================================
-- Contact/lead address. The Contacts directory (/sales/[workspaceId]/contacts)
-- records a lead as a person in their own right — name, company, address,
-- contact number, email — and a lead's own address is often not the company's
-- registered one (a site office, a home address for a walk-in inquiry), so it
-- lives on the contact rather than being read off sales_companies.address.
--
-- Deals keep pointing at a contact through sales_deals.contact_id; none of
-- this is copied onto the deal. RLS is unchanged — the existing
-- sales_contacts policies cover the new column.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

alter table public.sales_contacts add column if not exists address text;
