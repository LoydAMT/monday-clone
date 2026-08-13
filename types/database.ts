export type ColumnType =
  | 'text'
  | 'status'
  | 'people'
  | 'date'
  | 'numeric'
  | 'dropdown'
  | 'checkbox'
  | 'link'
  | 'rating'
  | 'timeline'
  | 'file'
  | 'progress'
  | 'linked_record';

export interface StatusOption {
  label: string;
  color: string;
}

export interface ColumnOptions {
  statuses?: StatusOption[];
  tags?: StatusOption[];
  ratingMax?: number;
  width?: number;
  // Which board a `linked_record` column searches/links against — chosen
  // once at column creation and not editable after (see ColumnHeaderMenu,
  // which has no per-type settings precedent to hang a "change board" UI
  // off today). Not validated by RLS, same as `statuses`/`tags` above —
  // client-trusted config, not a security boundary.
  linkedBoardId?: string;
}

export interface LinkValue {
  url: string;
  text: string;
}

export interface TimelineValue {
  start: string;
  end: string;
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  position: number;
  email_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  type: ColumnType;
  options: ColumnOptions;
  position: number;
  created_at: string;
  updated_at: string;
}

export type CellValue =
  | { type: 'text'; value: string }
  | { type: 'status'; value: string }
  | { type: 'people'; value: string[] }
  | { type: 'date'; value: string | null }
  | { type: 'numeric'; value: number | null }
  | { type: 'dropdown'; value: string[] }
  | { type: 'checkbox'; value: boolean }
  | { type: 'link'; value: LinkValue | null }
  | { type: 'rating'; value: number | null }
  | { type: 'timeline'; value: TimelineValue | null }
  // File contents live in the `attachments` table, keyed by item_id; the
  // cell value itself is unused and exists only so Cell.tsx's switch on
  // cellValue.type stays exhaustive like every other column type.
  | { type: 'file'; value: null }
  | { type: 'progress'; value: number | null }
  // Same reasoning as `file` above — real data lives in the `linked_items`
  // join table (keyed by column_id + source_item_id), not in this jsonb
  // blob, since a cell can link to multiple other-board items and jsonb
  // arrays of ids would make cascade cleanup on item deletion invisible to
  // the database instead of automatic via FK.
  | { type: 'linked_record'; value: null };

export type ItemCells = Record<string, CellValue>;

export interface Item {
  id: string;
  group_id: string;
  parent_item_id: string | null;
  title: string;
  cells: ItemCells;
  position: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  item_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
}

// ============================================================================
// Inventory management — a standalone module (its own tables/routes/UI), not
// part of the board/column/item grid above.
// ============================================================================

