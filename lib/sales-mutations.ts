import { createClient } from '@/utils/supabase/client';
import { createNotification } from '@/lib/notifications';
import { isClosedStage, isLostStage } from '@/lib/sales-stages';
import type {
  SalesActivity,
  SalesCompany,
  SalesContact,
  SalesDeal,
  SalesDealDetail,
  SalesQuotation,
  SalesSiteVisit,
  SalesStage,
  SalesTask,
} from '@/types/database';

const supabase = createClient();

// Postgres unique-violation. The company name index is case-insensitive, so
// this is the one conflict a user can hit by typing rather than by racing.
const UNIQUE_VIOLATION = '23505';

// ============================================================================
// Companies
// ============================================================================

export type SalesCompanyInput = Pick<
  SalesCompany,
  'name' | 'industry' | 'website' | 'email' | 'phone' | 'address' | 'city' | 'country' | 'tax_id' | 'notes' | 'owner_id'
>;

export async function createSalesCompany(workspaceId: string, input: SalesCompanyInput): Promise<SalesCompany> {
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sales_companies')
    .insert({ ...input, workspace_id: workspaceId, created_by: auth.user?.id ?? null })
    .select()
    .single();

  if (error?.code === UNIQUE_VIOLATION) {
    throw new Error(`A company named "${input.name}" already exists in this workspace.`);
  }
  if (error || !data) throw error;
  return data;
}

export async function updateSalesCompany(
  companyId: string,
  patch: Partial<SalesCompanyInput>
): Promise<SalesCompany> {
  const { data, error } = await supabase
    .from('sales_companies')
    .update(patch)
    .eq('id', companyId)
    .select()
    .single();

  if (error?.code === UNIQUE_VIOLATION) {
    throw new Error(`A company named "${patch.name}" already exists in this workspace.`);
  }
  if (error || !data) throw error;
  return data;
}

export async function deleteSalesCompany(companyId: string): Promise<void> {
  const { error } = await supabase.from('sales_companies').delete().eq('id', companyId);
  if (error) throw error;
}

