'use client';

import { useRef, useState } from 'react';
import type { TimelineValue } from '@/types/database';
import { daysBetween, today } from '@/lib/gantt';
import { FloatingPanel } from '../ui/FloatingPanel';

function fmt(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// How many days the item is scheduled to take (end - start), not days
// remaining — a fixed span rather than a countdown. Colored orange before
// the start date arrives (work hasn't begun yet) and red once it has
// (started, no longer changes as the deadline approaches — isDone above
// already covers the "finished" case separately).
function durationInfo(start: string, end: string): { label: string; title: string; started: boolean } {
  const duration = daysBetween(start, end);
  const started = daysBetween(start, today()) >= 0;
  return {
    label: `${duration}d`,
    title: `${duration} day${duration === 1 ? '' : 's'} to finish — ${started ? 'started' : 'not started yet'}`,
    started,
  };
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
  const anchorRef = useRef<HTMLDivElement>(null);

  function submit() {
    if (!start || !end) {
      onChange(null);
    } else {
      onChange({ start, end: end < start ? start : end });
    }
    setOpen(false);
  }

  const duration = value ? durationInfo(value.start, value.end) : null;

  return (
    <div ref={anchorRef} className="relative h-full w-full">
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
                className={`shrink-0 text-[11px] font-semibold ${
                  duration!.started ? 'text-red-500' : 'text-[#fdab3d]'
                }`}
                title={duration!.title}
              >
                {duration!.label}
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </button>

      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        className="z-20 w-52 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
      >
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
      </FloatingPanel>
    </div>
  );
}
