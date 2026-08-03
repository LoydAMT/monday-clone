import type { InventoryLocation, InventoryStock, InventoryStockSummary } from '@/types/database';

// Pure aggregation with no Supabase dependency (kept out of
// lib/inventory-queries.ts, which pulls in the server-only client) — reused
// both for the initial server render and re-invoked client-side via useMemo
// after every mutation, keeping the total/per-location math in exactly one
// place.
export function summarizeInventoryStock(
  stock: InventoryStock[],
  locations: InventoryLocation[]
): Record<string, InventoryStockSummary> {
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));
  const summaries: Record<string, InventoryStockSummary> = {};

  for (const row of stock) {
    const summary = (summaries[row.item_id] ??= { total: 0, byLocation: [] });
    summary.total += row.quantity;
    summary.byLocation.push({
      locationId: row.location_id,
      locationName: locationNameById.get(row.location_id) ?? 'Unknown location',
      quantity: row.quantity,
    });
  }

  return summaries;
}
