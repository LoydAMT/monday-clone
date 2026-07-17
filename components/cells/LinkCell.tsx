'use client';

import { useRef, useState } from 'react';
import { ExternalLink, Link2 } from 'lucide-react';
import type { LinkValue } from '@/types/database';
import { FloatingPanel } from '../ui/FloatingPanel';

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

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
  const anchorRef = useRef<HTMLDivElement>(null);

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
    <div ref={anchorRef} className="relative h-full w-full">
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

      <FloatingPanel
        anchorRef={anchorRef}
        open={open}
        onClose={() => setOpen(false)}
        className="z-20 w-56 rounded-md border border-gray-200 bg-white p-3 shadow-lg"
      >
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
        <div className="flex gap-1.5">
          {value && (
            <a
              href={withProtocol(value.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 rounded border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              title="Open link"
            >
              <ExternalLink size={12} />
            </a>
          )}
          <button
            onClick={submit}
            className="flex-1 rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
          >
            Save
          </button>
        </div>
      </FloatingPanel>
    </div>
  );
}
