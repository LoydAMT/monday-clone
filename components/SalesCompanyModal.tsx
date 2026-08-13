'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { MemberProfile, SalesCompany } from '@/types/database';
import { createSalesCompany, deleteSalesCompany, updateSalesCompany, type SalesCompanyInput } from '@/lib/sales-mutations';
import { displayName } from '@/lib/avatar-color';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field, fieldInputClass } from './ui/Field';

export function SalesCompanyModal({
  workspaceId,
  company,
  members,
  canEdit,
  canDelete,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
}: {
  workspaceId: string;
  /** null puts the modal in create mode. */
  company: SalesCompany | null;
  members: MemberProfile[];
  canEdit: boolean;
  /** Deleting a company cascades to all its deals — owner-only, matching RLS. */
  canDelete: boolean;
  onClose: () => void;
  onCreated: (company: SalesCompany) => void;
  onUpdated: (company: SalesCompany) => void;
  onDeleted?: (companyId: string) => void;
}) {
  const [name, setName] = useState(company?.name ?? '');
  const [industry, setIndustry] = useState(company?.industry ?? '');
  const [website, setWebsite] = useState(company?.website ?? '');
  const [email, setEmail] = useState(company?.email ?? '');
  const [phone, setPhone] = useState(company?.phone ?? '');
  const [address, setAddress] = useState(company?.address ?? '');
  const [city, setCity] = useState(company?.city ?? '');
  const [country, setCountry] = useState(company?.country ?? '');
  const [taxId, setTaxId] = useState(company?.tax_id ?? '');
  const [notes, setNotes] = useState(company?.notes ?? '');
  const [ownerId, setOwnerId] = useState(company?.owner_id ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const readOnly = !canEdit;

  async function handleSave() {
    const trimmedName = name.trim();
    setNameError(null);
    if (!trimmedName) {
      setNameError('Company name is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const input: SalesCompanyInput = {
        name: trimmedName,
        industry: industry.trim() || null,
        website: website.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        country: country.trim() || null,
        tax_id: taxId.trim() || null,
        notes: notes.trim() || null,
        owner_id: ownerId || null,
      };

      if (company) {
        onUpdated(await updateSalesCompany(company.id, input));
      } else {
        onCreated(await createSalesCompany(workspaceId, input));
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save company');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!company) return;
    try {
      await deleteSalesCompany(company.id);
      onDeleted?.(company.id);
      onClose();
    } catch (e) {
      setConfirmingDelete(false);
      setError(e instanceof Error ? e.message : 'Failed to delete company');
    }
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-2xl">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        {/* Heading + a normal bordered name field, for the reason spelled out
            in SalesDealModal. */}
        <h2 className="mb-4 pr-8 text-base font-semibold text-gray-900">{company ? 'Edit customer' : 'New customer'}</h2>

        <div className="mb-3">
          <Field label="Company name">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              readOnly={readOnly}
              placeholder="e.g. Instrubyte"
              className={`${fieldInputClass} text-base font-medium ${nameError ? 'border-red-400' : ''}`}
            />
          </Field>
          {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Industry">
            <input value={industry} onChange={(e) => setIndustry(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Account manager">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} disabled={readOnly} className={fieldInputClass}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {displayName(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Company email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Website">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              readOnly={readOnly}
              placeholder="https://"
              className={fieldInputClass}
            />
          </Field>
          <Field label="TIN / Tax ID">
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input value={address} onChange={(e) => setAddress(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="City">
            <input value={city} onChange={(e) => setCity(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Country">
            <input value={country} onChange={(e) => setCountry(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              readOnly={readOnly}
              rows={3}
              className={`${fieldInputClass} resize-none`}
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <div>
            {canDelete && company && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete company
              </button>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                Cancel
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
          title="Delete this company?"
          message="This permanently deletes the company along with its contacts, deals, quotations, site visits, communications and tasks."
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  );
}
