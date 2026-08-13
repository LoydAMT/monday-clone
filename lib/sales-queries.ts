import { createClient } from '@/utils/supabase/server';
import { stitchMemberProfiles } from '@/lib/queries';
import type {
  MemberProfile,
  SalesActivity,
  SalesCompany,
  SalesContact,
  SalesDeal,
  SalesTask,
  Workspace,
} from '@/types/database';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function getSalesWorkspace(supabase: ServerClient, workspaceId: string): Promise<Workspace | null> {
  const { data } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single();
  return data ?? null;
}

export async function getSalesWorkspaceMembers(
  supabase: ServerClient,
  workspaceId: string
): Promise<MemberProfile[]> {
  const { data: memberRows, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, board_access, features')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  if (!memberRows || memberRows.length === 0) return [];
  return stitchMemberProfiles(supabase, memberRows);
}

export async function getSalesCompanies(supabase: ServerClient, workspaceId: string): Promise<SalesCompany[]> {
  const { data, error } = await supabase
    .from('sales_companies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSalesCompany(supabase: ServerClient, companyId: string): Promise<SalesCompany | null> {
  const { data } = await supabase.from('sales_companies').select('*').eq('id', companyId).maybeSingle();
  return data ?? null;
}

// sales_contacts has no workspace_id of its own — filter through the
// sales_companies!inner embed, the same idiom getInventoryStock uses, rather
// than fetching company ids first and paying for a second round trip.
export async function getSalesContacts(supabase: ServerClient, workspaceId: string): Promise<SalesContact[]> {
  const { data, error } = await supabase
    .from('sales_contacts')
    .select('*, sales_companies!inner(workspace_id)')
    .eq('sales_companies.workspace_id', workspaceId)
    .order('name', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { sales_companies, ...contact } = row;
    void sales_companies;
    return contact as SalesContact;
  });
}

export async function getSalesContactsForCompany(
  supabase: ServerClient,
  companyId: string
): Promise<SalesContact[]> {
  const { data, error } = await supabase
    .from('sales_contacts')
    .select('*')
    .eq('company_id', companyId)
    // Primary contact first, then alphabetical — the profile header reads the
    // first row as "the person to call".
    .order('is_primary', { ascending: false })
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getSalesDeals(supabase: ServerClient, workspaceId: string): Promise<SalesDeal[]> {
  const { data, error } = await supabase
    .from('sales_deals')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSalesDealsForCompany(supabase: ServerClient, companyId: string): Promise<SalesDeal[]> {
  const { data, error } = await supabase
    .from('sales_deals')
    .select('*')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getSalesActivitiesForCompany(
  supabase: ServerClient,
  companyId: string
): Promise<SalesActivity[]> {
  const { data, error } = await supabase
    .from('sales_activities')
    .select('*')
    .eq('company_id', companyId)
    .order('occurred_at', { ascending: false })
    // A long-running account can accumulate years of correspondence; the
    // profile shows the recent history and the deal modal shows the rest
    // scoped to its own deal.
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getSalesTasksForCompany(supabase: ServerClient, companyId: string): Promise<SalesTask[]> {
  const { data, error } = await supabase
    .from('sales_tasks')
    .select('*')
    .eq('company_id', companyId)
    // Open tasks first, then soonest due. nullsFirst: false keeps undated
    // tasks at the bottom of each half instead of at the very top.
    .order('done_at', { ascending: true, nullsFirst: true })
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}
