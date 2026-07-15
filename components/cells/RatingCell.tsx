'use client';

import { Star } from 'lucide-react';
import type { Column } from '@/types/database';

export function RatingCell({
  column,
  value,
  onChange,
}: {
  column: Column;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const max = column.options.ratingMax ?? 5;
  const current = value ?? 0;

  return (
    <div className="flex h-full w-full items-center justify-center gap-0.5 px-1">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(current === n ? null : n)}
          className="text-gray-300 hover:text-[#fdab3d]"
        >
          <Star size={14} fill={n <= current ? '#fdab3d' : 'none'} stroke={n <= current ? '#fdab3d' : 'currentColor'} />
        </button>
      ))}
    </div>
  );
}
