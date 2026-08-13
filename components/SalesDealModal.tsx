'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Trash2 } from 'lucide-react';
import type {
  MemberProfile,
  SalesActivity,
  SalesCompany,
  SalesContact,
  SalesDeal,
  SalesDealDetail,
  SalesQuotation,
  SalesSiteVisit,
  SalesStage,
  SalesTask,
} from '@/types/database';
import { CURRENCIES, DEFAULT_CURRENCY, isLostStage } from '@/lib/sales-stages';
import { createSalesDeal, deleteSalesDeal, getDealDetail, updateSalesDeal } from '@/lib/sales-mutations';
import { displayName } from '@/lib/avatar-color';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field, fieldInputClass } from './ui/Field';
import { SalesStageSelect } from './SalesStageBadge';
import { SalesCompanyCombobox } from './SalesCompanyCombobox';
import { SalesQuotationsPanel } from './SalesQuotationsPanel';
import { SalesSiteVisitsPanel } from './SalesSiteVisitsPanel';
import { SalesActivityPanel } from './SalesActivityPanel';
import { SalesTasksPanel } from './SalesTasksPanel';

const DEAL_SOURCES = ['Referral', 'Website', 'Walk-in', 'Tender / bid', 'Existing customer', 'Cold call', 'Exhibition'];

const EMPTY_DETAIL: SalesDealDetail = { quotations: [], siteVisits: [], activities: [], tasks: [] };

