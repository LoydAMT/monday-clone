'use client';

import { useState } from 'react';

export function NumericCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? '');
  const [editing, setEditing] = useState(false);

  function commit() {
    setEditing(false);
    const parsed = draft.trim() === '' ? null : Number(draft);
    if (parsed !== value) onChange(Number.isNaN(parsed) ? null : parsed);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value?.toString() ?? '');
          setEditing(true);
        }}
        className="h-full w-full truncate px-2 text-right text-xs text-gray-700 hover:bg-gray-50"
      >
        {value !== null ? value.toLocaleString() : <span className="text-gray-300">—</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="number"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="h-full w-full border-2 border-[#0073ea] px-2 text-right text-xs outline-none"
    />
  );
}
