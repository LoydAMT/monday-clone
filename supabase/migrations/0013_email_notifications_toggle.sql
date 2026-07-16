-- ============================================================================
-- Per-board toggle to turn assigned/mentioned notification emails on or off.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

alter table public.boards
  add column if not exists email_notifications_enabled boolean not null default true;
