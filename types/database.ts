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
  | 'timeline';

export interface StatusOption {
  label: string;
  color: string;
}

export interface ColumnOptions {
  statuses?: StatusOption[];
  tags?: StatusOption[];
  ratingMax?: number;
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
  | { type: 'timeline'; value: TimelineValue | null };

export type ItemCells = Record<string, CellValue>;

export interface Item {
  id: string;
  group_id: string;
  parent_item_id: string | null;
  title: string;
  cells: ItemCells;
  position: number;
  created_at: string;
  updated_at: string;
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

export type WorkspaceRole = 'owner' | 'member';

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
  created_at: string;
}

export interface MemberProfile {
  user_id: string;
  email: string;
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

export interface BoardData {
  board: Board;
  columns: Column[];
  groups: Group[];
  items: Item[];
}

export const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { label: 'Working on it', color: '#fdab3d' },
  { label: 'Stuck', color: '#e2445c' },
  { label: 'Done', color: '#00c875' },
];
