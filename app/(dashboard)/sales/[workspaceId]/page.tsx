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
import { hasFeature } from '@/lib/permissions';

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
  // RLS already returns nothing to a member without the sales feature, so
  // this is about showing a 404 instead of a convincingly empty module.
  if (!hasFeature(members.find((m) => m.user_id === session.user.id), 'sales')) notFound();

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
