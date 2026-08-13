'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Star } from 'lucide-react';
import type { MemberProfile, SalesCompany, SalesContact, SalesDeal } from '@/types/database';
import { formatDateString, formatMoney, isOverdue } from '@/lib/sales-stages';
import { dominantCurrency, summarizeCompanyDeals } from '@/lib/sales-summary';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { SalesHeader } from './SalesHeader';
import { SalesCompanyModal } from './SalesCompanyModal';

export function SalesCompaniesView({
  workspaceId,
  workspaceName,
  initialCompanies,
  contacts,
  deals,
  members,
  currentUserId,
}: {
  workspaceId: string;
  workspaceName: string;
  initialCompanies: SalesCompany[];
  contacts: SalesContact[];
  deals: SalesDeal[];
  members: MemberProfile[];
  currentUserId: string;
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [openDealsOnly, setOpenDealsOnly] = useState(false);
  const [creating, setCreating] = useState(false);

  const myRole = members.find((m) => m.user_id === currentUserId)?.role;
  const canEdit = myRole !== 'viewer';

  const summaries = useMemo(() => summarizeCompanyDeals(deals), [deals]);
  const currency = useMemo(() => dominantCurrency(deals).currency, [deals]);
  const membersByUserId = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const primaryContactByCompany = useMemo(() => {
    const map = new Map<string, SalesContact>();
    for (const contact of contacts) if (contact.is_primary) map.set(contact.company_id, contact);
    return map;
  }, [contacts]);

  const filtered = companies.filter((company) => {
    const query = search.trim().toLowerCase();
    if (query) {
      const haystack = `${company.name} ${company.industry ?? ''} ${company.city ?? ''} ${company.country ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (ownerFilter === 'unassigned' && company.owner_id !== null) return false;
    if (ownerFilter !== 'all' && ownerFilter !== 'unassigned' && company.owner_id !== ownerFilter) return false;
    if (openDealsOnly && (summaries[company.id]?.openCount ?? 0) === 0) return false;
    return true;
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SalesHeader
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        title="Customers"
        subtitle={`${companies.length} ${companies.length === 1 ? 'company' : 'companies'} · ${workspaceName}`}
        actions={
          canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0060c2]"
            >
              <Plus size={14} /> New Company
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
            placeholder="Search company, industry, or city"
            className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#0073ea]"
          />
        </div>

        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
        >
          <option value="all">All account managers</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {displayName(m)}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={openDealsOnly} onChange={(e) => setOpenDealsOnly(e.target.checked)} />
          With open deals
        </label>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {filtered.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-gray-400">
            {companies.length === 0 ? 'No customers yet. Add your first company to start tracking inquiries.' : 'No companies match these filters.'}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2">Primary contact</th>
                <th className="px-2 py-2 text-right">Open</th>
                <th className="px-2 py-2 text-right">Open value</th>
                <th className="px-2 py-2 text-right">Won</th>
                <th className="px-2 py-2">Next follow-up</th>
                <th className="px-2 py-2">Manager</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((company) => {
                const summary = summaries[company.id];
                const contact = primaryContactByCompany.get(company.id);
                const manager = company.owner_id ? membersByUserId.get(company.owner_id) : undefined;
                const followUp = summary?.nextFollowUpOn ?? null;

                return (
                  <tr key={company.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <Link href={`/sales/${workspaceId}/companies/${company.id}`} className="block">
                        <span className="font-medium text-gray-900 hover:text-[#0073ea]">{company.name}</span>
                        <span className="block text-xs text-gray-400">
                          {[company.industry, company.city, company.country].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      {contact ? (
                        <span className="flex items-center gap-1 text-gray-600">
                          <Star size={11} className="shrink-0 fill-[#fdab3d] text-[#fdab3d]" />
                          <span className="truncate">{contact.name}</span>
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-700">{summary?.openCount ?? 0}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-gray-900">
                      {formatMoney(summary?.openValue ?? 0, currency)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-600">
                      {summary?.wonCount ? `${summary.wonCount} · ${formatMoney(summary.wonValue, currency)}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {followUp ? (
                        <span className={isOverdue(followUp) ? 'font-medium text-[#e2445c]' : 'text-gray-600'}>
                          {formatDateString(followUp)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {manager ? (
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                          style={{ backgroundColor: avatarColor(manager.user_id) }}
                          title={displayName(manager)}
                        >
                          {initials(manager)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <SalesCompanyModal
          workspaceId={workspaceId}
          company={null}
          members={members}
          canEdit={canEdit}
          canDelete={false}
          onClose={() => setCreating(false)}
          onCreated={(created) => setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))}
          onUpdated={(updated) => setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
        />
      )}
    </div>
  );
}
