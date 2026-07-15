import { createClient } from '@/utils/supabase/client';
import type { Attachment } from '@/types/database';
import { logActivity } from '@/lib/mutations';

const supabase = createClient();

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function getAttachments(itemId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadAttachment(workspaceId: string, itemId: string, file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error('Files must be under 10MB.');

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const path = `${workspaceId}/${itemId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      item_id: itemId,
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type || null,
      uploaded_by: auth.user.id,
    })
    .select()
    .single();
  if (error || !data) throw error;

  logActivity(itemId, 'attachment_added', { file_name: file.name });

  return data;
}

export async function deleteAttachment(attachment: Attachment) {
  await supabase.storage.from('attachments').remove([attachment.storage_path]);
  const { error } = await supabase.from('attachments').delete().eq('id', attachment.id);
  if (error) throw error;
  logActivity(attachment.item_id, 'attachment_removed', { file_name: attachment.file_name });
}

export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, 3600);
  if (error || !data) throw error;
  return data.signedUrl;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
