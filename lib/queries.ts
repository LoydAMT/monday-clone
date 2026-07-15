import { createClient } from '@/utils/supabase/server';
import type { Board, BoardData, MemberProfile, Workspace } from '@/types/database';

export interface WorkspaceWithBoards extends Workspace {
  boards: Board[];
  members: MemberProfile[];
}

// workspace_members and profiles both reference auth.users independently (no
// FK between them), so this joins them client-side instead of via a nested
// PostgREST select — same two-query-then-stitch pattern used for boards below.
async function getMembersForWorkspaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceIds: string[]
): Promise<Record<string, MemberProfile[]>> {
  if (workspaceIds.length === 0) return {};

  const { data: memberRows, error: memberError } = await supabase
    .from('workspace_members')
    .select('*')
    .in('workspace_id', workspaceIds);
  if (memberError) throw memberError;
  if (!memberRows || memberRows.length === 0) return {};

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', memberRows.map((m) => m.user_id));
  if (profileError) throw profileError;

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const byWorkspace: Record<string, MemberProfile[]> = {};
  for (const m of memberRows) {
    const profile = profileById.get(m.user_id);
    const entry: MemberProfile = {
      user_id: m.user_id,
      email: profile?.email ?? m.user_id,
      full_name: profile?.full_name ?? null,
      role: m.role,
    };
    (byWorkspace[m.workspace_id] ??= []).push(entry);
  }
  return byWorkspace;
}

export async function getWorkspacesWithBoards(): Promise<WorkspaceWithBoards[]> {
  const supabase = await createClient();

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .order('created_at', { ascending: true });

  if (!workspaces || workspaces.length === 0) return [];

  const workspaceIds = workspaces.map((w) => w.id);
  const [{ data: boards }, membersByWorkspace] = await Promise.all([
    supabase.from('boards').select('*').in('workspace_id', workspaceIds).order('position', { ascending: true }),
    getMembersForWorkspaces(supabase, workspaceIds),
  ]);

  return workspaces.map((workspace) => ({
    ...workspace,
    boards: (boards ?? []).filter((b) => b.workspace_id === workspace.id),
    members: membersByWorkspace[workspace.id] ?? [],
  }));
}

export async function getWorkspaceMembers(workspaceId: string): Promise<MemberProfile[]> {
  const supabase = await createClient();
  const byWorkspace = await getMembersForWorkspaces(supabase, [workspaceId]);
  return byWorkspace[workspaceId] ?? [];
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
        .is('parent_item_id', null)
        .is('deleted_at', null)
        .order('position', { ascending: true })
    : { data: [] };

  const itemIds = (items ?? []).map((i) => i.id);
  const { data: attachmentRows } = itemIds.length
    ? await supabase.from('attachments').select('item_id').in('item_id', itemIds)
    : { data: [] };

  const attachmentCounts: Record<string, number> = {};
  for (const row of attachmentRows ?? []) {
    attachmentCounts[row.item_id] = (attachmentCounts[row.item_id] ?? 0) + 1;
  }

  return {
    board,
    columns: columns ?? [],
    groups: groups ?? [],
    items: items ?? [],
    attachmentCounts,
  };
}
