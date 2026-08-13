-- ============================================================================
-- Granular access control — per-board visibility and per-module features for
-- invited members, plus owner-only board creation.
--
-- Before this migration, workspace membership was all-or-nothing: every member
-- could see every board and every module. Two knobs are added to
-- workspace_members, both defaulting to today's behaviour so no existing
-- member loses anything when this runs:
--
--   board_access = 'all'      -> sees every board (the default)
--                = 'selected' -> sees only boards granted in board_members
--   features     = text[]     -> which modules are reachable (defaults to all)
--
-- Workspace owners are never restricted by either knob.
--
-- The important part is the second half of this file. Every table hanging off
-- a board (groups, columns, items, comments, activity_log, attachments,
-- automations, automation_runs, board_share_links, linked_items) previously
-- gated on `is_workspace_member(board.workspace_id)`. Hiding a board from the
-- sidebar while leaving those policies alone would be pure theatre — the rows
-- would still be readable straight from the REST API. They are all rewritten
-- to gate on board access instead.
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================================

-- ============================================================================
-- Schema
-- ============================================================================

alter table public.workspace_members
  add column if not exists board_access text not null default 'all';

do $$
begin
  alter table public.workspace_members
    add constraint workspace_members_board_access_check
    check (board_access in ('all', 'selected'));
exception
  when duplicate_object then null;
end $$;

alter table public.workspace_members
  add column if not exists features text[] not null
  default array['boards', 'inventory', 'attendance', 'sales']::text[];

-- Keeps typos out of the array. Adding a module later means altering this
-- constraint, the same trade-off taken for sales_deals.stage.
do $$
begin
  alter table public.workspace_members
    add constraint workspace_members_features_check
    check (features <@ array['boards', 'inventory', 'attendance', 'sales']::text[]);
exception
  when duplicate_object then null;
end $$;

-- Which boards a 'selected' member may see. Rows are ignored entirely while
-- board_access = 'all', so granting/revoking is non-destructive: flipping a
-- member back to 'all' restores full visibility without losing the selection.
create table if not exists public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists board_members_user_id_idx on public.board_members (user_id);

-- ============================================================================
-- Access helpers
--
-- All security definer + stable, mirroring is_workspace_member. Being
-- definer is what lets can_access_board read board_members without tripping
-- over board_members' own RLS (which would otherwise recurse).
-- ============================================================================

-- Resolves a board to whether the caller may see it at all.
create or replace function public.can_access_board(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select case
      -- Owners are never restricted, by board or by feature.
      when wm.role = 'owner' then true
      -- The boards module itself can be switched off for a member.
      when not ('boards' = any (wm.features)) then false
      when wm.board_access = 'all' then true
      else exists (
        select 1 from public.board_members bm
        where bm.board_id = b.id and bm.user_id = wm.user_id
      )
    end
    from public.boards b
    join public.workspace_members wm
      on wm.workspace_id = b.workspace_id and wm.user_id = auth.uid()
    where b.id = p_board_id
  ), false);
$$;

-- Write access: everything can_access_board requires, plus the existing
-- owner/member (i.e. non-viewer) tier.
create or replace function public.can_edit_board(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_access_board(p_board_id)
     and public.is_workspace_editor((select workspace_id from public.boards where id = p_board_id));
$$;

-- Module gating for the standalone modules (inventory, attendance, sales).
create or replace function public.can_view_module(ws_id uuid, p_feature text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select wm.role = 'owner' or p_feature = any (wm.features)
    from public.workspace_members wm
    where wm.workspace_id = ws_id and wm.user_id = auth.uid()
  ), false);
$$;

