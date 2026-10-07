'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { SalesCompany, SalesContact } from '@/types/database';
import { createSalesContact, deleteSalesContact, updateSalesContact } from '@/lib/sales-mutations';
import { Modal } from './ui/Modal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { Field, fieldInputClass } from './ui/Field';
import { SalesCompanyCombobox } from './SalesCompanyCombobox';

export function SalesContactModal({
  workspaceId,
  contact,
  companies,
  canEdit,
  onClose,
  onCreated,
  onUpdated,
  onDeleted,
  onCompanyCreated,
}: {
  workspaceId: string;
  /** null puts the modal in create mode. */
  contact: SalesContact | null;
  companies: SalesCompany[];
  canEdit: boolean;
  onClose: () => void;
  onCreated: (contact: SalesContact) => void;
  onUpdated: (contact: SalesContact) => void;
  onDeleted: (contactId: string) => void;
  onCompanyCreated: (company: SalesCompany) => void;
}) {
  const [name, setName] = useState(contact?.name ?? '');
  const [companyId, setCompanyId] = useState<string | null>(contact?.company_id ?? null);
  const [address, setAddress] = useState(contact?.address ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const readOnly = !canEdit;
  const company = companies.find((c) => c.id === companyId) ?? null;

  async function handleSave() {
    const trimmedName = name.trim();
    setNameError(null);
    if (!trimmedName) {
      setNameError('Name is required');
      return;
    }
    if (!companyId) {
      setError('Pick or type a company for this contact');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const fields = {
        name: trimmedName,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      };

      if (contact) {
        onUpdated(await updateSalesContact(contact.id, contact.company_id, fields));
      } else {
        onCreated(await createSalesContact(companyId, { ...fields, position: null, is_primary: false, notes: null }));
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!contact) return;
    try {
      await deleteSalesContact(contact.id);
      onDeleted(contact.id);
      onClose();
    } catch (e) {
      setConfirmingDelete(false);
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
    }
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-xl">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <h2 className="mb-4 pr-8 text-base font-semibold text-gray-900">{contact ? 'Edit contact' : 'New contact'}</h2>

        <div className="mb-3">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              readOnly={readOnly}
              placeholder="e.g. Maria Santos"
              className={`${fieldInputClass} text-base font-medium ${nameError ? 'border-red-400' : ''}`}
            />
          </Field>
          {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Company" className="sm:col-span-2">
            {contact ? (
              // Fixed once saved: deals assigned to this contact belong to this
              // company, so moving the contact would leave them pointing at a
              // person from a different customer.
              <p className="truncate rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-600">
                {company?.name ?? '—'}
              </p>
            ) : (
              <SalesCompanyCombobox
                workspaceId={workspaceId}
                companies={companies}
                value={companyId}
                disabled={readOnly}
                onChange={setCompanyId}
                onCompanyCreated={onCompanyCreated}
              />
            )}
          </Field>
          <Field label="Contact number">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input value={address} onChange={(e) => setAddress(e.target.value)} readOnly={readOnly} className={fieldInputClass} />
          </Field>
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
          <div>
            {canEdit && contact && (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                <Trash2 size={12} /> Delete contact
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
          title="Delete this contact?"
          message="This permanently deletes the contact. Deals assigned to them are kept and simply lose their contact person."
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </Modal>
  );
}
