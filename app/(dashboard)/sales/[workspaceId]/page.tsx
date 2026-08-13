import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  getSalesCompanies,
  getSalesContacts,
  getSalesDeals,
  getSalesWorkspace,
  getSalesWorkspaceMembers,
} from '@/lib/sales-queries';
import { SalesPipelineView } from '@/components/SalesPipelineView';

export default async function SalesPipelinePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  const supabase = await createClient();
  // None of these depend on each other's results — batched for the same
  // reason as the inventory page's Promise.all.
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

  return (
    <SalesPipelineView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialCompanies={companies}
      initialContacts={contacts}
      initialDeals={deals}
      members={members}
      currentUserId={session.user.id}
    />
  );
}
