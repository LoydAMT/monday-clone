export type ColumnType = 'text' | 'status' | 'people' | 'date' | 'numeric';

export interface StatusOption {
  label: string;
  color: string;
}

export interface ColumnOptions {
  statuses?: StatusOption[];
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
  | { type: 'numeric'; value: number | null };

export type ItemCells = Record<string, CellValue>;

export interface Item {
  id: string;
  group_id: string;
  title: string;
  cells: ItemCells;
  position: number;
  created_at: string;
  updated_at: string;
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

export const MOCK_PEOPLE = [
  { id: 'p1', name: 'Alex Rivera', color: '#579bfc' },
  { id: 'p2', name: 'Jordan Lee', color: '#a25ddc' },
  { id: 'p3', name: 'Sam Chen', color: '#ff642e' },
  { id: 'p4', name: 'Taylor Kim', color: '#00c875' },
  { id: 'p5', name: 'Morgan Diaz', color: '#e2445c' },
];