// Backs the deal form's "type a customer name to create it" combobox.
// Mirrors findOrCreateLocation in lib/inventory-mutations.ts, including the
// re-select on a unique-name race with another tab or user.
export async function findOrCreateSalesCompany(workspaceId: string, name: string): Promise<SalesCompany> {
  const trimmed = name.trim();

  const { data: existing, error: findError } = await supabase
    .from('sales_companies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('name', trimmed)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data: auth } = await supabase.auth.getUser();
  const { data: created, error: createError } = await supabase
    .from('sales_companies')
    .insert({ workspace_id: workspaceId, name: trimmed, created_by: auth.user?.id ?? null })
    .select()
    .single();
  if (created) return created;

  const { data: afterConflict, error: reselectError } = await supabase
    .from('sales_companies')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('name', trimmed)
    .maybeSingle();
  if (reselectError || !afterConflict) throw createError;
  return afterConflict;
}

// ============================================================================
// Contacts
// ============================================================================

export type SalesContactInput = Pick<
  SalesContact,
  'name' | 'position' | 'email' | 'phone' | 'is_primary' | 'notes'
>;

export async function createSalesContact(companyId: string, input: SalesContactInput): Promise<SalesContact> {
  const { data: auth } = await supabase.auth.getUser();

  // sales_contacts_one_primary_idx is a partial unique index, so promoting a
  // new primary has to demote the old one first or the insert is rejected.
  if (input.is_primary) await clearPrimaryContact(companyId);

  const { data, error } = await supabase
    .from('sales_contacts')
    .insert({ ...input, company_id: companyId, created_by: auth.user?.id ?? null })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function updateSalesContact(
  contactId: string,
  companyId: string,
  patch: Partial<SalesContactInput>
): Promise<SalesContact> {
  if (patch.is_primary) await clearPrimaryContact(companyId, contactId);

  const { data, error } = await supabase
    .from('sales_contacts')
    .update(patch)
    .eq('id', contactId)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function deleteSalesContact(contactId: string): Promise<void> {
  const { error } = await supabase.from('sales_contacts').delete().eq('id', contactId);
  if (error) throw error;
}

async function clearPrimaryContact(companyId: string, exceptContactId?: string): Promise<void> {
  let query = supabase.from('sales_contacts').update({ is_primary: false }).eq('company_id', companyId).eq('is_primary', true);
  if (exceptContactId) query = query.neq('id', exceptContactId);
  const { error } = await query;
  if (error) throw error;
}

// ============================================================================
// Deals
// ============================================================================

export type SalesDealInput = Pick<
  SalesDeal,
  | 'company_id'
  | 'contact_id'
  | 'title'
  | 'reference_no'
  | 'stage'
  | 'value'
  | 'currency'
  | 'source'
  | 'expected_order_date'
  | 'next_follow_up_on'
  | 'owner_id'
  | 'lost_reason'
  | 'description'
>;

/**
 * The closed_at / lost_reason bookkeeping that has to happen whenever a deal
 * changes stage. Both entry points — dragging a card between board columns
 * and picking a stage in the deal form — derive their patch from here, so the
 * two can't drift apart.
 */
export function stageTransitionPatch(
  deal: SalesDeal,
  stage: SalesStage,
  lostReason?: string | null
): { stage: SalesStage; closed_at: string | null; lost_reason: string | null } {
  const wasClosed = isClosedStage(deal.stage);
  const nowClosed = isClosedStage(stage);

  return {
    stage,
    // Stamped on the open→closed transition, preserved while the deal moves
    // between the post-win stages, cleared when it reopens.
    closed_at: nowClosed ? (wasClosed ? deal.closed_at : new Date().toISOString()) : null,
    // A reopened deal keeps no stale reason for a loss that got reversed.
    lost_reason: isLostStage(stage) ? (lostReason ?? deal.lost_reason) : null,
  };
}

export async function createSalesDeal(
  workspaceId: string,
  workspaceName: string,
  input: SalesDealInput
): Promise<SalesDeal> {
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sales_deals')
    .insert({
      ...input,
      workspace_id: workspaceId,
      created_by: auth.user?.id ?? null,
      closed_at: isClosedStage(input.stage) ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error || !data) throw error;

  await notifyDealOwner(data, workspaceName, auth.user?.id ?? null);
  return data;
}

export async function updateSalesDeal(
  deal: SalesDeal,
  workspaceName: string,
  patch: Partial<SalesDealInput>
): Promise<SalesDeal> {
  // A stage change carried in an ordinary form save gets the same closed_at
  // treatment as one made by dragging the card, in the same round trip.
  const fullPatch =
    patch.stage && patch.stage !== deal.stage
      ? { ...patch, ...stageTransitionPatch(deal, patch.stage, patch.lost_reason) }
      : patch;

  const { data, error } = await supabase
    .from('sales_deals')
    .update(fullPatch)
    .eq('id', deal.id)
    .select()
    .single();
  if (error || !data) throw error;

  const { data: auth } = await supabase.auth.getUser();
  if (patch.owner_id && patch.owner_id !== deal.owner_id) {
    await notifyDealOwner(data, workspaceName, auth.user?.id ?? null);
  }
  return data;
}

/** Drag-and-drop entry point for a stage change — see stageTransitionPatch. */
export async function moveDealToStage(
  deal: SalesDeal,
  stage: SalesStage,
  lostReason?: string | null
): Promise<SalesDeal> {
  const { data, error } = await supabase
    .from('sales_deals')
    .update(stageTransitionPatch(deal, stage, lostReason))
    .eq('id', deal.id)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function deleteSalesDeal(dealId: string): Promise<void> {
  const { error } = await supabase.from('sales_deals').delete().eq('id', dealId);
  if (error) throw error;
}

async function notifyDealOwner(deal: SalesDeal, workspaceName: string, actorId: string | null): Promise<void> {
  if (!deal.owner_id || deal.owner_id === actorId) return;
  await createNotification(deal.workspace_id, deal.owner_id, 'sales_deal_assigned', {
    deal_id: deal.id,
    deal_title: deal.title,
    workspace_id: deal.workspace_id,
    workspace_name: workspaceName,
  });
}

// ============================================================================
// Deal detail — everything hanging off one deal, loaded when its modal opens
// (client-side, like getStockMovements in lib/inventory-mutations.ts) rather
// than eagerly on the pipeline page for every card.
// ============================================================================

export async function getDealDetail(dealId: string, companyId: string): Promise<SalesDealDetail> {
  const [quotations, siteVisits, activities, tasks] = await Promise.all([
    supabase.from('sales_quotations').select('*').eq('deal_id', dealId).order('created_at', { ascending: false }),
    supabase.from('sales_site_visits').select('*').eq('deal_id', dealId).order('scheduled_at', { ascending: false }),
    supabase
      .from('sales_activities')
      .select('*')
      .eq('company_id', companyId)
      .eq('deal_id', dealId)
      .order('occurred_at', { ascending: false }),
    supabase
      .from('sales_tasks')
      .select('*')
      .eq('deal_id', dealId)
      .order('done_at', { ascending: true, nullsFirst: true })
      .order('due_at', { ascending: true, nullsFirst: false }),
  ]);

  const firstError = quotations.error ?? siteVisits.error ?? activities.error ?? tasks.error;
  if (firstError) throw firstError;

  return {
    quotations: quotations.data ?? [],
    siteVisits: siteVisits.data ?? [],
    activities: activities.data ?? [],
    tasks: tasks.data ?? [],
  };
}

// ============================================================================
// Quotations
// ============================================================================

export type SalesQuotationInput = Pick<
  SalesQuotation,
  'quote_number' | 'revision' | 'amount' | 'currency' | 'status' | 'submitted_on' | 'valid_until' | 'notes'
>;

export async function createSalesQuotation(
  dealId: string,
  input: SalesQuotationInput
): Promise<SalesQuotation> {
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sales_quotations')
    .insert({ ...input, deal_id: dealId, created_by: auth.user?.id ?? null })
    .select()
    .single();

  if (error?.code === UNIQUE_VIOLATION) {
    throw new Error(`Quotation ${input.quote_number} rev. ${input.revision} already exists on this deal.`);
  }
  if (error || !data) throw error;
  return data;
}

export async function updateSalesQuotation(
  quotationId: string,
  patch: Partial<SalesQuotationInput>
): Promise<SalesQuotation> {
  const { data, error } = await supabase
    .from('sales_quotations')
    .update(patch)
    .eq('id', quotationId)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function deleteSalesQuotation(quotationId: string): Promise<void> {
  const { error } = await supabase.from('sales_quotations').delete().eq('id', quotationId);
  if (error) throw error;
}

// ============================================================================
// Site visits
// ============================================================================

export type SalesSiteVisitInput = Pick<
  SalesSiteVisit,
  'scheduled_at' | 'completed_at' | 'site_address' | 'findings'
>;

export async function createSalesSiteVisit(
  dealId: string,
  input: SalesSiteVisitInput
): Promise<SalesSiteVisit> {
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sales_site_visits')
    .insert({ ...input, deal_id: dealId, created_by: auth.user?.id ?? null })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function updateSalesSiteVisit(
  visitId: string,
  patch: Partial<SalesSiteVisitInput>
): Promise<SalesSiteVisit> {
  const { data, error } = await supabase
    .from('sales_site_visits')
    .update(patch)
    .eq('id', visitId)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function deleteSalesSiteVisit(visitId: string): Promise<void> {
  const { error } = await supabase.from('sales_site_visits').delete().eq('id', visitId);
  if (error) throw error;
}

// ============================================================================
// Activities — the communication log
// ============================================================================

export type SalesActivityInput = Pick<
  SalesActivity,
  'deal_id' | 'type' | 'direction' | 'subject' | 'body' | 'occurred_at'
>;

export async function createSalesActivity(
  companyId: string,
  input: SalesActivityInput
): Promise<SalesActivity> {
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sales_activities')
    .insert({ ...input, company_id: companyId, created_by: auth.user?.id ?? null })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function updateSalesActivity(
  activityId: string,
  patch: Partial<SalesActivityInput>
): Promise<SalesActivity> {
  const { data, error } = await supabase
    .from('sales_activities')
    .update(patch)
    .eq('id', activityId)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function deleteSalesActivity(activityId: string): Promise<void> {
  const { error } = await supabase.from('sales_activities').delete().eq('id', activityId);
  if (error) throw error;
}

// ============================================================================
// Tasks and reminders
// ============================================================================

export type SalesTaskInput = Pick<
  SalesTask,
  'company_id' | 'deal_id' | 'title' | 'details' | 'due_at' | 'assigned_to'
>;

export async function createSalesTask(
  workspaceId: string,
  workspaceName: string,
  input: SalesTaskInput
): Promise<SalesTask> {
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('sales_tasks')
    .insert({ ...input, workspace_id: workspaceId, created_by: auth.user?.id ?? null })
    .select()
    .single();
  if (error || !data) throw error;

  await notifyTaskAssignee(data, workspaceName, auth.user?.id ?? null);
  return data;
}

export async function updateSalesTask(
  task: SalesTask,
  workspaceName: string,
  patch: Partial<SalesTaskInput>
): Promise<SalesTask> {
  const { data, error } = await supabase
    .from('sales_tasks')
    .update(patch)
    .eq('id', task.id)
    .select()
    .single();
  if (error || !data) throw error;

  const { data: auth } = await supabase.auth.getUser();
  if (patch.assigned_to && patch.assigned_to !== task.assigned_to) {
    await notifyTaskAssignee(data, workspaceName, auth.user?.id ?? null);
  }
  return data;
}

export async function setSalesTaskDone(taskId: string, done: boolean): Promise<SalesTask> {
  const { data, error } = await supabase
    .from('sales_tasks')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', taskId)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function deleteSalesTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('sales_tasks').delete().eq('id', taskId);
  if (error) throw error;
}

async function notifyTaskAssignee(task: SalesTask, workspaceName: string, actorId: string | null): Promise<void> {
  if (!task.assigned_to || task.assigned_to === actorId) return;
  await createNotification(task.workspace_id, task.assigned_to, 'sales_task_assigned', {
    task_title: task.title,
    deal_id: task.deal_id,
    company_id: task.company_id,
    workspace_id: task.workspace_id,
    workspace_name: workspaceName,
  });
}
