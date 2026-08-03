'use client';

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { InventoryItem, InventoryLocation, InventoryStock, MemberProfile } from '@/types/database';
import { summarizeInventoryStock } from '@/lib/inventory-stock';
import { InventoryTable } from './InventoryTable';
import { InventoryItemModal } from './InventoryItemModal';

export function InventoryView({
  workspaceId,
  workspaceName,
  initialLocations,
  initialItems,
  initialStock,
  initialCoverPhotoUrls,
  members,
  currentUserId,
}: {
  workspaceId: string;
  workspaceName: string;
  initialLocations: InventoryLocation[];
  initialItems: InventoryItem[];
  initialStock: InventoryStock[];
  initialCoverPhotoUrls: Record<string, string>;
  members: MemberProfile[];
  currentUserId: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [locations, setLocations] = useState(initialLocations);
  const [stock, setStock] = useState(initialStock);
  const [coverPhotoUrls, setCoverPhotoUrls] = useState(initialCoverPhotoUrls);

  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  // undefined = closed, null = create mode, an item = edit mode.
  const [activeItem, setActiveItem] = useState<InventoryItem | null | undefined>(undefined);

  const canEdit = members.find((m) => m.user_id === currentUserId)?.role !== 'viewer';
  const stockByItem = useMemo(() => summarizeInventoryStock(stock, locations), [stock, locations]);

  const filteredItems = items.filter((item) => {
    const query = search.trim().toLowerCase();
    if (query && !item.name.toLowerCase().includes(query) && !item.sku?.toLowerCase().includes(query)) return false;
    if (locationFilter !== 'all') {
      const hasLocation = (stockByItem[item.id]?.byLocation ?? []).some((l) => l.locationId === locationFilter);
      if (!hasLocation) return false;
    }
    if (lowStockOnly) {
      const total = stockByItem[item.id]?.total ?? 0;
      if (total > item.reorder_point) return false;
    }
    return true;
  });

  function handleItemCreated(item: InventoryItem, newStock: InventoryStock[]) {
    setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
    setStock((prev) => [...prev, ...newStock]);
  }

  function handleItemUpdated(item: InventoryItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)).sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleItemDeleted(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setStock((prev) => prev.filter((s) => s.item_id !== itemId));
    setCoverPhotoUrls((prev) => {
      const { [itemId]: removed, ...rest } = prev;
      void removed;
      return rest;
    });
  }

  function handleStockChanged(newStock: InventoryStock) {
    setStock((prev) => prev.map((s) => (s.id === newStock.id ? newStock : s)));
  }

  function handleLocationCreated(location: InventoryLocation) {
    setLocations((prev) => [...prev, location].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleCoverPhotoChange(itemId: string, url: string | null) {
    setCoverPhotoUrls((prev) => {
      if (url) return { ...prev, [itemId]: url };
      const { [itemId]: removed, ...rest } = prev;
      void removed;
      return rest;
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Inventory</h1>
            <p className="text-sm text-gray-400">{workspaceName}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setActiveItem(null)}
              className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0060c2]"
            >
              <Plus size={14} /> New Item
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU"
            className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#0073ea]"
          />
        </div>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
        >
          <option value="all">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <InventoryTable
          items={filteredItems}
          stockByItem={stockByItem}
          coverPhotoUrls={coverPhotoUrls}
          onRowClick={(item) => setActiveItem(item)}
        />
      </div>

      {activeItem !== undefined && (
        <InventoryItemModal
          workspaceId={workspaceId}
          item={activeItem}
          locations={locations}
          stockForItem={activeItem ? stock.filter((s) => s.item_id === activeItem.id) : []}
          members={members}
          canEdit={canEdit}
          onClose={() => setActiveItem(undefined)}
          onCreated={handleItemCreated}
          onUpdated={handleItemUpdated}
          onDeleted={handleItemDeleted}
          onStockChanged={handleStockChanged}
          onLocationCreated={handleLocationCreated}
          onCoverPhotoChange={handleCoverPhotoChange}
        />
      )}
    </div>
  );
}
