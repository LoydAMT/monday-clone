'use client';

import { useState } from 'react';
import { Mail, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react';
import type { SalesContact } from '@/types/database';
import { createSalesContact, deleteSalesContact, updateSalesContact, type SalesContactInput } from '@/lib/sales-mutations';
import { Field, fieldInputClass } from './ui/Field';

const EMPTY_CONTACT: SalesContactInput = {
  name: '',
  position: null,
  email: null,
  phone: null,
  is_primary: false,
  notes: null,
};

export function SalesContactsPanel({
  companyId,
  contacts,
  canEdit,
  onChange,
}: {
  companyId: string;
  contacts: SalesContact[];
  canEdit: boolean;
  onChange: (next: SalesContact[]) => void;
}) {
  // null = nothing open, 'new' = add form, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Primary first, then alphabetical — the same order getSalesContactsForCompany
  // returns, reapplied here so a contact promoted in-session moves without a
  // page refresh.
  const sorted = [...contacts].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  async function handleSave(contactId: string | 'new', input: SalesContactInput) {
    setError(null);
    if (contactId === 'new') {
      const created = await createSalesContact(companyId, input);
      // createSalesContact demotes any existing primary first, so mirror that
      // in local state rather than leaving two stars on screen.
      onChange([...(input.is_primary ? contacts.map((c) => ({ ...c, is_primary: false })) : contacts), created]);
    } else {
      const updated = await updateSalesContact(contactId, companyId, input);
      onChange(
        contacts.map((c) => {
          if (c.id === updated.id) return updated;
          return input.is_primary ? { ...c, is_primary: false } : c;
        })
      );
    }
    setEditing(null);
  }

  async function handleDelete(contactId: string) {
    const previous = contacts;
    setError(null);
    onChange(contacts.filter((c) => c.id !== contactId));
    try {
      await deleteSalesContact(contactId);
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete contact');
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Contact persons {contacts.length > 0 && `(${contacts.length})`}
        </h3>
        {canEdit && editing !== 'new' && (
          <button onClick={() => setEditing('new')} className="flex items-center gap-1 text-xs font-medium text-[#0073ea] hover:underline">
            <Plus size={12} /> Add contact
          </button>
        )}
      </div>

      {contacts.length === 0 && editing !== 'new' && (
        <p className="py-4 text-center text-xs text-gray-400">No contact persons yet.</p>
      )}

      <div className="space-y-1.5">
        {sorted.map((contact) =>
          editing === contact.id ? (
            <ContactForm
              key={contact.id}
              initial={contact}
              onCancel={() => setEditing(null)}
              onSave={(input) => handleSave(contact.id, input)}
            />
          ) : (
            <div key={contact.id} className="group flex flex-wrap items-center gap-2 rounded border border-gray-100 px-2 py-1.5">
              {contact.is_primary && <Star size={12} className="shrink-0 fill-[#fdab3d] text-[#fdab3d]" aria-label="Primary contact" />}
              <span className="text-sm font-medium text-gray-800">{contact.name}</span>
              {contact.position && <span className="text-xs text-gray-400">{contact.position}</span>}

              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0073ea]">
                  <Mail size={11} />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0073ea]">
                  <Phone size={11} />
                  {contact.phone}
                </a>
              )}
              {contact.notes && <span className="w-full truncate text-[11px] text-gray-400">{contact.notes}</span>}

              {canEdit && (
                <div className="ml-auto flex shrink-0 items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                  <button onClick={() => setEditing(contact.id)} title="Edit contact" className="text-gray-300 hover:text-gray-600">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => handleDelete(contact.id)} title="Delete contact" className="text-gray-300 hover:text-red-500">
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {editing === 'new' && (
        <div className="mt-2">
          <ContactForm initial={EMPTY_CONTACT} onCancel={() => setEditing(null)} onSave={(input) => handleSave('new', input)} />
        </div>
      )}
    </div>
  );
}

function ContactForm({
  initial,
  onCancel,
  onSave,
}: {
  initial: SalesContactInput | SalesContact;
  onCancel: () => void;
  onSave: (input: SalesContactInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [position, setPosition] = useState(initial.position ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [phone, setPhone] = useState(initial.phone ?? '');
  const [isPrimary, setIsPrimary] = useState(initial.is_primary);
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        name: trimmed,
        position: position.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        is_primary: isPrimary,
        notes: notes.trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save contact');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-gray-200 bg-gray-50 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldInputClass} />
        </Field>
        <Field label="Position">
          <input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Purchasing Manager" className={fieldInputClass} />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldInputClass} />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldInputClass} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldInputClass} />
        </Field>
      </div>

      <label className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
        <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} />
        Primary contact for this company
      </label>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save contact'}
        </button>
      </div>
    </div>
  );
}
