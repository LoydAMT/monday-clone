import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  getSalesActivitiesForCompany,
  getSalesCompany,
  getSalesContactsForCompany,
  getSalesDealsForCompany,
  getSalesTasksForCompany,
  getSalesWorkspace,
  getSalesWorkspaceMembers,
} from '@/lib/sales-queries';
import { SalesCompanyProfile } from '@/components/SalesCompanyProfile';

export default async function SalesCompanyPage({
  params,
}: {
  params: Promise<{ workspaceId: string; companyId: string }>;
}) {
  const { workspaceId, companyId } = await params;

  const supabase = await createClient();
  const [
    {
      data: { session },
    },
    workspace,
    members,
    company,
    contacts,
    deals,
    activities,
    tasks,
  ] = await Promise.all([
    supabase.auth.getSession(),
    getSalesWorkspace(supabase, workspaceId),
    getSalesWorkspaceMembers(supabase, workspaceId),
    getSalesCompany(supabase, companyId),
    getSalesContactsForCompany(supabase, companyId),
    getSalesDealsForCompany(supabase, companyId),
    getSalesActivitiesForCompany(supabase, companyId),
    getSalesTasksForCompany(supabase, companyId),
  ]);
  if (!session) redirect('/login');
  if (!workspace) notFound();
  // RLS already blocks a company in a workspace you're not a member of; this
  // additionally rejects a real company reached through the wrong workspace's
  // URL, which would otherwise render under the wrong header and tabs.
  if (!company || company.workspace_id !== workspace.id) notFound();

  return (
    <SalesCompanyProfile
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialCompany={company}
      initialContacts={contacts}
      initialDeals={deals}
      initialActivities={activities}
      initialTasks={tasks}
      members={members}
      currentUserId={session.user.id}
    />
  );
}
