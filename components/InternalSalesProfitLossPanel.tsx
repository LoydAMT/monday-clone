'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SalesCostCategory, SalesDeal, SalesDealCost, SalesQuotation } from '@/types/database';
import { COST_CATEGORIES, costCategoryLabel, formatMoney } from '@/lib/sales-stages';
import { createSalesDealCost, deleteSalesDealCost } from '@/lib/internal-sales-mutations';
import { dealProfitAndLoss } from '@/lib/sales-summary';
import { Field, fieldInputClass } from './ui/Field';

const REVENUE_NOTE = {
  quotations: 'From accepted quotations',
  deal_value: 'Deal value — no quotation accepted yet, so this is a projection',
  none: 'No accepted quotation or deal value yet',
} as const;

export function InternalSalesProfitLossPanel({
  deal,
  quotations,
  costs,
  canEdit,
  onChange,
}: {
  /** The saved deal — value and currency here, not whatever is mid-edit in the form. */
  deal: Pick<SalesDeal, 'id' | 'value' | 'currency'>;
  quotations: SalesQuotation[];
  costs: SalesDealCost[];
  canEdit: boolean;
  onChange: (next: SalesDealCost[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<SalesCostCategory>('materials');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pnl = useMemo(() => dealProfitAndLoss(deal, quotations, costs), [deal, quotations, costs]);
  // Accepted quotes in another currency are left out of revenue; say so
  // rather than let the figure look complete.
  const skippedForCurrency = quotations.filter((q) => q.status === 'accepted' && q.currency !== deal.currency).length;

  function resetForm() {
    setCategory('materials');
    setDescription('');
    setAmount('');
    setError(null);
  }

  async function handleAdd() {
    if (!description.trim()) {
      setError('Describe the cost');
      return;
    }
    const parsed = Number(amount);
    if (!amount.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setError('Enter an amount of 0 or more');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createSalesDealCost(deal.id, { category, description: description.trim(), amount: parsed });
      onChange([...costs, created]);
      resetForm();
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add cost');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(costId: string) {
    const previous = costs;
    setError(null);
    onChange(costs.filter((c) => c.id !== costId));
    try {
      await deleteSalesDealCost(costId);
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete cost');
    }
  }

  const profitColor = pnl.profit > 0 ? '#00854d' : pnl.profit < 0 ? '#d83a52' : '#323338';

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Profit &amp; loss</h3>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-[#0073ea] hover:underline">
            <Plus size={12} /> Add cost
          </button>
        )}
      </div>

      <div className="rounded border border-gray-100">
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">Revenue</p>
            <p className="text-[11px] text-gray-400">{REVENUE_NOTE[pnl.revenueSource]}</p>
            {skippedForCurrency > 0 && (
              <p className="text-[11px] text-amber-600">
                {skippedForCurrency} accepted quotation{skippedForCurrency > 1 ? 's' : ''} in another currency not counted.
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold text-gray-900">{formatMoney(pnl.revenue, deal.currency)}</span>
        </div>

        <div className="border-t border-gray-100">
          {costs.length === 0 && !adding && (
            <p className="px-3 py-3 text-center text-xs text-gray-400">No costs recorded yet.</p>
          )}
          {costs.map((cost) => (
            <div key={cost.id} className="group flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                {costCategoryLabel(cost.category)}
              </span>
              <span className="min-w-0 flex-1 truncate text-gray-700" title={cost.description}>
                {cost.description}
              </span>
              <span className="shrink-0 text-gray-700">− {formatMoney(cost.amount, deal.currency)}</span>
              {canEdit && (
                <button
                  onClick={() => handleDelete(cost.id)}
                  title="Delete cost"
                  className="shrink-0 text-gray-300 opacity-100 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1.5 text-sm">
          <span className="text-gray-500">Total costs</span>
          <span className="font-medium text-gray-700">{formatMoney(pnl.totalCost, deal.currency)}</span>
        </div>

        <div className="flex items-center justify-between rounded-b bg-gray-50 px-3 py-2">
          <span className="text-sm font-semibold text-gray-800">
            {pnl.profit < 0 ? 'Loss' : 'Profit'}
            {pnl.marginPct != null && (
              <span className="ml-2 text-xs font-medium" style={{ color: profitColor }}>
                {pnl.marginPct.toFixed(1)}% margin
              </span>
            )}
          </span>
          <span className="text-base font-semibold" style={{ color: profitColor }}>
            {formatMoney(pnl.profit, deal.currency)}
          </span>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {adding && (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as SalesCostCategory)} className={fieldInputClass}>
                {COST_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" className="col-span-2">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Steel supply — Phase 1"
                className={fieldInputClass}
              />
            </Field>
            <Field label={`Amount (${deal.currency})`}>
              <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} />
            </Field>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                resetForm();
                setAdding(false);
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add cost'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
