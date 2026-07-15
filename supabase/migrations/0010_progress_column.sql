-- ============================================================================
-- Add a "Progress" column type — a manually-set 0-100% completion bar.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

alter table public.columns drop constraint if exists columns_type_check;
alter table public.columns add constraint columns_type_check
  check (type in ('text', 'status', 'people', 'date', 'numeric', 'dropdown', 'checkbox', 'link', 'rating', 'timeline', 'file', 'progress'));
