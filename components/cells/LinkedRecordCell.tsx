'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import type { Column, LinkedItemSummary } from '@/types/database';
import { searchBoardItems } from '@/lib/linked-items';
import { FloatingPanel } from '../ui/FloatingPanel';

const SEARCH_DEBOUNCE_MS = 250;

export function LinkedRecordCell({
  column,
  records,
  onAdd,
  onRemove,
}: {
  column: Column;
  records: LinkedItemSummary[];
  onAdd?: (targetItemId: string, targetTitle: string) => void;
  onRemove?: (linkId: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);
  const linkedBoardId = column.options.linkedBoardId;

  useEffect(() => {
    if (!open || !linkedBoardId) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchBoardItems(
        linkedBoardId,
        query,
        records.map((r) => r.itemId)
      ).then((data) => {
        if (!cancelled) {
          setResults(data);
          setHighlighted(0);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // records.map(...) would create a new array identity every render —
    // depending on records.length instead avoids re-searching on every
    // keystroke-unrelated re-render while still re-excluding after a link
    // is added or removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, linkedBoardId, query, records.length]);

  function select(result: { id: string; title: string }) {
    onAdd?.(result.id, result.title);
    setQuery('');
    setResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      select(results[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={anchorRef} className="flex h-full w-full flex-wrap items-center gap-1 overflow-hidden px-1.5 py-1">
      {records.map((r) => (
        <span
          key={r.linkId}
          className="group flex items-center gap-1 truncate rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700"
        >
          <button
            type="button"
            onClick={() => linkedBoardId && router.push(`/board/${linkedBoardId}?item=${r.itemId}`)}
            className="truncate hover:underline"
            title={r.title}
          >
            {r.title}
          </button>
          <button
            type="button"
            onClick={() => onRemove?.(r.linkId)}
            className="shrink-0 text-gray-400 opacity-0 hover:text-red-500 group-hover:opacity-100"
            title="Remove link"
          >
            <X size={11} />
          </button>
        </span>
      ))}

      {linkedBoardId ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-300 hover:bg-gray-100 hover:text-gray-500"
          title="Link an item"
        >
          <Plus size={13} />
        </button>
      ) : (
        records.length === 0 && <span className="text-xs text-gray-300">No board configured</span>
      )}

      <FloatingPanel
        anchorRef={anchorRef}
        open={open && Boolean(linkedBoardId)}
        onClose={() => setOpen(false)}
        className="z-20 w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg"
      >
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search items…"
          className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0073ea]"
        />
        {results.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-gray-400">No matching items.</p>
        ) : (
          results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                select(r);
              }}
              className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs ${
                i === highlighted ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              {r.title}
            </button>
          ))
        )}
      </FloatingPanel>
    </div>
  );
}
