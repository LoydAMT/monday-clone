'use client';

import type { SalesStage } from '@/types/database';
import { SALES_STAGES, stageMeta } from '@/lib/sales-stages';

// Reads the stage colour straight from lib/sales-stages.ts rather than a
// Tailwind class map — the same source the board columns and the select below
// use, so a colour change lands everywhere at once.
export function SalesStageBadge({ stage }: { stage: SalesStage }) {
  const meta = stageMeta(stage);
  return (
    <span
      className="inline-block whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: meta.color }}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}

export function SalesStageSelect({
  value,
  onChange,
  disabled,
  className = '',
}: {
  value: SalesStage;
  onChange: (stage: SalesStage) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as SalesStage)}
      className={`rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea] disabled:bg-gray-50 disabled:text-gray-400 ${className}`}
    >
      {SALES_STAGES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
