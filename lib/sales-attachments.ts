import { createClient } from '@/utils/supabase/client';
import type { SalesAttachment } from '@/types/database';

const supabase = createClient();

const BUCKET = 'sales-files';

// Also enforced by the bucket's file_size_limit in 0023_sales_attachments.sql.
export const MAX_SALES_FILE_SIZE_BYTES = 10 * 1024 * 1024;

// Where a set of files hangs: one quotation, one deal's own files, or (no
// deal) everything on the company.
export interface SalesAttachmentScope {
  companyId: string;
  dealId: string | null;
  quotationId?: string | null;
}

/**
 * - quotationId: that quotation's files.
 * - dealId: the deal's own files - quotation files are listed on their
 *   quotation, not repeated here.
 * - neither: every file on the company, deal and quotation files included.
 */
export async function getSalesAttachments({
  companyId,
  dealId,
  quotationId,
}: SalesAttachmentScope): Promise<SalesAttachment[]> {
  let query = supabase
    .from('sales_attachments')
    .select('*, quotation:sales_quotations(quote_number, revision)')
    .eq('company_id', companyId);
  if (quotationId) query = query.eq('quotation_id', quotationId);
  else if (dealId) query = query.eq('deal_id', dealId).is('quotation_id', null);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** How many files each of a deal's quotations holds, for the badge on its row. */
export async function getQuotationFileCounts(dealId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('sales_attachments')
    .select('quotation_id')
    .eq('deal_id', dealId)
    .not('quotation_id', 'is', null);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.quotation_id) counts[row.quotation_id] = (counts[row.quotation_id] ?? 0) + 1;
  }
  return counts;
}

export async function uploadSalesAttachment(
  workspaceId: string,
  { companyId, dealId, quotationId = null }: SalesAttachmentScope,
  file: File
): Promise<SalesAttachment> {
  if (file.size > MAX_SALES_FILE_SIZE_BYTES) throw new Error(`"${file.name}" is over the 10MB limit.`);

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  // Storage keys reject some characters that are legal in file names (and
  // non-ASCII ones depending on the project's settings), so the key gets a
  // sanitized name while file_name keeps the original for display.
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const path = `${workspaceId}/${companyId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('sales_attachments')
    .insert({
      workspace_id: workspaceId,
      company_id: companyId,
      deal_id: dealId,
      quotation_id: quotationId,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || null,
      uploaded_by: auth.user.id,
    })
    .select()
    .single();

  if (error || !data) {
    // Don't leave an object behind that no row points at.
    await supabase.storage.from(BUCKET).remove([path]);
    throw error ?? new Error('Failed to save the file');
  }

  return data;
}

export async function deleteSalesAttachment(attachment: SalesAttachment): Promise<void> {
  const { error } = await supabase.from('sales_attachments').delete().eq('id', attachment.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([attachment.storage_path]);
}

export async function getSalesAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error('Could not open the file');
  return data.signedUrl;
}

/**
 * Deleting a quotation, deal or company cascades its sales_attachments rows, but a
 * Postgres cascade can't reach into Storage. Callers grab the paths first
 * (before the rows vanish), delete the record, and only then remove the
 * objects — so a failed delete never strands rows pointing at missing files.
 */
export async function getSalesAttachmentPaths(
  scope: { quotationId: string } | { dealId: string } | { companyId: string }
): Promise<string[]> {
  const query = supabase.from('sales_attachments').select('storage_path');
  const { data, error } = await ('quotationId' in scope
    ? query.eq('quotation_id', scope.quotationId)
    : 'dealId' in scope
      ? query.eq('deal_id', scope.dealId)
      : query.eq('company_id', scope.companyId));
  if (error) throw error;
  return (data ?? []).map((row) => row.storage_path);
}

export async function removeSalesAttachmentObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}
