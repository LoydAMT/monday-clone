import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  getSalesCompanies,
  getSalesContacts,
  getSalesDeals,
  getSalesWorkspace,
  getSalesWorkspaceMembers,
} from '@/lib/sales-queries';
import { SalesCompaniesView } from '@/components/SalesCompaniesView';
import { hasFeature } from '@/lib/permissions';

export default async function SalesCompaniesPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  const supabase = await createClient();
  // Deals come along so the directory can show each company's open/won
  // roll-up without a per-row aggregate query — summarizeCompanyDeals folds
  // them client-side, the same way InventoryView summarizes stock rows.
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
    <SalesCompaniesView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialCompanies={companies}
      contacts={contacts}
      deals={deals}
      members={members}
      currentUserId={session.user.id}
    />
  );
}
