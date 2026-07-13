import { createClient } from '@/utils/supabase/client';
import type { Board, Column, ColumnOptions, ColumnType, Group, Item, ItemCells } from '@/types/database';

const supabase = createClient();

export async function upsertCellData(itemId: string, cells: ItemCells) {
  const { error } = await supabase.from('items').update({ cells }).eq('id', itemId);
  if (error) throw error;
}

export async function updateItemTitle(itemId: string, title: string) {
  const { error } = await supabase.from('items').update({ title }).eq('id', itemId);
  if (error) throw error;
}

export async function createNewItem(groupId: string, position: number, title = 'New Item'): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({ group_id: groupId, title, position, cells: {} })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function createNewGroup(boardId: string, position: number, name = 'New Group'): Promise<Group> {
  const colors = ['#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#e2445c', '#66ccff'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const { data, error } = await supabase
    .from('groups')
    .insert({ board_id: boardId, name, color, position })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function createNewColumn(
  boardId: string,
  position: number,
  name: string,
  type: ColumnType,
  options: ColumnOptions = {}
): Promise<Column> {
  const { data, error } = await supabase
    .from('columns')
    .insert({ board_id: boardId, name, type, position, options })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function renameGroup(groupId: string, name: string) {
  const { error } = await supabase.from('groups').update({ name }).eq('id', groupId);
  if (error) throw error;
}

export async function createNewBoard(workspaceId: string, position: number, name = 'New Board'): Promise<Board> {
  const { data, error } = await supabase
    .from('boards')
    .insert({ workspace_id: workspaceId, name, description: '', position })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export interface ItemPositionUpdate {
  id: string;
  group_id: string;
  position: number;
}

// Persists a drag-and-drop reorder: every item whose group_id or position
// changed as a result of the drop gets written back in one round trip.
export async function updateItemPositions(updates: ItemPositionUpdate[]) {
  const results = await Promise.all(
    updates.map(({ id, group_id, position }) =>
      supabase.from('items').update({ group_id, position }).eq('id', id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
