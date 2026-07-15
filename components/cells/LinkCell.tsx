'use client';

import { useEffect, useRef, useState } from 'react';
import { Link2 } from 'lucide-react';
import type { LinkValue } from '@/types/database';

export function LinkCell({
  value,
  onChange,
}: {
  value: LinkValue | null;
  onChange: (value: LinkValue | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(value?.url ?? '');
  const [text, setText] = useState(value?.text ?? '');
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
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      onChange(null);
    } else {
      onChange({ url: trimmedUrl, text: text.trim() || trimmedUrl });
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative h-full w-full">
      <button
        type="button"
        onClick={() => {
          setUrl(value?.url ?? '');
          setText(value?.text ?? '');
          setOpen((o) => !o);
        }}
        className="flex h-full w-full items-center gap-1 truncate px-2 text-xs text-[#0073ea] hover:bg-gray-50"
      >
        {value ? (
          <>
            <Link2 size={12} className="shrink-0" />
            <span className="truncate underline">{value.text}</span>
          </>
        ) : (
          <span className="text-gray-300">Add link</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <label className="mb-1 block text-[11px] font-medium text-gray-500">URL</label>
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="https://…"
            className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm outline-none focus:border-[#0073ea]"
          />
          <label className="mb-1 block text-[11px] font-medium text-gray-500">Text</label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Display text"
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
