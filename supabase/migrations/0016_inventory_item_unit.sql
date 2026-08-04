-- ============================================================================
-- Unit of measure (pcs, meters, kg, box, etc.) for inventory items.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

alter table public.inventory_items
  add column if not exists unit text not null default 'pcs';
