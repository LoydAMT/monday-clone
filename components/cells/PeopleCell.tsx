'use client';

import { useEffect, useRef, useState } from 'react';
import { MOCK_PEOPLE } from '@/types/database';

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function PeopleCell({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const assigned = MOCK_PEOPLE.filter((p) => value.includes(p.id));

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={ref} className="relative flex h-full w-full items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center -space-x-2 rounded px-1 py-1 hover:bg-gray-50"
      >
        {assigned.length === 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-300">
            +
          </span>
        )}
        {assigned.map((p) => (
          <span
            key={p.id}
            title={p.name}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white"
            style={{ backgroundColor: p.color }}
          >
            {initials(p.name)}
          </span>
        ))}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {MOCK_PEOPLE.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50"
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                style={{ backgroundColor: p.color }}
              >
                {initials(p.name)}
              </span>
              <span className="flex-1 text-gray-700">{p.name}</span>
              {value.includes(p.id) && <span className="text-[#0073ea]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
