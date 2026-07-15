'use client';

import { Check } from 'lucide-react';

export function CheckboxCell({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex h-full w-full items-center justify-center hover:bg-gray-50"
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded border-2"
        style={{
          backgroundColor: value ? '#00c875' : 'transparent',
          borderColor: value ? '#00c875' : '#d1d5db',
        }}
      >
        {value && <Check size={13} className="text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}
