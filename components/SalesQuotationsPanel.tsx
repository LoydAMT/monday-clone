'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { QuotationStatus, SalesQuotation } from '@/types/database';
import {
  CURRENCIES,
  QUOTATION_STATUSES,
  formatDateString,
  formatMoney,
  quotationStatusColor,
  todayDateString,
} from '@/lib/sales-stages';
import { createSalesQuotation, deleteSalesQuotation, updateSalesQuotation } from '@/lib/sales-mutations';
import { Field, fieldInputClass } from './ui/Field';

export function SalesQuotationsPanel({
  dealId,
  quotations,
  defaultCurrency,
  canEdit,
  onChange,
}: {
  dealId: string;
  quotations: SalesQuotation[];
  defaultCurrency: string;
  canEdit: boolean;
  onChange: (next: SalesQuotation[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState('');
  const [revision, setRevision] = useState('0');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [status, setStatus] = useState<QuotationStatus>('draft');
  const [submittedOn, setSubmittedOn] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setQuoteNumber('');
    setRevision('0');
    setAmount('');
    setCurrency(defaultCurrency);
    setStatus('draft');
    setSubmittedOn('');
    setValidUntil('');
    setNotes('');
    setError(null);
  }

  async function handleAdd() {
    const trimmedNumber = quoteNumber.trim();
    if (!trimmedNumber) {
      setError('Quotation number is required');
      return;
    }
    if (!amount.trim()) {
      setError('Amount is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createSalesQuotation(dealId, {
        quote_number: trimmedNumber,
        revision: Number(revision) || 0,
        amount: Number(amount),
        currency,
        status,
        submitted_on: submittedOn || null,
        valid_until: validUntil || null,
        notes: notes.trim() || null,
      });
      onChange([created, ...quotations]);
      resetForm();
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add quotation');
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(quotation: SalesQuotation, next: QuotationStatus) {
    // A quote can't be "submitted" without a submission date — fill today's
    // in on the transition rather than leaving the deal's paper trail with a
    // hole in it. Local today, not toISOString()'s UTC date, which is already
    // tomorrow for part of the day east of Greenwich.
    const patch: { status: QuotationStatus; submitted_on?: string } = { status: next };
    if (next === 'submitted' && !quotation.submitted_on) {
      patch.submitted_on = todayDateString();
    }

    const previous = quotations;
    setError(null);
    onChange(quotations.map((q) => (q.id === quotation.id ? { ...q, ...patch } : q)));
    try {
      await updateSalesQuotation(quotation.id, patch);
    } catch (e) {
      // Most likely valid_until_after_submitted rejecting the auto-filled
      // date on an already-expired quote.
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to update quotation');
    }
  }

  async function handleDelete(quotationId: string) {
    const previous = quotations;
    setError(null);
    onChange(quotations.filter((q) => q.id !== quotationId));
    try {
      await deleteSalesQuotation(quotationId);
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete quotation');
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Quotations {quotations.length > 0 && `(${quotations.length})`}
        </h3>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-[#0073ea] hover:underline">
            <Plus size={12} /> Add quotation
          </button>
        )}
      </div>

      {quotations.length === 0 && !adding && (
        <p className="py-4 text-center text-xs text-gray-400">No quotations submitted yet.</p>
      )}

      <div className="space-y-1.5">
        {quotations.map((q) => (
          <div key={q.id} className="flex flex-wrap items-center gap-2 rounded border border-gray-100 px-2 py-1.5">
            <span className="text-sm font-medium text-gray-800">
              {q.quote_number}
              {q.revision > 0 && <span className="ml-1 text-xs text-gray-400">rev. {q.revision}</span>}
            </span>
            <span className="text-sm font-semibold text-gray-900">{formatMoney(q.amount, q.currency)}</span>

            {canEdit ? (
              <select
                value={q.status}
                onChange={(e) => handleStatusChange(q, e.target.value as QuotationStatus)}
                className="rounded border-0 px-1.5 py-0.5 text-[11px] font-medium text-white outline-none"
                style={{ backgroundColor: quotationStatusColor(q.status) }}
              >
                {QUOTATION_STATUSES.map((s) => (
                  <option key={s.id} value={s.id} className="bg-white text-gray-700">
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                style={{ backgroundColor: quotationStatusColor(q.status) }}
              >
                {QUOTATION_STATUSES.find((s) => s.id === q.status)?.label}
              </span>
            )}

            <span className="text-[11px] text-gray-400">
              {q.submitted_on ? `Submitted ${formatDateString(q.submitted_on)}` : 'Not submitted'}
              {q.valid_until && ` · valid to ${formatDateString(q.valid_until)}`}
            </span>

            {q.notes && <span className="w-full truncate text-[11px] text-gray-400">{q.notes}</span>}

            {canEdit && (
              <button
                onClick={() => handleDelete(q.id)}
                title="Delete quotation"
                className="ml-auto text-gray-300 hover:text-red-500"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {adding && (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Quotation no.">
              <input value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} placeholder="QTN-2026-001" className={fieldInputClass} />
            </Field>
            <Field label="Revision">
              <input type="number" min={0} value={revision} onChange={(e) => setRevision(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="Amount">
              <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="Currency">
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldInputClass}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as QuotationStatus)} className={fieldInputClass}>
                {QUOTATION_STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Submitted on">
              <input type="date" value={submittedOn} onChange={(e) => setSubmittedOn(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="Valid until">
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldInputClass} />
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
              {saving ? 'Adding…' : 'Add quotation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
