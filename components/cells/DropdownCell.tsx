'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Column, ColumnOptions } from '@/types/database';

const TAG_COLORS = ['#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#e2445c', '#66ccff'];

export function DropdownCell({
  column,
  value,
  onChange,
  onOptionsChange,
}: {
  column: Column;
  value: string[];
  onChange: (value: string[]) => void;
  onOptionsChange: (options: ColumnOptions) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const tags = column.options.tags ?? [];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle(label: string) {
    onChange(value.includes(label) ? value.filter((v) => v !== label) : [...value, label]);
  }

  function addTag() {
    const label = draft.trim();
    if (!label || tags.some((t) => t.label === label)) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    onOptionsChange({ ...column.options, tags: [...tags, { label, color }] });
    setDraft('');
  }

  return (
    <div ref={ref} className="relative flex h-full w-full items-center gap-1 overflow-hidden px-1.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 flex-wrap items-center gap-1 py-1">
        {value.length === 0 && <span className="text-xs text-gray-300">Empty</span>}
        {tags
          .filter((t) => value.includes(t.label))
          .map((t) => (
            <span
              key={t.label}
              className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.label}
            </span>
          ))}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {tags.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => toggle(t.label)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: t.color }} />
              <span className="flex-1 truncate text-gray-700">{t.label}</span>
              {value.includes(t.label) && <span className="text-[#0073ea]">✓</span>}
            </button>
          ))}

          <div className="mt-1 flex items-center gap-1 border-t border-gray-100 p-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag()}
              placeholder="Add option"
              className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
            />
            <button
              type="button"
              onClick={addTag}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
