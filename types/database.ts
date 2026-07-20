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

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
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
