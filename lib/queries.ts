import { createClient } from '@/utils/supabase/server';
import type { Board, BoardData, Workspace } from '@/types/database';

export interface WorkspaceWithBoards extends Workspace {
  boards: Board[];
}

export async function getWorkspacesWithBoards(): Promise<WorkspaceWithBoards[]> {
  const supabase = await createClient();

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });

  if (!workspaces || workspaces.length === 0) return [];

  const { data: boards } = await supabase
    .from('boards')
    .select('*')
    .in('workspace_id', workspaces.map((w) => w.id))
    .order('position', { ascending: true });

  return workspaces.map((workspace) => ({
    ...workspace,
    boards: (boards ?? []).filter((b) => b.workspace_id === workspace.id),
  }));
}

export async function getBoardData(boardId: string): Promise<BoardData | null> {
  const supabase = await createClient();

  const { data: board } = await supabase.from('boards').select('*').eq('id', boardId).single();
  if (!board) return null;

  const [{ data: columns }, { data: groups }] = await Promise.all([
    supabase.from('columns').select('*').eq('board_id', boardId).order('position', { ascending: true }),
    supabase.from('groups').select('*').eq('board_id', boardId).order('position', { ascending: true }),
  ]);

  const groupIds = (groups ?? []).map((g) => g.id);
  const { data: items } = groupIds.length
    ? await supabase
        .from('items')
        .select('*')
        .in('group_id', groupIds)
        .order('position', { ascending: true })
    : { data: [] };

  return {
    board,
    columns: columns ?? [],
    groups: groups ?? [],
    items: items ?? [],
  };
}
