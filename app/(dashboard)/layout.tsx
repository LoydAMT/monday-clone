import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { ensureSeedData } from '@/lib/seed';
import { getWorkspacesWithBoards } from '@/lib/queries';
import { Sidebar } from '@/components/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  await ensureSeedData(supabase, user.id);
  const workspaces = await getWorkspacesWithBoards();

  return (
    <div className="flex h-screen">
      <Sidebar workspaces={workspaces} currentUserId={user.id} />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
