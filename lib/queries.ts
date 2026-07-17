import { createClient } from '@/utils/supabase/server';
import type { Automation, Board, BoardData, BoardShareLink, Item, MemberProfile, Workspace } from '@/types/database';

export interface WorkspaceWithBoards extends Workspace {
  boards: Board[];
  members: MemberProfile[];
}

// workspace_members and profiles both reference auth.users independently (no
// FK between them), so this joins them client-side instead of via a nested
// PostgREST select — same two-query-then-stitch pattern used for boards below.
async function stitchMemberProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberRows: { workspace_id: string; user_id: string; role: MemberProfile['role'] }[]
): Promise<MemberProfile[]> {
  if (memberRows.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', memberRows.map((m) => m.user_id));
  if (profileError) throw profileError;

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return memberRows.map((m) => {
    const profile = profileById.get(m.user_id);
    return {
      user_id: m.user_id,
      email: profile?.email ?? m.user_id,
      full_name: profile?.full_name ?? null,
      role: m.role,
    };
  });
}

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

  const members = await stitchMemberProfiles(supabase, memberRows);

  const byWorkspace: Record<string, MemberProfile[]> = {};
  members.forEach((member, i) => {
    const workspaceId = memberRows[i].workspace_id;
    (byWorkspace[workspaceId] ??= []).push(member);
  });
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

// Filters workspace_members by boardId directly (workspaces!inner(boards!inner(id)))
// instead of by workspace_id, so callers don't need to fetch the board row
// first just to learn its workspace_id — lets this run in the very first
// batch of parallel queries on the board page instead of gating behind the
// board row.
export async function getWorkspaceMembersForBoard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<MemberProfile[]> {
  const { data: memberRows, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, workspaces!inner(boards!inner(id))')
    .eq('workspaces.boards.id', boardId);
  if (error) throw error;
  if (!memberRows || memberRows.length === 0) return [];

  return stitchMemberProfiles(supabase, memberRows);
}

// Split from getBoardData so callers that also need something else keyed off
// the board row (e.g. workspace_id, for fetching members) can fire that
// fetch in parallel with the rest of the board's contents instead of
// waiting for the entire board to load first.
export async function getBoardRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<Board | null> {
  const { data } = await supabase.from('boards').select('*').eq('id', boardId).single();
  return data ?? null;
}

export async function getBoardContents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<Omit<BoardData, 'board'>> {
  // items used to wait for the groups query to resolve first (fetch
  // groupIds, then fetch items in a second round trip) — filtering through
  // the groups!inner join instead lets columns/groups/items all go out in
  // the same round trip. attachments still needs itemIds first (an
  // unavoidable dependency), so it's the only step left waiting on a prior
  // query's result.
  const [{ data: columns }, { data: groups }, { data: rawItems }] = await Promise.all([
    supabase.from('columns').select('*').eq('board_id', boardId).order('position', { ascending: true }),
    supabase.from('groups').select('*').eq('board_id', boardId).order('position', { ascending: true }),
    supabase
      .from('items')
      .select('*, groups!inner(board_id)')
      .eq('groups.board_id', boardId)
      .is('parent_item_id', null)
      .is('deleted_at', null)
      .order('position', { ascending: true }),
  ]);

  // The embedded `groups` field above only exists to filter by board_id
  // server-side — strip it so the shape matches Item[] exactly.
  const items: Item[] = (rawItems ?? []).map((row) => {
    const { groups, ...item } = row;
    void groups;
    return item as Item;
  });

  const itemIds = items.map((i) => i.id);
  const { data: attachmentRows } = itemIds.length
    ? await supabase.from('attachments').select('item_id').in('item_id', itemIds)
    : { data: [] };

  const attachmentCounts: Record<string, number> = {};
  for (const row of attachmentRows ?? []) {
    attachmentCounts[row.item_id] = (attachmentCounts[row.item_id] ?? 0) + 1;
  }

  return {
    columns: columns ?? [],
    groups: groups ?? [],
    items,
    attachmentCounts,
  };
}

export async function getAutomations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<Automation[]> {
  const { data, error } = await supabase
    .from('automations')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getShareLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  boardId: string
): Promise<BoardShareLink[]> {
  const { data, error } = await supabase
    .from('board_share_links')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getBoardData(boardId: string): Promise<BoardData | null> {
  const supabase = await createClient();
  const board = await getBoardRow(supabase, boardId);
  if (!board) return null;
  const contents = await getBoardContents(supabase, boardId);
  return { board, ...contents };
}
