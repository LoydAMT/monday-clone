'use client';

import { useRef } from 'react';

export function DateCell({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formatted = value
    ? new Date(value + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <label
      onClick={() => inputRef.current?.showPicker?.()}
      className="relative flex h-full w-full cursor-pointer items-center justify-center px-2 text-xs text-gray-700 hover:bg-gray-50"
    >
      {formatted ?? <span className="text-gray-300">—</span>}
      <input
        ref={inputRef}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  );
}
