'use client';

import { useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import type { SalesCompany } from '@/types/database';
import { FloatingPanel } from './ui/FloatingPanel';
import { findOrCreateSalesCompany } from '@/lib/sales-mutations';

// Same shape as LocationCombobox — search the existing customers, or type a
// name that doesn't exist yet and create it inline, so logging a brand-new
// inquiry doesn't force a detour through the companies page first.
export function SalesCompanyCombobox({
  workspaceId,
  companies,
  value,
  disabled,
  onChange,
  onCompanyCreated,
}: {
  workspaceId: string;
  companies: SalesCompany[];
  value: string | null;
  disabled?: boolean;
  onChange: (companyId: string) => void;
  onCompanyCreated: (company: SalesCompany) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const selected = companies.find((c) => c.id === value) ?? null;
  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? companies.filter((c) => c.name.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : companies;
  const hasExactMatch = companies.some((c) => c.name.toLowerCase() === trimmedQuery.toLowerCase());

  function select(company: SalesCompany) {
    onChange(company.id);
    setQuery('');
    setOpen(false);
  }

  async function createAndSelect() {
    if (!trimmedQuery || creating) return;
    setCreating(true);
    setError(null);
    try {
      const company = await findOrCreateSalesCompany(workspaceId, trimmedQuery);
      onCompanyCreated(company);
      select(company);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create company');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1.5 rounded border border-gray-300 px-2 py-1.5 text-left text-sm text-gray-700 outline-none focus:border-[#0073ea] disabled:bg-gray-50 disabled:text-gray-500"
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>{selected ? selected.name : 'Select customer'}</span>
        <ChevronDown size={14} className="shrink-0 text-gray-400" />
      </button>

      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        // z-[60] for the reason spelled out in LocationCombobox — FloatingPanel
        // portals to document.body, so it's Modal's sibling, not its child.
        className="z-[60] w-64 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !hasExactMatch && createAndSelect()}
          placeholder="Search or add a customer"
          className="mb-1 w-full rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
        />
        <div className="max-h-48 space-y-0.5 overflow-y-auto">
          {filtered.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => select(company)}
              className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              <span className="flex-1 truncate">{company.name}</span>
              {company.id === value && <span className="text-[#0073ea]">✓</span>}
            </button>
          ))}
          {filtered.length === 0 && !trimmedQuery && <p className="px-2 py-1.5 text-xs text-gray-400">No customers yet</p>}
        </div>

        {error && <p className="px-2 py-1 text-[11px] text-red-500">{error}</p>}

        {trimmedQuery && !hasExactMatch && (
          <button
            type="button"
            onClick={createAndSelect}
            disabled={creating}
            className="mt-1 flex w-full items-center gap-1.5 rounded border-t border-gray-100 px-2 py-1.5 text-left text-xs text-[#0073ea] hover:bg-blue-50 disabled:opacity-50"
          >
            <Plus size={12} />
            {creating ? 'Creating…' : `Create "${trimmedQuery}"`}
          </button>
        )}
      </FloatingPanel>
    </>
  );
}
