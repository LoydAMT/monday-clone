import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getBoardData, getWorkspaceMembers } from '@/lib/queries';
import { BoardView } from '@/components/BoardView';

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await getBoardData(boardId);
  if (!data) notFound();

  const members = await getWorkspaceMembers(data.board.workspace_id);

  return <BoardView initialData={data} members={members} currentUserId={user.id} />;
}
