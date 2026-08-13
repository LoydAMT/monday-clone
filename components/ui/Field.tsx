'use client';

// Label + control wrapper, the same shape as the local `Field` in
// InventoryItemModal — pulled out here because the sales module's forms
// (deal, company, contact, quotation, site visit, task) would otherwise each
// redeclare it.
export function Field({
  label,
  hint,
  className = '',
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-gray-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

// The one input style the sales forms share, so a focus-ring tweak is a
// one-line change rather than a sweep through every form.
export const fieldInputClass =
  'w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea] disabled:bg-gray-50 disabled:text-gray-500';
