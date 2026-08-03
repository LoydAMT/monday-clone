'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { InventoryLocation } from '@/types/database';
import { FloatingPanel } from './ui/FloatingPanel';
import { findOrCreateLocation } from '@/lib/inventory-mutations';

export function LocationCombobox({
  workspaceId,
  locations,
  excludeLocationIds = [],
  value,
  onChange,
  onLocationCreated,
}: {
  workspaceId: string;
  locations: InventoryLocation[];
  excludeLocationIds?: string[];
  value: string | null;
  onChange: (locationId: string, locationName: string) => void;
  onLocationCreated: (location: InventoryLocation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const selected = locations.find((l) => l.id === value) ?? null;
  const available = locations.filter((l) => !excludeLocationIds.includes(l.id));
  const filtered = query.trim()
    ? available.filter((l) => l.name.toLowerCase().includes(query.trim().toLowerCase()))
    : available;
  const hasExactMatch = available.some((l) => l.name.toLowerCase() === query.trim().toLowerCase());

  function select(location: InventoryLocation) {
    onChange(location.id, location.name);
    setQuery('');
    setOpen(false);
  }

  async function createAndSelect() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const location = await findOrCreateLocation(workspaceId, name);
      onLocationCreated(location);
      select(location);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded border border-gray-300 px-2.5 py-1.5 text-left text-sm text-gray-700 outline-none focus:border-[#0073ea]"
      >
        <span className={selected ? '' : 'text-gray-400'}>{selected ? selected.name : 'Select location'}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>

      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        // Modal.tsx's wrapper is z-50 — since FloatingPanel also portals
        // straight to document.body, it becomes Modal's sibling rather than
        // its descendant, so it needs a higher z-index to paint above the
        // modal instead of underneath it.
        className="z-[60] w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !hasExactMatch && createAndSelect()}
          placeholder="Search or add location"
          className="mb-1 w-full rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
        />
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {filtered.map((location) => (
            <button
              key={location.id}
              type="button"
              onClick={() => select(location)}
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <span className="flex-1 truncate">{location.name}</span>
              {location.id === value && <span className="text-[#0073ea]">✓</span>}
            </button>
          ))}
          {filtered.length === 0 && !query.trim() && (
            <p className="px-2 py-1.5 text-xs text-gray-400">No locations yet</p>
          )}
        </div>
        {query.trim() && !hasExactMatch && (
          <button
            type="button"
            onClick={createAndSelect}
            disabled={creating}
            className="mt-1 flex w-full items-center gap-1.5 rounded border-t border-gray-100 px-2 py-1.5 text-left text-xs text-[#0073ea] hover:bg-blue-50 disabled:opacity-50"
          >
            <Plus size={12} />
            {creating ? 'Creating…' : `Create "${query.trim()}"`}
          </button>
        )}
      </FloatingPanel>
    </>
  );
}
