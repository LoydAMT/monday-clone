import { createClient } from '@/utils/supabase/client';
import type {
  Automation,
  AutomationActionType,
  AutomationTriggerType,
  Board,
  BoardShareLink,
  Column,
  ColumnOptions,
  ColumnType,
  Group,
  Item,
  ItemCells,
  MemberProfile,
  WorkspaceRole,
} from '@/types/database';
import type { BoardTemplate } from '@/lib/templates';
import { createNotification } from '@/lib/notifications';

const supabase = createClient();

export async function logActivity(itemId: string, action: string, meta: Record<string, unknown> = {}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from('activity_log').insert({ item_id: itemId, actor_id: auth.user.id, action, meta });
}

export async function inviteMember(
  workspaceId: string,
  workspaceName: string,
  email: string,
  role: Extract<WorkspaceRole, 'member' | 'viewer'> = 'member'
): Promise<MemberProfile> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error('No account found with that email — they need to sign up first.');

  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: workspaceId, user_id: profile.id, role });
  if (memberError) throw memberError;

  await createNotification(workspaceId, profile.id, 'invited_to_workspace', { workspace_name: workspaceName });

  return { user_id: profile.id, email: profile.email, full_name: profile.full_name, role };
}

export async function removeMember(workspaceId: string, userId: string) {
  const { error } = await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  if (error) throw error;
}

export async function updateProfileName(fullName: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  // .select().single() forces a visible error when RLS silently matches zero
  // rows (e.g. migration 0009 not applied yet) — a bare .update() with no
  // policy in place returns no error and looks like it succeeded.
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', auth.user.id)
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Could not save your name — please try again.');
}

export async function updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole) {
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
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

export async function updateBoard(
  boardId: string,
  patch: Partial<Pick<Board, 'name' | 'description' | 'email_notifications_enabled'>>
) {
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

// Bulk version for imports — one insert round trip for all rows instead of
// one per item, since an imported spreadsheet can easily be dozens of rows.
export async function createItems(groupId: string, titles: string[], startPosition: number): Promise<Item[]> {
  if (titles.length === 0) return [];

  const { data, error } = await supabase
    .from('items')
    .insert(titles.map((title, i) => ({ group_id: groupId, title, position: startPosition + i, cells: {} })))
    .select();
  if (error || !data) throw error;

  for (const item of data) {
    logActivity(item.id, 'item_created');
  }

  return data;
}

export interface ItemUpdatePayload {
  id: string;
  title?: string;
  groupId?: string;
  cells: ItemCells;
  // Column names (not ids) that actually changed — used only for the
  // activity-log summary, so a no-op re-import doesn't need to log anything.
  changedColumnNames: string[];
}

// Board-import update path — a full `items.update` per row (title/group_id
// only included when the import actually changed them), consolidated into
// one 'imported_update' activity entry per item instead of one per changed
// column (an 8-column, 50-row import would otherwise flood the activity feed).
export async function applyItemUpdates(updates: ItemUpdatePayload[]): Promise<void> {
  if (updates.length === 0) return;

  const results = await Promise.all(
    updates.map(({ id, title, groupId, cells }) => {
      const patch: { cells: ItemCells; title?: string; group_id?: string } = { cells };
      if (title !== undefined) patch.title = title;
      if (groupId !== undefined) patch.group_id = groupId;
      return supabase.from('items').update(patch).eq('id', id);
    })
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  for (const u of updates) {
    if (u.changedColumnNames.length > 0) {
      logActivity(u.id, 'imported_update', { changed_columns: u.changedColumnNames.join(', ') });
    }
  }
}

export interface ImportedItemInput {
  group_id: string;
  parent_item_id: string | null;
  title: string;
  cells: ItemCells;
  position: number;
}

// Board-import create path — bulk insert (one round trip), carrying full
// cells/parent_item_id per row, unlike the title-only createItems used by
// the narrow per-group import.
export async function bulkCreateImportedItems(rows: ImportedItemInput[]): Promise<Item[]> {
  if (rows.length === 0) return [];

  const { data, error } = await supabase.from('items').insert(rows).select();
  if (error || !data) throw error;

  for (const item of data) {
    if (item.parent_item_id) {
      logActivity(item.parent_item_id, 'subitem_added', { subitem_id: item.id, title: item.title });
    } else {
      logActivity(item.id, 'item_created');
    }
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

export interface GroupPositionUpdate {
  id: string;
  position: number;
}

export async function updateGroupPositions(updates: GroupPositionUpdate[]) {
  const results = await Promise.all(
    updates.map(({ id, position }) => supabase.from('groups').update({ position }).eq('id', id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export interface NewAutomation {
  board_id: string;
  trigger_type: AutomationTriggerType;
  trigger_column_id: string;
  trigger_value?: string | null;
  action_type: AutomationActionType;
  action_column_id?: string | null;
  action_value?: string | null;
  action_user_id?: string | null;
}

export async function createAutomation(input: NewAutomation): Promise<Automation> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('automations')
    .insert({ ...input, created_by: auth.user.id })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function deleteAutomation(id: string) {
  const { error } = await supabase.from('automations').delete().eq('id', id);
  if (error) throw error;
}

// Which items a "date passed" automation has already fired for — checked
// before applying it again so it only ever runs once per item (see
// migration 0011's comment on automation_runs for why).
export async function getAutomationRunItemIds(automationId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('automation_runs').select('item_id').eq('automation_id', automationId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.item_id as string));
}

export async function recordAutomationRun(automationId: string, itemId: string) {
  await supabase.from('automation_runs').insert({ automation_id: automationId, item_id: itemId });
}

export async function createShareLink(boardId: string): Promise<BoardShareLink> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('board_share_links')
    .insert({ board_id: boardId, created_by: auth.user.id })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function revokeShareLink(id: string) {
  const { error } = await supabase
    .from('board_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
