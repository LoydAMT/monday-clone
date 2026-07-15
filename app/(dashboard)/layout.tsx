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
      {/* pt-12 reserves room for Sidebar's floating mobile menu button so it
          never overlaps page content (e.g. a board's title sits right at the
          top) — not needed once the sidebar is always visible at md+. */}
      <main className="flex flex-1 flex-col overflow-hidden pt-12 md:pt-0">{children}</main>
    </div>
  );
}
