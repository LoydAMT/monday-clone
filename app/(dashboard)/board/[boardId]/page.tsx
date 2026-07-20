import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  getAutomations,
  getBoardContents,
  getBoardRow,
  getShareLinks,
  getSiblingBoards,
  getWorkspaceMembersForBoard,
} from '@/lib/queries';
import { BoardView } from '@/components/BoardView';

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const supabase = await createClient();
  // None of these six actually depend on each other's results — board,
  // contents, members, automations, and share links are all keyed off
  // boardId alone (members via a workspaces/boards join instead of needing
  // board.workspace_id), and the session check only needs the request's own
  // cookie (middleware already ran the real auth.getUser() round trip that
  // revalidates it). So all six go out in one batch instead of the board
  // row gating everything else behind an extra round trip.
  const [{ data: { session } }, board, contents, members, automations, shareLinks] = await Promise.all([
    supabase.auth.getSession(),
    getBoardRow(supabase, boardId),
    getBoardContents(supabase, boardId),
    getWorkspaceMembersForBoard(supabase, boardId),
    getAutomations(supabase, boardId),
    getShareLinks(supabase, boardId),
  ]);
  if (!session) redirect('/login');
  if (!board) notFound();

  // Needs board.workspace_id, so it can't join the batch above — the only
  // step left waiting on a prior query's result, same reasoning as
  // getBoardContents' own attachments/linked-records fetch.
  const siblingBoards = await getSiblingBoards(supabase, board.workspace_id, board.id);

  return (
    <BoardView
      initialData={{ board, ...contents }}
      members={members}
      currentUserId={session.user.id}
      initialAutomations={automations}
      initialShareLinks={shareLinks}
      siblingBoards={siblingBoards}
    />
  );
}
