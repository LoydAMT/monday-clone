'use client';

import { ImageOff } from 'lucide-react';
import type { InventoryItem, InventoryStockSummary } from '@/types/database';

export function InventoryTable({
  items,
  stockByItem,
  coverPhotoUrls,
  onRowClick,
}: {
  items: InventoryItem[];
  stockByItem: Record<string, InventoryStockSummary>;
  coverPhotoUrls: Record<string, string>;
  onRowClick: (item: InventoryItem) => void;
}) {
  if (items.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-gray-400">No inventory items yet.</p>;
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
          <th className="w-12 px-2 py-2" />
          <th className="px-2 py-2">Item</th>
          <th className="px-2 py-2">Category</th>
          <th className="px-2 py-2 text-right">Quantity</th>
          <th className="px-2 py-2">Locations</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const summary = stockByItem[item.id];
          const total = summary?.total ?? 0;
          const lowStock = total <= item.reorder_point;
          const locations = summary?.byLocation ?? [];
          const visibleLocations = locations.slice(0, 3);
          const extraCount = locations.length - visibleLocations.length;
          const coverUrl = coverPhotoUrls[item.id];

          return (
            <tr
              key={item.id}
              onClick={() => onRowClick(item)}
              className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-2 py-2">
                <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded bg-gray-100">
                  {coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff size={14} className="text-gray-300" />
                  )}
                </div>
              </td>
              <td className="px-2 py-2">
                <div className="font-medium text-gray-900">{item.name}</div>
                {item.sku && <div className="text-xs text-gray-400">{item.sku}</div>}
              </td>
              <td className="px-2 py-2 text-gray-600">{item.category || '—'}</td>
              <td className="px-2 py-2 text-right">
                <span className="font-medium text-gray-900">
                  {total.toLocaleString()} {item.unit}
                </span>
                {lowStock && (
                  <span className="ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium text-white" style={{ backgroundColor: '#e2445c' }}>
                    Low stock
                  </span>
                )}
              </td>
              <td className="px-2 py-2">
                <div className="flex flex-wrap gap-1">
                  {visibleLocations.map((l) => (
                    <span key={l.locationId} className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                      {l.locationName}: {l.quantity}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span className="whitespace-nowrap rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-400">
                      +{extraCount} more
                    </span>
                  )}
                  {locations.length === 0 && <span className="text-xs text-gray-300">No stock</span>}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
