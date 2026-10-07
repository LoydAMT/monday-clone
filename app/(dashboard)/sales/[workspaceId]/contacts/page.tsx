import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  getSalesCompanies,
  getSalesContacts,
  getSalesDeals,
  getSalesWorkspace,
  getSalesWorkspaceMembers,
} from '@/lib/sales-queries';
import { SalesContactsView } from '@/components/SalesContactsView';
import { hasFeature } from '@/lib/permissions';

export default async function SalesContactsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  const supabase = await createClient();
  // Deals come along so each contact can show how many deals it's assigned
  // to, folded client-side like the company directory's roll-up.
  const [{ data: { session } }, workspace, members, companies, contacts, deals] = await Promise.all([
    supabase.auth.getSession(),
    getSalesWorkspace(supabase, workspaceId),
    getSalesWorkspaceMembers(supabase, workspaceId),
    getSalesCompanies(supabase, workspaceId),
    getSalesContacts(supabase, workspaceId),
    getSalesDeals(supabase, workspaceId),
  ]);
  if (!session) redirect('/login');
  if (!workspace) notFound();
  // Same 404-over-empty-module reasoning as the companies page.
  if (!hasFeature(members.find((m) => m.user_id === session.user.id), 'sales')) notFound();

  return (
    <SalesContactsView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialCompanies={companies}
      initialContacts={contacts}
      deals={deals}
      members={members}
      currentUserId={session.user.id}
    />
  );
}
