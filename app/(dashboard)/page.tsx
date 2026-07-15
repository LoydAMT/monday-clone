import { redirect } from 'next/navigation';
import { getWorkspacesWithBoards } from '@/lib/queries';

export default async function DashboardHomePage() {
  const workspaces = await getWorkspacesWithBoards();
  const firstBoard = workspaces.flatMap((w) => w.boards)[0];

  if (firstBoard) redirect(`/board/${firstBoard.id}`);

  return (
    <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
      Create a board to get started.
    </div>
  );
}