export interface InventoryLocation {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  workspace_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  unit_cost: number | null;
  reorder_point: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryStock {
  id: string;
  item_id: string;
  location_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryStockMovement {
  id: string;
  item_id: string;
  location_id: string | null;
  location_name: string;
  change: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryPhoto {
  id: string;
  item_id: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  content_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface InventoryStockSummary {
  total: number;
  byLocation: { locationId: string; locationName: string; quantity: number }[];
}

// Mirrors public.attendance_records, which is shared with the mobile app —
// see supabase/migrations/0018_attendance.sql.
export interface AttendanceRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  work_date: string;
  time_in: string;
  time_in_original: string;
  time_in_manual: boolean;
  time_out: string | null;
  time_out_original: string | null;
  time_out_manual: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Sales / CRM — a standalone module like inventory above, with its own tables,
// routes and UI. See supabase/migrations/0019_sales.sql; the pipeline stage
// list and its ordering live in lib/sales-stages.ts.
// ============================================================================

export type SalesStage =
  | 'lead'
  | 'qualified'
  | 'site_inspection'
  | 'quotation_preparation'
  | 'quotation_submitted'
  | 'follow_up'
  | 'negotiation'
  | 'po_received'
  | 'project_awarded'
  | 'completed'
  | 'lost';

export type QuotationStatus = 'draft' | 'submitted' | 'accepted' | 'rejected' | 'expired';

export type SalesActivityType = 'email' | 'call' | 'meeting' | 'note';

export type SalesActivityDirection = 'inbound' | 'outbound';

export interface SalesCompany {
  id: string;
  workspace_id: string;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  notes: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesContact {
  id: string;
  company_id: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesDeal {
  id: string;
  workspace_id: string;
  company_id: string;
  contact_id: string | null;
  title: string;
  reference_no: string | null;
  stage: SalesStage;
  value: number | null;
  currency: string;
  source: string | null;
  expected_order_date: string | null;
  next_follow_up_on: string | null;
  owner_id: string | null;
  lost_reason: string | null;
  closed_at: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesQuotation {
  id: string;
  deal_id: string;
  quote_number: string;
  revision: number;
  amount: number;
  currency: string;
  status: QuotationStatus;
  submitted_on: string | null;
  valid_until: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesSiteVisit {
  id: string;
  deal_id: string;
  scheduled_at: string;
  completed_at: string | null;
  site_address: string | null;
  findings: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesActivity {
  id: string;
  company_id: string;
  deal_id: string | null;
  type: SalesActivityType;
  direction: SalesActivityDirection | null;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesTask {
  id: string;
  workspace_id: string;
  company_id: string | null;
  deal_id: string | null;
  title: string;
  details: string | null;
  due_at: string | null;
  assigned_to: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Per-company roll-up computed in lib/sales-queries.ts for the company
// directory, so the list doesn't have to load every deal to show its totals.
export interface SalesCompanySummary {
  dealCount: number;
  openCount: number;
  wonCount: number;
  lostCount: number;
  openValue: number;
  wonValue: number;
  // Soonest upcoming follow-up across the company's open deals, or null.
  nextFollowUpOn: string | null;
}

// Everything hanging off one deal, loaded together when its modal opens.
export interface SalesDealDetail {
  quotations: SalesQuotation[];
  siteVisits: SalesSiteVisit[];
  activities: SalesActivity[];
  tasks: SalesTask[];
}

export interface Comment {
  id: string;
  item_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  item_id: string;
  actor_id: string;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export type WorkspaceRole = 'owner' | 'member' | 'viewer';

// Which standalone modules a member may reach. Mirrors
// workspace_members.features' check constraint; see lib/permissions.ts.
export type WorkspaceFeature = 'boards' | 'inventory' | 'attendance' | 'sales';

// 'all' = every board in the workspace (the default, and how every member
// behaved before migration 0020). 'selected' = only boards granted through
// the board_members table.
export type BoardAccess = 'all' | 'selected';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  board_access: BoardAccess;
  features: WorkspaceFeature[];
  created_at: string;
}

// A single board grant, consulted only while the member's board_access is
// 'selected' — so revoking the mode restores full visibility without the
// grants having to be recreated.
export interface BoardMember {
  board_id: string;
  user_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface MemberProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  role: WorkspaceRole;
  board_access: BoardAccess;
  features: WorkspaceFeature[];
}

export interface Notification {
  id: string;
  workspace_id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export type AutomationTriggerType = 'status_changed' | 'date_passed';
export type AutomationActionType = 'notify' | 'change_status';

export interface Automation {
  id: string;
  board_id: string;
  trigger_type: AutomationTriggerType;
  trigger_column_id: string;
  trigger_value: string | null;
  action_type: AutomationActionType;
  action_column_id: string | null;
  action_value: string | null;
  action_user_id: string | null;
  created_by: string;
  created_at: string;
}

export interface BoardShareLink {
  id: string;
  board_id: string;
  token: string;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

// Forward direction — items a given cell links out to. linkId is
// linked_items.id (needed to remove the link); itemId is the target item.
export interface LinkedItemSummary {
  linkId: string;
  itemId: string;
  title: string;
}

// Reverse direction — items elsewhere (any board, any linked_record column)
// that link INTO a given item. Powers ItemDetailModal's "Linked from"
// section, computed live rather than requiring a matching column on both
// boards.
export interface ReverseLinkedItem {
  linkId: string;
  itemId: string;
  title: string;
  boardId: string;
  boardName: string;
  columnName: string;
}

export interface BoardData {
  board: Board;
  columns: Column[];
  groups: Group[];
  items: Item[];
  attachmentCounts: Record<string, number>;
  // Keyed by `${columnId}:${itemId}` rather than itemId alone — a board can
  // have more than one linked_record column (pointing at different boards),
  // so per-item keying alone would collide entries across columns.
  linkedRecordsByCell: Record<string, LinkedItemSummary[]>;
}

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { label: 'Working on it', color: '#fdab3d' },
  { label: 'Stuck', color: '#e2445c' },
  { label: 'Done', color: '#00c875' },
];
