-- ============================================================================
-- attendance_records — clock in/out log, shared with the mobile app. This
-- table already exists in production (created from the mobile app's side of
-- this same Supabase project) — this migration is a record of that schema
-- for repo history and local/staging setup, not a change to apply on top of
-- the existing production database.
--
-- One row per member per work day (workspace_id, user_id, work_date unique).
-- time_in/time_out start out equal to their *_original counterpart; editing
-- either afterwards sets the matching *_manual flag and is constrained to
-- within 2 hours of the original punch (time_in_within_2h/time_out_within_2h)
-- so corrections can't drift far from the real clock event. If both sides of
-- a day were manually entered (never actually punched), the shift is capped
-- at 8 hours (manual_entry_max_8h) to keep fabricated entries bounded.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  work_date date not null,
  time_in timestamptz not null,
  time_in_original timestamptz not null,
  time_in_manual boolean not null default false,
  time_out timestamptz,
  time_out_original timestamptz,
  time_out_manual boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, work_date),
  constraint time_out_after_time_in
    check (time_out is null or time_out > time_in),
  constraint time_in_within_2h
    check (time_in >= time_in_original - interval '02:00:00' and time_in <= time_in_original + interval '02:00:00'),
  constraint time_out_within_2h
    check (
      time_out is null or time_out_original is null
      or (time_out >= time_out_original - interval '02:00:00' and time_out <= time_out_original + interval '02:00:00')
    ),
  constraint manual_entry_max_8h
    check (not (time_in_manual and time_out_manual) or time_out is null or (time_out - time_in) <= interval '08:00:00')
);

create index if not exists attendance_records_workspace_date_idx on public.attendance_records (workspace_id, work_date);

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();

alter table public.attendance_records enable row level security;

-- Members see their own punches; owners see everyone's (payroll/oversight).
drop policy if exists "attendance_records_select" on public.attendance_records;
create policy "attendance_records_select" on public.attendance_records
  for select using (
    public.is_workspace_member(workspace_id)
    and (user_id = auth.uid() or public.workspace_member_role(workspace_id, auth.uid()) = 'owner')
  );

drop policy if exists "attendance_records_insert" on public.attendance_records;
create policy "attendance_records_insert" on public.attendance_records
  for insert with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

-- Update, not delete: corrections adjust an existing punch (within the check
-- constraints above), they don't erase it. Only the member who owns the row
-- can update it — even the workspace owner can't edit someone else's punch.
drop policy if exists "attendance_records_update" on public.attendance_records;
create policy "attendance_records_update" on public.attendance_records
  for update using (user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
