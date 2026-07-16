import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { ensureSeedData } from '@/lib/seed';
import { getWorkspacesWithBoards } from '@/lib/queries';
import { Sidebar } from '@/components/Sidebar';
import { ProfileNameGate } from '@/components/ProfileNameGate';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // Middleware already ran auth.getUser() for this request (a real network
  // round trip to revalidate the JWT) and redirects unauthenticated requests
  // before this layout ever renders — getSession() just reads the already-
  // validated cookie, so this doesn't need to hit the network again too.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');
  const user = session.user;

  const [initialWorkspaces, { data: profile }] = await Promise.all([
    getWorkspacesWithBoards(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ]);
  let workspaces = initialWorkspaces;

  // ensureSeedData's own insert-then-bail-on-conflict is only needed the
  // very first time a user shows up with zero workspaces — skip it (and the
  // wasted round trip) on every other navigation. Its internal atomic lock
  // still protects against two concurrent first-visits double-seeding.
  if (workspaces.length === 0) {
    await ensureSeedData(supabase, user.id);
    workspaces = await getWorkspacesWithBoards();
  }

  return (
    <div className="flex h-screen">
      {!profile?.full_name && <ProfileNameGate email={user.email ?? ''} />}
      <Sidebar workspaces={workspaces} currentUserId={user.id} />
      {/* max-md:pt-12 reserves room for Sidebar's floating mobile menu button
          so it never overlaps page content (e.g. a board's title sits right
          at the top) — scoped to max-md: (rather than pt-12 + md:pt-0) so it
          structurally can't apply once the sidebar is always visible at md+. */}
      <main className="flex flex-1 flex-col overflow-hidden max-md:pt-12">{children}</main>
    </div>
  );
}
