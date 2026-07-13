'use client';

import { useState } from 'react';

export function TextCell({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="h-full w-full truncate px-2 text-left text-xs text-gray-700 hover:bg-gray-50"
      >
        {value || <span className="text-gray-300">Empty</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="h-full w-full border-2 border-[#0073ea] px-2 text-xs outline-none"
    />
  );
}
