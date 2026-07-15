import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getBoardContents, getBoardRow, getWorkspaceMembers } from '@/lib/queries';
import { BoardView } from '@/components/BoardView';

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const supabase = await createClient();
  // Middleware already ran auth.getUser() for this request (a real network
  // round trip to revalidate the JWT) and redirects unauthenticated requests
  // before this page ever renders — getSession() just reads the already-
  // validated cookie, so this doesn't need to hit the network again too.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const board = await getBoardRow(supabase, boardId);
  if (!board) notFound();

  // Contents and members only depend on the board row above, not on each
  // other, so they can load side by side instead of one after the other.
  const [contents, members] = await Promise.all([
    getBoardContents(supabase, boardId),
    getWorkspaceMembers(board.workspace_id),
  ]);

  return <BoardView initialData={{ board, ...contents }} members={members} currentUserId={session.user.id} />;
}