export function SalesDealModal({
  workspaceId,
  workspaceName,
  deal,
  companies,
  contacts,
  members,
  canEdit,
  defaultCompanyId,
  lockCompany = false,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  onCompanyCreated,
}: {
  workspaceId: string;
  workspaceName: string;
  /** null puts the modal in create mode, mirroring InventoryItemModal. */
  deal: SalesDeal | null;
  companies: SalesCompany[];
  contacts: SalesContact[];
  members: MemberProfile[];
  canEdit: boolean;
  /** Pre-selects the customer when a deal is created from a company profile. */
  defaultCompanyId?: string;
  /**
   * Opened from a company profile, where the page only holds that one
   * company — the customer is shown as a fixed label so a deal can't be
   * reassigned to a company this page knows nothing about.
   */
  lockCompany?: boolean;
  onClose: () => void;
  onCreated: (deal: SalesDeal) => void;
  onUpdated: (deal: SalesDeal) => void;
  onDeleted: (dealId: string) => void;
  onCompanyCreated?: (company: SalesCompany) => void;
}) {
  const [savedDeal, setSavedDeal] = useState<SalesDeal | null>(deal);
  const [companyList, setCompanyList] = useState(companies);

  const [title, setTitle] = useState(deal?.title ?? '');
  const [companyId, setCompanyId] = useState<string | null>(deal?.company_id ?? defaultCompanyId ?? null);
  const [contactId, setContactId] = useState(deal?.contact_id ?? '');
  const [stage, setStage] = useState<SalesStage>(deal?.stage ?? 'lead');
  const [value, setValue] = useState(deal?.value != null ? String(deal.value) : '');
  const [currency, setCurrency] = useState(deal?.currency ?? DEFAULT_CURRENCY);
  const [referenceNo, setReferenceNo] = useState(deal?.reference_no ?? '');
  const [source, setSource] = useState(deal?.source ?? '');
  const [expectedOrderDate, setExpectedOrderDate] = useState(deal?.expected_order_date ?? '');
  const [nextFollowUpOn, setNextFollowUpOn] = useState(deal?.next_follow_up_on ?? '');
  const [ownerId, setOwnerId] = useState(deal?.owner_id ?? '');
  const [lostReason, setLostReason] = useState(deal?.lost_reason ?? '');
  const [description, setDescription] = useState(deal?.description ?? '');

  const [detail, setDetail] = useState<SalesDealDetail>(EMPTY_DETAIL);
  // Which deal `detail` actually belongs to. Tracking that (rather than a
  // separate isLoading flag flipped on inside the effect) keeps the effect
  // free of synchronous setState and makes "loading" a derived value.
  const [loadedDealId, setLoadedDealId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const savedDealId = savedDeal?.id;
  const savedCompanyId = savedDeal?.company_id;
  useEffect(() => {
    if (!savedDealId || !savedCompanyId) return;
    let cancelled = false;
    getDealDetail(savedDealId, savedCompanyId).then((data) => {
      if (cancelled) return;
      setDetail(data);
      setLoadedDealId(savedDealId);
    });
    return () => {
      cancelled = true;
    };
  }, [savedDealId, savedCompanyId]);

  const detailLoading = savedDealId != null && loadedDealId !== savedDealId;

  const company = companyList.find((c) => c.id === companyId) ?? null;
  const companyContacts = contacts.filter((c) => c.company_id === companyId);
  const readOnly = !canEdit;

  function buildInput() {
    return {
      company_id: companyId as string,
      contact_id: contactId || null,
      title: title.trim(),
      reference_no: referenceNo.trim() || null,
      stage,
      value: value.trim() ? Number(value) : null,
      currency,
      source: source.trim() || null,
      expected_order_date: expectedOrderDate || null,
      next_follow_up_on: nextFollowUpOn || null,
      owner_id: ownerId || null,
      lost_reason: isLostStage(stage) ? lostReason.trim() || null : null,
      description: description.trim() || null,
    };
  }

  async function handleSave() {
    // Required-field messages sit against the field itself; `error` stays for
    // save failures, which have no one field to point at.
    setTitleError(null);
    if (!title.trim()) {
      setTitleError('Deal title is required');
      return;
    }
    if (!companyId) {
      setError('Pick a customer for this deal');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (!savedDeal) {
        const created = await createSalesDeal(workspaceId, workspaceName, buildInput());
        setSavedDeal(created);
        onCreated(created);
      } else {
        const updated = await updateSalesDeal(savedDeal, workspaceName, buildInput());
        setSavedDeal(updated);
        // Keep the form's derived fields in step with what the server
        // actually stored (closed_at bookkeeping can clear lost_reason).
        setLostReason(updated.lost_reason ?? '');
        onUpdated(updated);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save deal');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!savedDeal) return;
    await deleteSalesDeal(savedDeal.id);
    onDeleted(savedDeal.id);
    onClose();
  }

  function patchDetail(patch: Partial<SalesDealDetail>) {
    setDetail((prev) => ({ ...prev, ...patch }));
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-3xl">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        {/* The modal gets its own heading so the deal title can be an
            ordinary bordered field. Styling the title as the heading (the
            inventory modal's pattern) made the most important input on the
            form look like static text. */}
        <h2 className="mb-4 pr-8 text-base font-semibold text-gray-900">{savedDeal ? 'Edit deal' : 'New deal'}</h2>

        <div className="mb-3">
          <Field label="Deal title">
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              readOnly={readOnly}
              placeholder="e.g. Fit-out for HQ ground floor"
              className={`${fieldInputClass} text-base font-medium ${titleError ? 'border-red-400' : ''}`}
            />
          </Field>
          {titleError && <p className="mt-1 text-xs text-red-500">{titleError}</p>}
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Customer">
            {lockCompany ? (
              <p className="truncate rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-600">
                {company?.name ?? '—'}
              </p>
            ) : (
              <SalesCompanyCombobox
                workspaceId={workspaceId}
                companies={companyList}
                value={companyId}
                disabled={readOnly}
                onChange={(id) => {
                  setCompanyId(id);
                  // The old contact belongs to the old company — drop it rather
                  // than saving a contact_id from a different customer.
                  setContactId('');
                }}
                onCompanyCreated={(created) => {
                  setCompanyList((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
                  onCompanyCreated?.(created);
                }}
              />
            )}
          </Field>

          <Field label="Contact person">
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              disabled={readOnly || !companyId}
              className={fieldInputClass}
            >
              <option value="">{companyContacts.length === 0 ? 'No contacts on file' : 'Not set'}</option>
              {companyContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.position ? ` — ${c.position}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Stage">
            <SalesStageSelect value={stage} onChange={setStage} disabled={readOnly} className="w-full" />
          </Field>

          <Field label="Quotation value">
            <input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              readOnly={readOnly}
              className={fieldInputClass}
            />
          </Field>

          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={readOnly} className={fieldInputClass}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Owner">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={readOnly} className={fieldInputClass}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {displayName(m)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Expected order date">
            <input
              type="date"
              value={expectedOrderDate}
              onChange={(e) => setExpectedOrderDate(e.target.value)}
              readOnly={readOnly}
              className={fieldInputClass}
            />
          </Field>

          <Field label="Next follow-up">
            <input
              type="date"
              value={nextFollowUpOn}
              onChange={(e) => setNextFollowUpOn(e.target.value)}
              readOnly={readOnly}
              className={fieldInputClass}
            />
          </Field>

          <Field label="Reference / RFQ no.">
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              readOnly={readOnly}
              className={fieldInputClass}
            />
          </Field>

          <Field label="Source">
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              readOnly={readOnly}
              list="sales-deal-sources"
              className={fieldInputClass}
            />
            <datalist id="sales-deal-sources">
              {DEAL_SOURCES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          {isLostStage(stage) && (
            <Field label="Reason lost" className="sm:col-span-2">
              <input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                readOnly={readOnly}
                placeholder="Price, lead time, awarded to competitor…"
                className={fieldInputClass}
              />
            </Field>
          )}

          <Field label="Scope / notes" className="sm:col-span-3">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              readOnly={readOnly}
              rows={2}
              className={`${fieldInputClass} resize-none`}
            />
          </Field>
        </div>

        {company && (
          <div className="mb-5 flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <span className="truncate">
              {[company.industry, company.city, company.country].filter(Boolean).join(' · ') || 'No company details yet'}
            </span>
            <Link
              href={`/sales/${workspaceId}/companies/${company.id}`}
              className="ml-auto flex shrink-0 items-center gap-1 font-medium text-[#0073ea] hover:underline"
            >
              Company profile <ExternalLink size={11} />
            </Link>
          </div>
        )}

        {savedDeal ? (
          <div className="space-y-5">
            {detailLoading && <p className="text-xs text-gray-400">Loading deal history…</p>}

            <SalesQuotationsPanel
              dealId={savedDeal.id}
              quotations={detail.quotations}
              defaultCurrency={currency}
              canEdit={canEdit}
              onChange={(quotations: SalesQuotation[]) => patchDetail({ quotations })}
            />

            <SalesSiteVisitsPanel
              dealId={savedDeal.id}
              visits={detail.siteVisits}
              defaultAddress={company?.address ?? null}
              canEdit={canEdit}
              onChange={(siteVisits: SalesSiteVisit[]) => patchDetail({ siteVisits })}
            />

            <SalesTasksPanel
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              companyId={savedDeal.company_id}
              dealId={savedDeal.id}
              tasks={detail.tasks}
              members={members}
              canEdit={canEdit}
              onChange={(tasks: SalesTask[]) => patchDetail({ tasks })}
            />

            <SalesActivityPanel
              companyId={savedDeal.company_id}
              dealId={savedDeal.id}
              activities={detail.activities}
              membersByUserId={new Map(members.map((m) => [m.user_id, m]))}
              canEdit={canEdit}
              onChange={(activities: SalesActivity[]) => patchDetail({ activities })}
            />
          </div>
        ) : (
          <p className="rounded border border-dashed border-gray-200 px-3 py-3 text-center text-xs text-gray-400">
            Save the deal to start logging quotations, site visits, tasks and communications against it.
          </p>
        )}

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <div>
            {canEdit && savedDeal && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete deal
              </button>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete this deal?"
          message="This permanently deletes the deal along with its quotations, site visits, tasks and logged communications."
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  );
}
