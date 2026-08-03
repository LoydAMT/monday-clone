import { createClient } from '@/utils/supabase/client';
import type { InventoryPhoto } from '@/types/database';

const supabase = createClient();

// Not shared with lib/attachments.ts's constant — kept decoupled so the two
// upload systems can evolve independently.
export const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024;

export async function getInventoryPhotos(itemId: string): Promise<InventoryPhoto[]> {
  const { data, error } = await supabase
    .from('inventory_photos')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadInventoryPhoto(
  workspaceId: string,
  itemId: string,
  file: File
): Promise<InventoryPhoto> {
  if (file.size > MAX_PHOTO_SIZE_BYTES) throw new Error('Photos must be under 10MB.');
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded as photos.');

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const path = `${workspaceId}/${itemId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('inventory-photos').upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('inventory_photos')
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

  return data;
}

export async function deleteInventoryPhoto(photo: InventoryPhoto): Promise<void> {
  await supabase.storage.from('inventory-photos').remove([photo.storage_path]);
  const { error } = await supabase.from('inventory_photos').delete().eq('id', photo.id);
  if (error) throw error;
}

export async function getInventoryPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('inventory-photos').createSignedUrl(path, 3600);
  if (error || !data) throw error;
  return data.signedUrl;
}

// Item deletion cascades the DB rows automatically (FK on inventory_photos),
// but Postgres cascade can't reach into Storage — the caller must clean up
// the actual objects first.
export async function deleteAllInventoryPhotosForItem(itemId: string): Promise<void> {
  const { data: photos, error } = await supabase
    .from('inventory_photos')
    .select('storage_path')
    .eq('item_id', itemId);
  if (error) throw error;
  if (!photos || photos.length === 0) return;

  await supabase.storage.from('inventory-photos').remove(photos.map((p) => p.storage_path));
}
