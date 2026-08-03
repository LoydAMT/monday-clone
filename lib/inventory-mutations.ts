import { createClient } from '@/utils/supabase/client';
import type { InventoryItem, InventoryLocation, InventoryStock, InventoryStockMovement } from '@/types/database';
import { deleteAllInventoryPhotosForItem } from '@/lib/inventory-photos';

const supabase = createClient();

export interface InventoryLocationInput {
  locationId: string;
  locationName: string;
  quantity: number;
}

export async function createInventoryItem(
  workspaceId: string,
  input: {
    name: string;
    sku: string | null;
    category: string | null;
    description: string | null;
    unit_cost: number | null;
    reorder_point: number;
    locations: InventoryLocationInput[];
  }
): Promise<{ item: InventoryItem; stock: InventoryStock[] }> {
  const { data: auth } = await supabase.auth.getUser();

  const { data: item, error: itemError } = await supabase
    .from('inventory_items')
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      sku: input.sku,
      category: input.category,
      description: input.description,
      unit_cost: input.unit_cost,
      reorder_point: input.reorder_point,
      created_by: auth.user?.id ?? null,
    })
    .select()
    .single();
  if (itemError || !item) throw itemError;

  let stock: InventoryStock[] = [];
  if (input.locations.length > 0) {
    const { data: stockRows, error: stockError } = await supabase
      .from('inventory_stock')
      .insert(
        input.locations.map((l) => ({ item_id: item.id, location_id: l.locationId, quantity: l.quantity }))
      )
      .select();
    if (stockError || !stockRows) throw stockError;
    stock = stockRows;

    const initialMovements = input.locations.filter((l) => l.quantity !== 0);
    if (initialMovements.length > 0) {
      await supabase.from('inventory_stock_movements').insert(
        initialMovements.map((l) => ({
          item_id: item.id,
          location_id: l.locationId,
          location_name: l.locationName,
          change: l.quantity,
          reason: 'Initial stock',
          created_by: auth.user?.id ?? null,
        }))
      );
    }
  }

  return { item, stock };
}

export async function updateInventoryItem(
  itemId: string,
  patch: Partial<
    Pick<InventoryItem, 'name' | 'sku' | 'category' | 'description' | 'unit_cost' | 'reorder_point'>
  >
): Promise<void> {
  const { error } = await supabase.from('inventory_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

export async function deleteInventoryItem(item: InventoryItem): Promise<void> {
  // Cascade only removes DB rows, not the actual Storage objects — clean
  // those up first.
  await deleteAllInventoryPhotosForItem(item.id);
  const { error } = await supabase.from('inventory_items').delete().eq('id', item.id);
  if (error) throw error;
}

export async function findOrCreateLocation(workspaceId: string, name: string): Promise<InventoryLocation> {
  const trimmed = name.trim();

  const { data: existing, error: findError } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('name', trimmed)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('inventory_locations')
    .insert({ workspace_id: workspaceId, name: trimmed })
    .select()
    .single();
  if (created) return created;

  // Unique-name race: another tab/user created the same location between our
  // select and insert — re-select rather than surfacing the conflict.
  const { data: afterConflict, error: reselectError } = await supabase
    .from('inventory_locations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .ilike('name', trimmed)
    .maybeSingle();
  if (reselectError || !afterConflict) throw createError;
  return afterConflict;
}

// The single place stock quantity changes after item creation — always
// writes a paired movement row so the change is auditable.
export async function adjustStock(
  itemId: string,
  locationId: string,
  locationName: string,
  change: number,
  reason: string
): Promise<{ stock: InventoryStock; movement: InventoryStockMovement }> {
  const { data: auth } = await supabase.auth.getUser();

  const { data: current, error: currentError } = await supabase
    .from('inventory_stock')
    .select('*')
    .eq('item_id', itemId)
    .eq('location_id', locationId)
    .maybeSingle();
  if (currentError) throw currentError;

  const newQuantity = (current?.quantity ?? 0) + change;
  if (newQuantity < 0) throw new Error('Quantity cannot go below zero');

  const { data: stock, error: stockError } = await supabase
    .from('inventory_stock')
    .upsert({ item_id: itemId, location_id: locationId, quantity: newQuantity }, { onConflict: 'item_id,location_id' })
    .select()
    .single();
  if (stockError || !stock) throw stockError;

  const { data: movement, error: movementError } = await supabase
    .from('inventory_stock_movements')
    .insert({
      item_id: itemId,
      location_id: locationId,
      location_name: locationName,
      change,
      reason: reason || null,
      created_by: auth.user?.id ?? null,
    })
    .select()
    .single();
  if (movementError || !movement) throw movementError;

  return { stock, movement };
}

// Adds a location to an already-created item. Unlike adjustStock, quantity
// 0 is valid here (a location can be added before it holds any stock) — a
// movement row is only written when quantity is non-zero, since
// inventory_stock_movements.change has a `<> 0` check constraint.
export async function addStockLocation(
  itemId: string,
  locationId: string,
  locationName: string,
  quantity: number
): Promise<InventoryStock> {
  const { data: stock, error: stockError } = await supabase
    .from('inventory_stock')
    .insert({ item_id: itemId, location_id: locationId, quantity })
    .select()
    .single();
  if (stockError || !stock) throw stockError;

  if (quantity !== 0) {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('inventory_stock_movements').insert({
      item_id: itemId,
      location_id: locationId,
      location_name: locationName,
      change: quantity,
      reason: 'Initial stock',
      created_by: auth.user?.id ?? null,
    });
  }

  return stock;
}

export async function removeStockLocation(stockId: string): Promise<void> {
  const { error } = await supabase.from('inventory_stock').delete().eq('id', stockId);
  if (error) throw error;
}

export async function getStockMovements(itemId: string): Promise<InventoryStockMovement[]> {
  const { data, error } = await supabase
    .from('inventory_stock_movements')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
