'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, Filter as FilterIcon, Search, X } from 'lucide-react';
import type { Column, MemberProfile } from '@/types/database';
import { displayName } from '@/lib/avatar-color';

export interface ColumnFilter {
  columnId: string;
  values: string[];
}

export interface SortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

function filterableOptions(column: Column, members: MemberProfile[]): { value: string; label: string }[] | null {
  if (column.type === 'status') return (column.options.statuses ?? []).map((o) => ({ value: o.label, label: o.label }));
  if (column.type === 'dropdown') return (column.options.tags ?? []).map((o) => ({ value: o.label, label: o.label }));
  if (column.type === 'people') return members.map((m) => ({ value: m.user_id, label: displayName(m) }));
  return null;
}

export function BoardToolbar({
  columns,
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  members = [],
}: {
  columns: Column[];
  search: string;
  onSearchChange: (value: string) => void;
  filters: ColumnFilter[];
  onFiltersChange: (filters: ColumnFilter[]) => void;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  members?: MemberProfile[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
      <div className="relative w-full sm:w-48">
        <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search this board"
          className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#0073ea]"
        />
      </div>

      <FilterButton columns={columns} filters={filters} onFiltersChange={onFiltersChange} members={members} />
      <SortButton columns={columns} sort={sort} onSortChange={onSortChange} />

      {filters.map((filter) => {
        const column = columns.find((c) => c.id === filter.columnId);
        if (!column) return null;
        return (
          <span
            key={filter.columnId}
            className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-[#0073ea]"
          >
            {column.name}: {filter.values.join(', ')}
            <button onClick={() => onFiltersChange(filters.filter((f) => f.columnId !== filter.columnId))}>
              <X size={11} />
            </button>
          </span>
        );
      })}

      {sort && (
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-[#0073ea]">
          Sort: {columns.find((c) => c.id === sort.columnId)?.name} ({sort.direction})
          <button onClick={() => onSortChange(null)}>
            <X size={11} />
          </button>
        </span>
      )}
    </div>
  );
}

function FilterButton({
  columns,
  filters,
  onFiltersChange,
  members,
}: {
  columns: Column[];
  filters: ColumnFilter[];
  onFiltersChange: (filters: ColumnFilter[]) => void;
  members: MemberProfile[];
}) {
  const [open, setOpen] = useState(false);
  const [columnId, setColumnId] = useState(columns[0]?.id ?? '');
  const [values, setValues] = useState<string[]>([]);
  const [text, setText] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const column = columns.find((c) => c.id === columnId);
  const options = column ? filterableOptions(column, members) : null;

  function apply() {
    const applied = options ? values : text.trim() ? [text.trim()] : [];
    if (!column || applied.length === 0) return;
    onFiltersChange([...filters.filter((f) => f.columnId !== column.id), { columnId: column.id, values: applied }]);
    setValues([]);
    setText('');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <FilterIcon size={13} /> Filter
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Column</label>
          <select
            value={columnId}
            onChange={(e) => {
              setColumnId(e.target.value);
              setValues([]);
              setText('');
            }}
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {options ? (
            <div className="mb-3 max-h-40 space-y-1 overflow-y-auto">
              {options.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={values.includes(opt.value)}
                    onChange={() =>
                      setValues((prev) =>
                        prev.includes(opt.value) ? prev.filter((v) => v !== opt.value) : [...prev, opt.value]
                      )
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          ) : (
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Contains…"
              className="mb-3 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
            />
          )}

          <button onClick={apply} className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]">
            Apply filter
          </button>
        </div>
      )}
    </div>
  );
}

function SortButton({
  columns,
  sort,
  onSortChange,
}: {
  columns: Column[];
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [columnId, setColumnId] = useState(sort?.columnId ?? columns[0]?.id ?? '');
  const [direction, setDirection] = useState<'asc' | 'desc'>(sort?.direction ?? 'asc');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <ArrowDownAZ size={13} /> Sort
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Column</label>
          <select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}
            className="mb-3 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <button
            onClick={() => {
              if (!columnId) return;
              onSortChange({ columnId, direction });
              setOpen(false);
            }}
            className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
          >
            Apply sort
          </button>
        </div>
      )}
    </div>
  );
}
