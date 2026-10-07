'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2 } from 'lucide-react';
import type { MemberProfile, SalesCompany, SalesContact, SalesDeal } from '@/types/database';
import { deleteSalesContact } from '@/lib/sales-mutations';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { SalesHeader } from './SalesHeader';
import { SalesContactModal } from './SalesContactModal';

// The workspace-wide contact/lead directory. A contact is created here once
// and then assigned to deals from the deal form — a deal only ever stores the
// contact's id, so editing a contact here updates every deal that points at it.
export function SalesContactsView({
  workspaceId,
  workspaceName,
  initialCompanies,
  initialContacts,
  deals,
  members,
  currentUserId,
}: {
  workspaceId: string;
  workspaceName: string;
  initialCompanies: SalesCompany[];
  initialContacts: SalesContact[];
  deals: SalesDeal[];
  members: MemberProfile[];
  currentUserId: string;
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState('');
  // undefined = closed, null = create mode, a contact = edit mode.
  const [activeContact, setActiveContact] = useState<SalesContact | null | undefined>(undefined);

  const [pendingDelete, setPendingDelete] = useState<SalesContact | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canEdit = members.find((m) => m.user_id === currentUserId)?.role !== 'viewer';

  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const dealCountByContact = useMemo(() => {
    const counts = new Map<string, number>();
    for (const deal of deals) {
      if (deal.contact_id) counts.set(deal.contact_id, (counts.get(deal.contact_id) ?? 0) + 1);
    }
    return counts;
  }, [deals]);

  // Safe on a contact that deals point at: sales_deals.contact_id is
  // `on delete set null`, so those deals stay and just lose their contact
  // person. The row is only dropped from the list once the delete lands.
  async function handleDelete(contact: SalesContact) {
    setPendingDelete(null);
    setError(null);
    try {
      await deleteSalesContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to delete ${contact.name}`);
    }
  }

  const pendingDeleteDeals = pendingDelete ? (dealCountByContact.get(pendingDelete.id) ?? 0) : 0;

  const query = search.trim().toLowerCase();
  const filtered = contacts.filter((contact) => {
    if (!query) return true;
    const companyName = companiesById.get(contact.company_id)?.name ?? '';
    const haystack =
      `${contact.name} ${companyName} ${contact.email ?? ''} ${contact.phone ?? ''} ${contact.address ?? ''}`.toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SalesHeader
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        title="Contacts"
        subtitle={`${contacts.length} ${contacts.length === 1 ? 'contact' : 'contacts'} · ${workspaceName}`}
        actions={
          canEdit && (
            <button
              onClick={() => setActiveContact(null)}
              className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0060c2]"
            >
              <Plus size={14} /> New Contact
            </button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, email, or number"
            className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#0073ea]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
        {filtered.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-gray-400">
            {contacts.length === 0
              ? 'No contacts yet. Add a lead here, then assign them to a deal from the pipeline.'
              : 'No contacts match this search.'}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">Contact number</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Address</th>
                <th className="px-2 py-2 text-right">Deals</th>
                {canEdit && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => {
                const company = companiesById.get(contact.company_id);

                return (
                  <tr
                    key={contact.id}
                    onClick={() => setActiveContact(contact)}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-2 py-2 font-medium text-gray-900">{contact.name}</td>
                    <td className="px-2 py-2">
                      {company ? (
                        <Link
                          href={`/sales/${workspaceId}/companies/${company.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-600 hover:text-[#0073ea]"
                        >
                          {company.name}
                        </Link>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-600">
                      {contact.phone ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2 text-gray-600">{contact.email ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-gray-600">{contact.address ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-2 py-2 text-right text-gray-700">{dealCountByContact.get(contact.id) ?? 0}</td>
                    {canEdit && (
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDelete(contact);
                          }}
                          title="Delete contact"
                          className="text-gray-300 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {activeContact !== undefined && (
        <SalesContactModal
          workspaceId={workspaceId}
          contact={activeContact}
          companies={companies}
          canEdit={canEdit}
          onClose={() => setActiveContact(undefined)}
          onCreated={(created) => setContacts((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))}
          onUpdated={(updated) => setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
          onDeleted={(contactId) => setContacts((prev) => prev.filter((c) => c.id !== contactId))}
          onCompanyCreated={(created) =>
            setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
          }
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          message={
            pendingDeleteDeals > 0
              ? `This contact is assigned to ${pendingDeleteDeals} ${pendingDeleteDeals === 1 ? 'deal' : 'deals'}. Those deals are kept and will show no contact person.`
              : 'This permanently deletes the contact. They are not assigned to any deals.'
          }
          onConfirm={() => handleDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
