'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ColumnType } from '@/types/database';

const TYPE_LABELS: Record<ColumnType, string> = {
  text: 'Text',
  status: 'Status',
  people: 'People',
  date: 'Date',
  numeric: 'Numeric',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  link: 'Link',
  rating: 'Rating',
  timeline: 'Timeline',
  file: 'Files',
  progress: 'Progress',
};

export function AddColumnButton({ onAdd }: { onAdd: (name: string, type: ColumnType) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, type);
    setName('');
    setType('text');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex h-full items-center justify-center border-l border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Add column"
      >
        <Plus size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Column name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. Priority"
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          />
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ColumnType)}
            className="mb-3 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            onClick={submit}
            className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
          >
            Add column
          </button>
        </div>
      )}
    </div>
  );
}
