'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { Column } from '@/types/database';

export function ColumnHeaderMenu({
  column,
  onRename,
  onDelete,
}: {
  column: Column;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(column.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function commitRename() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) onRename(trimmed);
    else setName(column.name);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => {
          setName(column.name);
          setOpen((o) => !o);
        }}
        className="flex h-full items-center px-1 text-gray-300 opacity-0 hover:text-gray-600 group-hover:opacity-100"
        title="Column options"
      >
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Column name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitRename()}
            onBlur={commitRename}
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          />

          <div className="border-t border-gray-100 pt-2">
            <button
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                onDelete();
                setOpen(false);
                setConfirmingDelete(false);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                confirmingDelete ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Trash2 size={12} /> {confirmingDelete ? 'Confirm delete?' : 'Delete column'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
