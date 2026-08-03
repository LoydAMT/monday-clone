import { createClient } from '@/utils/supabase/server';
import { stitchMemberProfiles } from '@/lib/queries';
import type { InventoryItem, InventoryLocation, InventoryStock, MemberProfile, Workspace } from '@/types/database';

export async function getInventoryWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<Workspace | null> {
  const { data } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single();
  return data ?? null;
}

export async function getInventoryWorkspaceMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<MemberProfile[]> {
  const { data: memberRows, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  if (!memberRows || memberRows.length === 0) return [];
  return stitchMemberProfiles(supabase, memberRows);
}

export async function getInventoryLocations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<InventoryLocation[]> {
  const { data, error } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getInventoryItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// inventory_stock has no workspace_id column of its own — filter through the
// inventory_items!inner embed (same idiom as getBoardContents' items query)
// rather than fetching item ids first and gating behind a second round trip.
export async function getInventoryStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<InventoryStock[]> {
  const { data, error } = await supabase
    .from('inventory_stock')
    .select('*, inventory_items!inner(workspace_id)')
    .eq('inventory_items.workspace_id', workspaceId);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { inventory_items, ...stock } = row;
    void inventory_items;
    return stock as InventoryStock;
  });
}

// One batched createSignedUrls call for the whole list view's thumbnails,
// rather than AttachmentsList's per-item lazy fetch — this renders
// potentially many rows at once.
export async function getInventoryCoverPhotoUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemIds: string[]
): Promise<Record<string, string>> {
  if (itemIds.length === 0) return {};

  const { data: photoRows, error } = await supabase
    .from('inventory_photos')
    .select('item_id, storage_path')
    .in('item_id', itemIds)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const coverPathByItem = new Map<string, string>();
  for (const row of photoRows ?? []) {
    if (!coverPathByItem.has(row.item_id)) coverPathByItem.set(row.item_id, row.storage_path);
  }
  if (coverPathByItem.size === 0) return {};

  const paths = Array.from(coverPathByItem.values());
  const { data: signedUrls, error: signError } = await supabase.storage
    .from('inventory-photos')
    .createSignedUrls(paths, 3600);
  if (signError) throw signError;

  const urlByPath = new Map((signedUrls ?? []).map((s) => [s.path, s.signedUrl]));

  const result: Record<string, string> = {};
  for (const [itemId, path] of coverPathByItem) {
    const url = path ? urlByPath.get(path) : undefined;
    if (url) result[itemId] = url;
  }
  return result;
}
