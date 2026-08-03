'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { InventoryStock, InventoryStockMovement } from '@/types/database';
import { adjustStock } from '@/lib/inventory-mutations';

export function StockAdjuster({
  itemId,
  locationId,
  locationName,
  onAdjusted,
}: {
  itemId: string;
  locationId: string;
  locationName: string;
  onAdjusted: (result: { stock: InventoryStock; movement: InventoryStockMovement }) => void;
}) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) return;
    setError(null);
    setPending(true);
    try {
      const result = await adjustStock(itemId, locationId, locationName, mode === 'add' ? parsed : -parsed, reason);
      onAdjusted(result);
      setAmount('');
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to adjust stock');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex rounded border border-gray-300 overflow-hidden">
        <button
          type="button"
          onClick={() => setMode('add')}
          className={`flex h-6 w-6 items-center justify-center ${mode === 'add' ? 'bg-[#0073ea] text-white' : 'text-gray-400 hover:bg-gray-50'}`}
          title="Add stock"
        >
          <Plus size={12} />
        </button>
        <button
          type="button"
          onClick={() => setMode('remove')}
          className={`flex h-6 w-6 items-center justify-center border-l border-gray-300 ${mode === 'remove' ? 'bg-[#e2445c] text-white' : 'text-gray-400 hover:bg-gray-50'}`}
          title="Remove stock"
        >
          <Minus size={12} />
        </button>
      </div>
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Qty"
        className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
      />
      <button
        type="button"
        onClick={handleConfirm}
        disabled={pending || !amount}
        className="shrink-0 rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
      >
        {pending ? '…' : 'Apply'}
      </button>
      {error && <span className="shrink-0 text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
