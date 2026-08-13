'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, MapPin, Plus, Trash2 } from 'lucide-react';
import type { SalesSiteVisit } from '@/types/database';
import { formatDateTime, fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/sales-stages';
import { createSalesSiteVisit, deleteSalesSiteVisit, updateSalesSiteVisit } from '@/lib/sales-mutations';
import { Field, fieldInputClass } from './ui/Field';

export function SalesSiteVisitsPanel({
  dealId,
  visits,
  defaultAddress,
  canEdit,
  onChange,
}: {
  dealId: string;
  visits: SalesSiteVisit[];
  /** The company's address, offered as the starting value for a new visit. */
  defaultAddress: string | null;
  canEdit: boolean;
  onChange: (next: SalesSiteVisit[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => toDateTimeLocalValue(new Date().toISOString()));
  const [siteAddress, setSiteAddress] = useState(defaultAddress ?? '');
  const [findings, setFindings] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const scheduled = fromDateTimeLocalValue(scheduledAt);
    if (!scheduled) {
      setError('Pick a date and time for the visit');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createSalesSiteVisit(dealId, {
        scheduled_at: scheduled,
        completed_at: null,
        site_address: siteAddress.trim() || null,
        findings: findings.trim() || null,
      });
      onChange([created, ...visits]);
      setFindings('');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule visit');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleComplete(visit: SalesSiteVisit) {
    const completed_at = visit.completed_at ? null : new Date().toISOString();
    const previous = visits;
    setError(null);
    onChange(visits.map((v) => (v.id === visit.id ? { ...v, completed_at } : v)));
    try {
      await updateSalesSiteVisit(visit.id, { completed_at });
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to update visit');
    }
  }

  async function handleFindingsBlur(visit: SalesSiteVisit, value: string) {
    const next = value.trim() || null;
    if (next === visit.findings) return;
    const previous = visits;
    onChange(visits.map((v) => (v.id === visit.id ? { ...v, findings: next } : v)));
    try {
      await updateSalesSiteVisit(visit.id, { findings: next });
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to save findings');
    }
  }

  async function handleDelete(visitId: string) {
    const previous = visits;
    setError(null);
    onChange(visits.filter((v) => v.id !== visitId));
    try {
      await deleteSalesSiteVisit(visitId);
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete visit');
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Site visits {visits.length > 0 && `(${visits.length})`}
        </h3>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-[#0073ea] hover:underline">
            <Plus size={12} /> Schedule visit
          </button>
        )}
      </div>

      {visits.length === 0 && !adding && (
        <p className="py-4 text-center text-xs text-gray-400">No site visits scheduled.</p>
      )}

      <div className="space-y-2">
        {visits.map((visit) => (
          <div key={visit.id} className="rounded border border-gray-100 px-2 py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => canEdit && handleToggleComplete(visit)}
                disabled={!canEdit}
                title={visit.completed_at ? 'Mark as not yet done' : 'Mark as completed'}
                className={visit.completed_at ? 'text-[#00c875]' : 'text-gray-300 hover:text-gray-500'}
              >
                {visit.completed_at ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>
              <span className="text-sm font-medium text-gray-800">{formatDateTime(visit.scheduled_at)}</span>
              {visit.completed_at && (
                <span className="rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-[#00c875]">
                  Completed {formatDateTime(visit.completed_at)}
                </span>
              )}
              {canEdit && (
                <button onClick={() => handleDelete(visit.id)} title="Delete visit" className="ml-auto text-gray-300 hover:text-red-500">
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {visit.site_address && (
              <p className="mt-1 flex items-start gap-1 pl-6 text-[11px] text-gray-500">
                <MapPin size={11} className="mt-0.5 shrink-0" />
                {visit.site_address}
              </p>
            )}

            <div className="mt-1 pl-6">
              <textarea
                defaultValue={visit.findings ?? ''}
                onBlur={(e) => canEdit && handleFindingsBlur(visit, e.target.value)}
                readOnly={!canEdit}
                rows={2}
                placeholder="Findings from the visit…"
                className="w-full resize-none rounded border border-transparent px-1 py-0.5 text-xs text-gray-600 outline-none hover:border-gray-200 focus:border-[#0073ea] read-only:hover:border-transparent"
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {adding && (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Scheduled for">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={fieldInputClass}
              />
            </Field>
            <Field label="Site address">
              <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={2}
                className={`${fieldInputClass} resize-none`}
              />
            </Field>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setError(null);
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
              {saving ? 'Saving…' : 'Schedule visit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
