'use client';

import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ColumnOptions, ColumnType } from '@/types/database';
import { FloatingPanel } from './ui/FloatingPanel';

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
  linked_record: 'Linked record',
};

export function AddColumnButton({
  onAdd,
  boards = [],
}: {
  onAdd: (name: string, type: ColumnType, options?: Partial<ColumnOptions>) => void;
  boards?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [linkedBoardId, setLinkedBoardId] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);

  const needsBoard = type === 'linked_record';
  const canSubmit = name.trim().length > 0 && (!needsBoard || (linkedBoardId && boards.length > 0));

  function submit() {
    const trimmed = name.trim();
    if (!trimmed || !canSubmit) return;
    onAdd(trimmed, type, needsBoard ? { linkedBoardId } : undefined);
    setName('');
    setType('text');
    setLinkedBoardId('');
    setOpen(false);
  }

  return (
    <div ref={anchorRef} className="relative flex h-full items-center justify-center border-l border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        title="Add column"
      >
        <Plus size={15} />
      </button>

      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        className="z-30 w-56 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
      >
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
            <option key={value} value={value} disabled={value === 'linked_record' && boards.length === 0}>
              {label}
              {value === 'linked_record' && boards.length === 0 ? ' (no other boards yet)' : ''}
            </option>
          ))}
        </select>

        {needsBoard && (
          <>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Link to board</label>
            <select
              value={linkedBoardId}
              onChange={(e) => setLinkedBoardId(e.target.value)}
              className="mb-3 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
            >
              <option value="" disabled>
                Choose a board…
              </option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
        >
          Add column
        </button>
      </FloatingPanel>
    </div>
  );
}
