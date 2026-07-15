import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { ensureSeedData } from '@/lib/seed';
import { getWorkspacesWithBoards } from '@/lib/queries';
import { Sidebar } from '@/components/Sidebar';
import { ProfileNameGate } from '@/components/ProfileNameGate';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  await ensureSeedData(supabase, user.id);
  const [workspaces, { data: profile }] = await Promise.all([
    getWorkspacesWithBoards(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);

  return (
    <div className="flex h-screen">
      {!profile?.full_name && <ProfileNameGate email={user.email ?? ''} />}
      <Sidebar workspaces={workspaces} currentUserId={user.id} />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
