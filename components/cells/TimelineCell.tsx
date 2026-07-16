'use client';

import { useEffect, useRef, useState } from 'react';
import type { TimelineValue } from '@/types/database';
import { daysBetween, today } from '@/lib/gantt';

function fmt(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysLeftInfo(end: string): { label: string; title: string } {
  const diff = daysBetween(today(), end);
  if (diff > 0) return { label: `${diff}d`, title: `${diff} day${diff === 1 ? '' : 's'} left` };
  if (diff === 0) return { label: 'Today', title: 'Due today' };
  const overdue = Math.abs(diff);
  return { label: `${overdue}d over`, title: `${overdue} day${overdue === 1 ? '' : 's'} overdue` };
}

// M/D, no leading zeros — e.g. "7/14".
function fmtNumeric(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TimelineCell({
  value,
  onChange,
  isDone = false,
}: {
  value: TimelineValue | null;
  onChange: (value: TimelineValue | null) => void;
  isDone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(value?.start ?? '');
  const [end, setEnd] = useState(value?.end ?? '');
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
    if (!start || !end) {
      onChange(null);
    } else {
      onChange({ start, end: end < start ? start : end });
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative h-full w-full">
      <button
        type="button"
        onClick={() => {
          setStart(value?.start ?? '');
          setEnd(value?.end ?? '');
          setOpen((o) => !o);
        }}
        className="flex h-full w-full items-center justify-center gap-1.5 truncate px-2 text-xs text-gray-700 hover:bg-gray-50"
      >
        {value ? (
          <>
            <span className="min-w-0 truncate">
              {fmt(value.start)} – {fmt(value.end)}
            </span>
            {isDone ? (
              <span className="shrink-0 text-[11px] font-semibold text-[#00c875]" title={`Finished ${fmtNumeric(value.end)}`}>
                {fmtNumeric(value.end)}
              </span>
            ) : (
              <span
                className="shrink-0 text-[11px] font-semibold text-red-500"
                title={daysLeftInfo(value.end).title}
              >
                {daysLeftInfo(value.end).label}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Start</label>
          <input
            autoFocus
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          />
          <label className="mb-1 block text-[11px] font-medium text-gray-500">End</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mb-3 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          />
          <button
            onClick={submit}
            className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
