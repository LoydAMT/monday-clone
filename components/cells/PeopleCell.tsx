'use client';

import { useRef, useState } from 'react';
import type { MemberProfile } from '@/types/database';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { FloatingPanel } from '../ui/FloatingPanel';

export function PeopleCell({
  value,
  onChange,
  members,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  members: MemberProfile[];
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const assigned = members.filter((m) => value.includes(m.user_id));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div ref={anchorRef} className="relative flex h-full w-full items-center justify-center">
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
        {assigned.map((m) => (
          <span
            key={m.user_id}
            title={displayName(m)}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(m.user_id) }}
          >
            {initials(m)}
          </span>
        ))}
      </button>

      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        className="z-20 w-48 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
      >
        {members.length === 0 && <p className="px-2 py-1.5 text-xs text-gray-400">No members yet.</p>}
        {members.map((m) => (
          <button
            key={m.user_id}
            type="button"
            onClick={() => toggle(m.user_id)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50"
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(m.user_id) }}
            >
              {initials(m)}
            </span>
            <span className="flex-1 truncate text-gray-700">{displayName(m)}</span>
            {value.includes(m.user_id) && <span className="text-[#0073ea]">✓</span>}
          </button>
        ))}
      </FloatingPanel>
    </div>
  );
}
