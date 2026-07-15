import { createClient } from '@/utils/supabase/client';
import type { Board, Column, ColumnOptions, ColumnType, Group, Item, ItemCells, MemberProfile } from '@/types/database';
import type { BoardTemplate } from '@/lib/templates';
import { createNotification } from '@/lib/notifications';

const supabase = createClient();

export async function logActivity(itemId: string, action: string, meta: Record<string, unknown> = {}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from('activity_log').insert({ item_id: itemId, actor_id: auth.user.id, action, meta });
}

export async function inviteMember(workspaceId: string, workspaceName: string, email: string): Promise<MemberProfile> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error('No account found with that email — they need to sign up first.');

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: profile.id, role: 'member' });
  if (memberError) throw memberError;

  await createNotification(workspaceId, profile.id, 'invited_to_workspace', { workspace_name: workspaceName });

  return { user_id: profile.id, email: profile.email, role: 'member' };
}

export async function removeMember(workspaceId: string, userId: string) {
  const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw error;
}

export async function upsertCellData(itemId: string, cells: ItemCells) {
  const { error } = await supabase.from('items').update({ cells }).eq('id', itemId);
  if (error) throw error;
}

export async function updateItemTitle(itemId: string, title: string, previousTitle?: string) {
  const { error } = await supabase.from('items').update({ title }).eq('id', itemId);
  if (error) throw error;
  if (previousTitle !== undefined && previousTitle !== title) {
    logActivity(itemId, 'title_changed', { from: previousTitle, to: title });
  }
}

export async function updateBoard(boardId: string, patch: Partial<Pick<Board, 'name' | 'description'>>) {
  const { error } = await supabase.from('boards').update(patch).eq('id', boardId);
  if (error) throw error;
}

export async function updateColumnOptions(columnId: string, options: ColumnOptions) {
  const { error } = await supabase.from('columns').update({ options }).eq('id', columnId);
  if (error) throw error;
}

export async function permanentlyDeleteItem(itemId: string) {
  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function softDeleteItem(itemId: string) {
  const { error } = await supabase.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', itemId);
  if (error) throw error;
}

export async function restoreItem(itemId: string): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update({ deleted_at: null })
    .eq('id', itemId)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function createNewItem(
  groupId: string,
  position: number,
  title = 'New Item',
  parentItemId: string | null = null
): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({ group_id: groupId, title, position, cells: {}, parent_item_id: parentItemId })
    .select()
    .single();
  if (error || !data) throw error;

  if (parentItemId) {
    logActivity(parentItemId, 'subitem_added', { subitem_id: data.id, title: data.title });
  } else {
    logActivity(data.id, 'item_created');
  }

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

export async function renameColumn(columnId: string, name: string) {
  const { error } = await supabase.from('columns').update({ name }).eq('id', columnId);
  if (error) throw error;
}

export async function deleteColumn(columnId: string) {
  const { error } = await supabase.from('columns').delete().eq('id', columnId);
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

export async function deleteBoard(boardId: string) {
  const { error } = await supabase.from('boards').delete().eq('id', boardId);
  if (error) throw error;
}

export async function createBoardFromTemplate(
  workspaceId: string,
  position: number,
  template: BoardTemplate
): Promise<Board> {
  const { data: board, error: boardError } = await supabase
    .from('boards')
    .insert({ workspace_id: workspaceId, name: template.name, description: template.description, position })
    .select()
    .single();
  if (boardError || !board) throw boardError;

  await Promise.all([
    supabase
      .from('groups')
      .insert(template.groups.map((g, i) => ({ board_id: board.id, name: g.name, color: g.color, position: i }))),
    supabase.from('columns').insert(
      template.columns.map((c, i) => ({
        board_id: board.id,
        name: c.name,
        type: c.type,
        options: c.options ?? {},
        position: i,
      }))
    ),
  ]);

  return board;
}

export async function duplicateBoard(boardId: string): Promise<Board> {
  const { data: sourceBoard, error: boardError } = await supabase.from('boards').select('*').eq('id', boardId).single();
  if (boardError || !sourceBoard) throw boardError;

  const [{ data: sourceGroups }, { data: sourceColumns }] = await Promise.all([
    supabase.from('groups').select('*').eq('board_id', boardId).order('position', { ascending: true }),
    supabase.from('columns').select('*').eq('board_id', boardId).order('position', { ascending: true }),
  ]);

  const { data: newBoard, error: newBoardError } = await supabase
    .from('boards')
    .insert({
      workspace_id: sourceBoard.workspace_id,
      name: `${sourceBoard.name} (copy)`,
      description: sourceBoard.description,
      position: sourceBoard.position + 1,
    })
    .select()
    .single();
  if (newBoardError || !newBoard) throw newBoardError;

  const groupIdMap = new Map<string, string>();
  if (sourceGroups?.length) {
    const { data: newGroups, error: groupsError } = await supabase
      .from('groups')
      .insert(sourceGroups.map((g) => ({ board_id: newBoard.id, name: g.name, color: g.color, position: g.position })))
      .select();
    if (groupsError) throw groupsError;
    newGroups?.forEach((newGroup, i) => groupIdMap.set(sourceGroups[i].id, newGroup.id));
  }

  if (sourceColumns?.length) {
    const { error: columnsError } = await supabase.from('columns').insert(
      sourceColumns.map((c) => ({ board_id: newBoard.id, name: c.name, type: c.type, options: c.options, position: c.position }))
    );
    if (columnsError) throw columnsError;
  }

  const sourceGroupIds = (sourceGroups ?? []).map((g) => g.id);
  if (sourceGroupIds.length) {
    const { data: sourceItems, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .in('group_id', sourceGroupIds)
      .is('parent_item_id', null)
      .order('position', { ascending: true });
    if (itemsError) throw itemsError;

    if (sourceItems?.length) {
      const { error: insertItemsError } = await supabase.from('items').insert(
        sourceItems.map((item) => ({
          group_id: groupIdMap.get(item.group_id)!,
          title: item.title,
          cells: item.cells,
          position: item.position,
          parent_item_id: null,
        }))
      );
      if (insertItemsError) throw insertItemsError;
    }
  }

  return newBoard;
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