create or replace function public.can_edit_module(ws_id uuid, p_feature text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.can_view_module(ws_id, p_feature) and public.is_workspace_editor(ws_id);
$$;

-- Child-row -> board resolvers, so the policies below can call
-- can_access_board directly on an indexed lookup instead of repeating a
-- three-table EXISTS join in every policy.
create or replace function public.group_board_id(p_group_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select board_id from public.groups where id = p_group_id;
$$;

create or replace function public.item_board_id(p_item_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select g.board_id
  from public.items i
  join public.groups g on g.id = i.group_id
  where i.id = p_item_id;
$$;

create or replace function public.automation_board_id(p_automation_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select board_id from public.automations where id = p_automation_id;
$$;

-- ============================================================================
-- board_members RLS — the grant list itself
-- ============================================================================

alter table public.board_members enable row level security;

-- Members can see their own grants (the app needs this to know what it may
-- show); owners see every grant in their workspace so they can manage them.
drop policy if exists "board_members_select" on public.board_members;
create policy "board_members_select" on public.board_members
  for select using (
    user_id = auth.uid()
    or public.workspace_member_role(
         (select workspace_id from public.boards where id = board_id), auth.uid()
       ) = 'owner'
  );

drop policy if exists "board_members_insert" on public.board_members;
create policy "board_members_insert" on public.board_members
  for insert with check (
    public.workspace_member_role(
      (select workspace_id from public.boards where id = board_id), auth.uid()
    ) = 'owner'
  );

drop policy if exists "board_members_delete" on public.board_members;
create policy "board_members_delete" on public.board_members
  for delete using (
    public.workspace_member_role(
      (select workspace_id from public.boards where id = board_id), auth.uid()
    ) = 'owner'
  );

-- ============================================================================
-- boards
-- ============================================================================

drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own" on public.boards
  for select using (public.can_access_board(id));

-- Owner-only board creation. Previously is_workspace_editor, which let any
-- non-viewer member add boards.
drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own" on public.boards
  for insert with check (public.workspace_member_role(workspace_id, auth.uid()) = 'owner');

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own" on public.boards
  for update using (public.can_edit_board(id)) with check (public.can_edit_board(id));

drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own" on public.boards
  for delete using (public.workspace_member_role(workspace_id, auth.uid()) = 'owner');

-- ============================================================================
-- groups / columns — keyed directly by board_id
-- ============================================================================

drop policy if exists "groups_select_own" on public.groups;
create policy "groups_select_own" on public.groups
  for select using (public.can_access_board(board_id));

drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own" on public.groups
  for insert with check (public.can_edit_board(board_id));

drop policy if exists "groups_update_own" on public.groups;
create policy "groups_update_own" on public.groups
  for update using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

drop policy if exists "groups_delete_own" on public.groups;
create policy "groups_delete_own" on public.groups
  for delete using (public.can_edit_board(board_id));

drop policy if exists "columns_select_own" on public.columns;
create policy "columns_select_own" on public.columns
  for select using (public.can_access_board(board_id));

drop policy if exists "columns_insert_own" on public.columns;
create policy "columns_insert_own" on public.columns
  for insert with check (public.can_edit_board(board_id));

drop policy if exists "columns_update_own" on public.columns;
create policy "columns_update_own" on public.columns
  for update using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

drop policy if exists "columns_delete_own" on public.columns;
create policy "columns_delete_own" on public.columns
  for delete using (public.can_edit_board(board_id));

-- ============================================================================
-- items — keyed by group_id
-- ============================================================================

drop policy if exists "items_select_own" on public.items;
create policy "items_select_own" on public.items
  for select using (public.can_access_board(public.group_board_id(group_id)));

drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items
  for insert with check (public.can_edit_board(public.group_board_id(group_id)));

drop policy if exists "items_update_own" on public.items;
create policy "items_update_own" on public.items
  for update using (public.can_edit_board(public.group_board_id(group_id)))
  with check (public.can_edit_board(public.group_board_id(group_id)));

drop policy if exists "items_delete_own" on public.items;
create policy "items_delete_own" on public.items
  for delete using (public.can_edit_board(public.group_board_id(group_id)));

-- ============================================================================
-- comments / activity_log / attachments — keyed by item_id
--
-- The own-row clauses (user_id/uploaded_by = auth.uid()) are now AND-ed with
-- board access rather than standing alone, so losing access to a board also
-- ends the ability to edit what you left on it.
-- ============================================================================

drop policy if exists "comments_select_own" on public.comments;
create policy "comments_select_own" on public.comments
  for select using (public.can_access_board(public.item_board_id(item_id)));

drop policy if exists "comments_insert_own" on public.comments;
create policy "comments_insert_own" on public.comments
  for insert with check (
    user_id = auth.uid() and public.can_access_board(public.item_board_id(item_id))
  );

drop policy if exists "comments_update_own" on public.comments;
create policy "comments_update_own" on public.comments
  for update using (user_id = auth.uid() and public.can_access_board(public.item_board_id(item_id)))
  with check (user_id = auth.uid() and public.can_access_board(public.item_board_id(item_id)));

drop policy if exists "comments_delete_own" on public.comments;
create policy "comments_delete_own" on public.comments
  for delete using (user_id = auth.uid() and public.can_access_board(public.item_board_id(item_id)));

drop policy if exists "activity_log_select_own" on public.activity_log;
create policy "activity_log_select_own" on public.activity_log
  for select using (public.can_access_board(public.item_board_id(item_id)));

drop policy if exists "activity_log_insert_own" on public.activity_log;
create policy "activity_log_insert_own" on public.activity_log
  for insert with check (
    actor_id = auth.uid() and public.can_access_board(public.item_board_id(item_id))
  );

drop policy if exists "attachments_select_own" on public.attachments;
create policy "attachments_select_own" on public.attachments
  for select using (public.can_access_board(public.item_board_id(item_id)));

drop policy if exists "attachments_insert_own" on public.attachments;
create policy "attachments_insert_own" on public.attachments
  for insert with check (
    uploaded_by = auth.uid() and public.can_access_board(public.item_board_id(item_id))
  );

drop policy if exists "attachments_delete_own" on public.attachments;
create policy "attachments_delete_own" on public.attachments
  for delete using (
    public.can_access_board(public.item_board_id(item_id))
    and (uploaded_by = auth.uid() or public.can_edit_board(public.item_board_id(item_id)))
  );

-- ============================================================================
-- automations / automation_runs / board_share_links
-- ============================================================================

drop policy if exists "automations_select" on public.automations;
create policy "automations_select" on public.automations
  for select using (public.can_access_board(board_id));

drop policy if exists "automations_insert" on public.automations;
create policy "automations_insert" on public.automations
  for insert with check (created_by = auth.uid() and public.can_edit_board(board_id));

drop policy if exists "automations_delete" on public.automations;
create policy "automations_delete" on public.automations
  for delete using (public.can_edit_board(board_id));

drop policy if exists "automation_runs_select" on public.automation_runs;
create policy "automation_runs_select" on public.automation_runs
  for select using (public.can_access_board(public.automation_board_id(automation_id)));

drop policy if exists "automation_runs_insert" on public.automation_runs;
create policy "automation_runs_insert" on public.automation_runs
  for insert with check (public.can_edit_board(public.automation_board_id(automation_id)));

drop policy if exists "board_share_links_select" on public.board_share_links;
create policy "board_share_links_select" on public.board_share_links
  for select using (public.can_edit_board(board_id));

drop policy if exists "board_share_links_insert" on public.board_share_links;
create policy "board_share_links_insert" on public.board_share_links
  for insert with check (created_by = auth.uid() and public.can_edit_board(board_id));

drop policy if exists "board_share_links_update" on public.board_share_links;
create policy "board_share_links_update" on public.board_share_links
  for update using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

drop policy if exists "board_share_links_delete" on public.board_share_links;
create policy "board_share_links_delete" on public.board_share_links
  for delete using (public.can_edit_board(board_id));

-- ============================================================================
-- linked_items — a cross-board join table, so both ends are checked. Without
-- the target-side check a restricted member could link to (and thereby read
-- the title of) an item on a board they can't open.
-- ============================================================================

drop policy if exists "linked_items_select" on public.linked_items;
create policy "linked_items_select" on public.linked_items
  for select using (public.can_access_board(public.item_board_id(source_item_id)));

drop policy if exists "linked_items_insert" on public.linked_items;
create policy "linked_items_insert" on public.linked_items
  for insert with check (
    public.item_workspace_id(source_item_id) = public.item_workspace_id(target_item_id)
    and public.can_edit_board(public.item_board_id(source_item_id))
    and public.can_access_board(public.item_board_id(target_item_id))
  );

drop policy if exists "linked_items_delete" on public.linked_items;
create policy "linked_items_delete" on public.linked_items
  for delete using (public.can_edit_board(public.item_board_id(source_item_id)));

-- ============================================================================
-- Module feature gating — inventory / attendance / sales
-- ============================================================================

-- inventory
drop policy if exists "inventory_locations_select" on public.inventory_locations;
create policy "inventory_locations_select" on public.inventory_locations
  for select using (public.can_view_module(workspace_id, 'inventory'));

drop policy if exists "inventory_locations_insert" on public.inventory_locations;
create policy "inventory_locations_insert" on public.inventory_locations
  for insert with check (public.can_edit_module(workspace_id, 'inventory'));

drop policy if exists "inventory_locations_update" on public.inventory_locations;
create policy "inventory_locations_update" on public.inventory_locations
  for update using (public.can_edit_module(workspace_id, 'inventory'))
  with check (public.can_edit_module(workspace_id, 'inventory'));

drop policy if exists "inventory_locations_delete" on public.inventory_locations;
create policy "inventory_locations_delete" on public.inventory_locations
  for delete using (public.can_edit_module(workspace_id, 'inventory'));

drop policy if exists "inventory_items_select" on public.inventory_items;
create policy "inventory_items_select" on public.inventory_items
  for select using (public.can_view_module(workspace_id, 'inventory'));

drop policy if exists "inventory_items_insert" on public.inventory_items;
create policy "inventory_items_insert" on public.inventory_items
  for insert with check (public.can_edit_module(workspace_id, 'inventory'));

drop policy if exists "inventory_items_update" on public.inventory_items;
create policy "inventory_items_update" on public.inventory_items
  for update using (public.can_edit_module(workspace_id, 'inventory'))
  with check (public.can_edit_module(workspace_id, 'inventory'));

drop policy if exists "inventory_items_delete" on public.inventory_items;
create policy "inventory_items_delete" on public.inventory_items
  for delete using (public.can_edit_module(workspace_id, 'inventory'));

drop policy if exists "inventory_stock_select" on public.inventory_stock;
create policy "inventory_stock_select" on public.inventory_stock
  for select using (public.can_view_module(public.inventory_item_workspace_id(item_id), 'inventory'));

drop policy if exists "inventory_stock_insert" on public.inventory_stock;
create policy "inventory_stock_insert" on public.inventory_stock
  for insert with check (
    public.can_edit_module(public.inventory_item_workspace_id(item_id), 'inventory')
    and public.inventory_item_workspace_id(item_id) = (
      select workspace_id from public.inventory_locations where id = location_id
    )
  );

drop policy if exists "inventory_stock_update" on public.inventory_stock;
create policy "inventory_stock_update" on public.inventory_stock
  for update using (public.can_edit_module(public.inventory_item_workspace_id(item_id), 'inventory'))
  with check (
    public.can_edit_module(public.inventory_item_workspace_id(item_id), 'inventory')
    and public.inventory_item_workspace_id(item_id) = (
      select workspace_id from public.inventory_locations where id = location_id
    )
  );

drop policy if exists "inventory_stock_delete" on public.inventory_stock;
create policy "inventory_stock_delete" on public.inventory_stock
  for delete using (public.can_edit_module(public.inventory_item_workspace_id(item_id), 'inventory'));

drop policy if exists "inventory_stock_movements_select" on public.inventory_stock_movements;
create policy "inventory_stock_movements_select" on public.inventory_stock_movements
  for select using (public.can_view_module(public.inventory_item_workspace_id(item_id), 'inventory'));

drop policy if exists "inventory_stock_movements_insert" on public.inventory_stock_movements;
create policy "inventory_stock_movements_insert" on public.inventory_stock_movements
  for insert with check (
    created_by = auth.uid()
    and public.can_edit_module(public.inventory_item_workspace_id(item_id), 'inventory')
  );

drop policy if exists "inventory_photos_select" on public.inventory_photos;
create policy "inventory_photos_select" on public.inventory_photos
  for select using (public.can_view_module(public.inventory_item_workspace_id(item_id), 'inventory'));

drop policy if exists "inventory_photos_insert" on public.inventory_photos;
create policy "inventory_photos_insert" on public.inventory_photos
  for insert with check (
    uploaded_by = auth.uid()
    and public.can_view_module(public.inventory_item_workspace_id(item_id), 'inventory')
  );

drop policy if exists "inventory_photos_delete" on public.inventory_photos;
create policy "inventory_photos_delete" on public.inventory_photos
  for delete using (
    public.can_view_module(public.inventory_item_workspace_id(item_id), 'inventory')
    and (
      uploaded_by = auth.uid()
      or public.can_edit_module(public.inventory_item_workspace_id(item_id), 'inventory')
    )
  );

-- attendance — keeps the existing "own punches, or everyone's if owner" rule
-- and adds the feature gate on top.
drop policy if exists "attendance_records_select" on public.attendance_records;
create policy "attendance_records_select" on public.attendance_records
  for select using (
    public.can_view_module(workspace_id, 'attendance')
    and (user_id = auth.uid() or public.workspace_member_role(workspace_id, auth.uid()) = 'owner')
  );

drop policy if exists "attendance_records_insert" on public.attendance_records;
create policy "attendance_records_insert" on public.attendance_records
  for insert with check (user_id = auth.uid() and public.can_view_module(workspace_id, 'attendance'));

drop policy if exists "attendance_records_update" on public.attendance_records;
create policy "attendance_records_update" on public.attendance_records
  for update using (user_id = auth.uid() and public.can_view_module(workspace_id, 'attendance'))
  with check (user_id = auth.uid() and public.can_view_module(workspace_id, 'attendance'));

-- sales
drop policy if exists "sales_companies_select" on public.sales_companies;
create policy "sales_companies_select" on public.sales_companies
  for select using (public.can_view_module(workspace_id, 'sales'));

drop policy if exists "sales_companies_insert" on public.sales_companies;
create policy "sales_companies_insert" on public.sales_companies
  for insert with check (public.can_edit_module(workspace_id, 'sales'));

drop policy if exists "sales_companies_update" on public.sales_companies;
create policy "sales_companies_update" on public.sales_companies
  for update using (public.can_edit_module(workspace_id, 'sales'))
  with check (public.can_edit_module(workspace_id, 'sales'));

drop policy if exists "sales_contacts_select" on public.sales_contacts;
create policy "sales_contacts_select" on public.sales_contacts
  for select using (public.can_view_module(public.sales_company_workspace_id(company_id), 'sales'));

drop policy if exists "sales_contacts_insert" on public.sales_contacts;
create policy "sales_contacts_insert" on public.sales_contacts
  for insert with check (public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales'));

drop policy if exists "sales_contacts_update" on public.sales_contacts;
create policy "sales_contacts_update" on public.sales_contacts
  for update using (public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales'))
  with check (public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales'));

drop policy if exists "sales_contacts_delete" on public.sales_contacts;
create policy "sales_contacts_delete" on public.sales_contacts
  for delete using (public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales'));

drop policy if exists "sales_deals_select" on public.sales_deals;
create policy "sales_deals_select" on public.sales_deals
  for select using (public.can_view_module(workspace_id, 'sales'));

drop policy if exists "sales_deals_insert" on public.sales_deals;
create policy "sales_deals_insert" on public.sales_deals
  for insert with check (
    public.can_edit_module(workspace_id, 'sales')
    and workspace_id = public.sales_company_workspace_id(company_id)
  );

drop policy if exists "sales_deals_update" on public.sales_deals;
create policy "sales_deals_update" on public.sales_deals
  for update using (public.can_edit_module(workspace_id, 'sales'))
  with check (
    public.can_edit_module(workspace_id, 'sales')
    and workspace_id = public.sales_company_workspace_id(company_id)
  );

drop policy if exists "sales_deals_delete" on public.sales_deals;
create policy "sales_deals_delete" on public.sales_deals
  for delete using (public.can_edit_module(workspace_id, 'sales'));

drop policy if exists "sales_quotations_select" on public.sales_quotations;
create policy "sales_quotations_select" on public.sales_quotations
  for select using (public.can_view_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_quotations_insert" on public.sales_quotations;
create policy "sales_quotations_insert" on public.sales_quotations
  for insert with check (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_quotations_update" on public.sales_quotations;
create policy "sales_quotations_update" on public.sales_quotations
  for update using (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'))
  with check (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_quotations_delete" on public.sales_quotations;
create policy "sales_quotations_delete" on public.sales_quotations
  for delete using (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_site_visits_select" on public.sales_site_visits;
create policy "sales_site_visits_select" on public.sales_site_visits
  for select using (public.can_view_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_site_visits_insert" on public.sales_site_visits;
create policy "sales_site_visits_insert" on public.sales_site_visits
  for insert with check (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_site_visits_update" on public.sales_site_visits;
create policy "sales_site_visits_update" on public.sales_site_visits
  for update using (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'))
  with check (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_site_visits_delete" on public.sales_site_visits;
create policy "sales_site_visits_delete" on public.sales_site_visits
  for delete using (public.can_edit_module(public.sales_deal_workspace_id(deal_id), 'sales'));

drop policy if exists "sales_activities_select" on public.sales_activities;
create policy "sales_activities_select" on public.sales_activities
  for select using (public.can_view_module(public.sales_company_workspace_id(company_id), 'sales'));

drop policy if exists "sales_activities_insert" on public.sales_activities;
create policy "sales_activities_insert" on public.sales_activities
  for insert with check (
    created_by = auth.uid()
    and public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales')
    and (deal_id is null or public.sales_deal_company_id(deal_id) = company_id)
  );

drop policy if exists "sales_activities_update" on public.sales_activities;
create policy "sales_activities_update" on public.sales_activities
  for update using (
    created_by = auth.uid()
    and public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales')
  ) with check (
    created_by = auth.uid()
    and public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales')
    and (deal_id is null or public.sales_deal_company_id(deal_id) = company_id)
  );

drop policy if exists "sales_activities_delete" on public.sales_activities;
create policy "sales_activities_delete" on public.sales_activities
  for delete using (
    public.can_view_module(public.sales_company_workspace_id(company_id), 'sales')
    and (
      created_by = auth.uid()
      or public.can_edit_module(public.sales_company_workspace_id(company_id), 'sales')
    )
  );

drop policy if exists "sales_tasks_select" on public.sales_tasks;
create policy "sales_tasks_select" on public.sales_tasks
  for select using (public.can_view_module(workspace_id, 'sales'));

drop policy if exists "sales_tasks_insert" on public.sales_tasks;
create policy "sales_tasks_insert" on public.sales_tasks
  for insert with check (
    public.can_edit_module(workspace_id, 'sales')
    and (company_id is null or workspace_id = public.sales_company_workspace_id(company_id))
    and (deal_id is null or workspace_id = public.sales_deal_workspace_id(deal_id))
  );

drop policy if exists "sales_tasks_update" on public.sales_tasks;
create policy "sales_tasks_update" on public.sales_tasks
  for update using (public.can_edit_module(workspace_id, 'sales'))
  with check (
    public.can_edit_module(workspace_id, 'sales')
    and (company_id is null or workspace_id = public.sales_company_workspace_id(company_id))
    and (deal_id is null or workspace_id = public.sales_deal_workspace_id(deal_id))
  );

drop policy if exists "sales_tasks_delete" on public.sales_tasks;
create policy "sales_tasks_delete" on public.sales_tasks
  for delete using (public.can_edit_module(workspace_id, 'sales'));

-- ============================================================================
-- Storage
--
-- Attachment object paths are {workspace_id}/{item_id}/{uuid}-{filename}, so
-- folder[2] resolves to the board. Delete additionally tolerates a null board
-- (the item is already gone) so orphaned objects stay cleanable.
-- ============================================================================

drop policy if exists "attachments_storage_select" on storage.objects;
create policy "attachments_storage_select" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and public.can_access_board(public.item_board_id((storage.foldername(name))[2]::uuid))
  );

drop policy if exists "attachments_storage_insert" on storage.objects;
create policy "attachments_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and public.can_access_board(public.item_board_id((storage.foldername(name))[2]::uuid))
  );

drop policy if exists "attachments_storage_delete" on storage.objects;
create policy "attachments_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
    and (
      public.item_board_id((storage.foldername(name))[2]::uuid) is null
      or public.can_access_board(public.item_board_id((storage.foldername(name))[2]::uuid))
    )
  );

drop policy if exists "inventory_photos_storage_select" on storage.objects;
create policy "inventory_photos_storage_select" on storage.objects
  for select using (
    bucket_id = 'inventory-photos'
    and public.can_view_module((storage.foldername(name))[1]::uuid, 'inventory')
  );

drop policy if exists "inventory_photos_storage_insert" on storage.objects;
create policy "inventory_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'inventory-photos'
    and public.can_view_module((storage.foldername(name))[1]::uuid, 'inventory')
  );

drop policy if exists "inventory_photos_storage_delete" on storage.objects;
create policy "inventory_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'inventory-photos'
    and public.can_view_module((storage.foldername(name))[1]::uuid, 'inventory')
    and (owner = auth.uid() or public.can_edit_module((storage.foldername(name))[1]::uuid, 'inventory'))
  );
