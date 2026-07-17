import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getAutomations, getBoardContents, getBoardRow, getShareLinks, getWorkspaceMembers } from '@/lib/queries';
import { BoardView } from '@/components/BoardView';

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const supabase = await createClient();
  // Middleware already ran auth.getUser() for this request (a real network
  // round trip to revalidate the JWT) and redirects unauthenticated requests
  // before this page ever renders — getSession() just reads the already-
  // validated cookie, so this doesn't need to hit the network again too.
  // It also doesn't depend on the board row (RLS enforces access DB-side
  // regardless), so the two run side by side instead of one after the other.
  const [{ data: { session } }, board] = await Promise.all([
    supabase.auth.getSession(),
    getBoardRow(supabase, boardId),
  ]);
  if (!session) redirect('/login');
  if (!board) notFound();

  // Contents, members, and automations only depend on the board row above,
  // not on each other, so they can load side by side instead of one after
  // the other.
  const [contents, members, automations, shareLinks] = await Promise.all([
    getBoardContents(supabase, boardId),
    getWorkspaceMembers(board.workspace_id),
    getAutomations(supabase, boardId),
    getShareLinks(supabase, boardId),
  ]);

  return (
    <BoardView
      initialData={{ board, ...contents }}
      members={members}
      currentUserId={session.user.id}
      initialAutomations={automations}
      initialShareLinks={shareLinks}
    />
  );
}
