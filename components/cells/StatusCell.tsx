'use client';

import { useEffect, useRef, useState } from 'react';
import type { Column } from '@/types/database';

export function StatusCell({
  column,
  value,
  onChange,
}: {
  column: Column;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = column.options.statuses ?? [];
  const current = options.find((o) => o.label === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative h-full w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-full w-full items-center justify-center px-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: current?.color ?? '#c4c4c4' }}
      >
        <span className="truncate">{current?.label ?? 'Set status'}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => {
                onChange(opt.label);
                setOpen(false);
              }}
              className="mb-1 flex w-full items-center rounded px-2 py-1.5 text-left text-xs font-medium text-white last:mb-0 hover:brightness-95"
              style={{ backgroundColor: opt.color }}
            >
              {opt.label}
            </button>
          ))}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-gray-400 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
