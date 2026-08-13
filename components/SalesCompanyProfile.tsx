'use client';

import { useMemo, useState } from 'react';
import { Building2, ChevronRight, Pencil, Plus } from 'lucide-react';
import type {
  MemberProfile,
  SalesActivity,
  SalesCompany,
  SalesContact,
  SalesDeal,
  SalesTask,
} from '@/types/database';
import { formatDateString, formatMoney } from '@/lib/sales-stages';
import { pipelineTotals } from '@/lib/sales-summary';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { SalesHeader } from './SalesHeader';
import { SalesStageBadge } from './SalesStageBadge';
import { SalesContactsPanel } from './SalesContactsPanel';
import { SalesTasksPanel } from './SalesTasksPanel';
import { SalesActivityPanel } from './SalesActivityPanel';
import { SalesCompanyModal } from './SalesCompanyModal';
import { SalesDealModal } from './SalesDealModal';

// Two initials from the company name, for the header monogram.
function companyMonogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function SalesCompanyProfile({
  workspaceId,
  workspaceName,
  initialCompany,
  initialContacts,
  initialDeals,
  initialActivities,
  initialTasks,
  members,
  currentUserId,
}: {
  workspaceId: string;
  workspaceName: string;
  initialCompany: SalesCompany;
  initialContacts: SalesContact[];
  initialDeals: SalesDeal[];
  initialActivities: SalesActivity[];
  initialTasks: SalesTask[];
  members: MemberProfile[];
  currentUserId: string;
}) {
  const [company, setCompany] = useState(initialCompany);
  const [contacts, setContacts] = useState(initialContacts);
  const [deals, setDeals] = useState(initialDeals);
  const [activities, setActivities] = useState(initialActivities);
  const [tasks, setTasks] = useState(initialTasks);

  const [editingCompany, setEditingCompany] = useState(false);
  // undefined = closed, null = create mode, a deal = edit mode.
  const [activeDeal, setActiveDeal] = useState<SalesDeal | null | undefined>(undefined);

  const myRole = members.find((m) => m.user_id === currentUserId)?.role;
  const canEdit = myRole !== 'viewer';
  const isOwner = myRole === 'owner';

  const totals = useMemo(() => pipelineTotals(deals), [deals]);
  const membersByUserId = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const dealTitleById = useMemo(() => new Map(deals.map((d) => [d.id, d.title])), [deals]);
  const manager = company.owner_id ? membersByUserId.get(company.owner_id) : undefined;

  const location = [company.city, company.country].filter(Boolean).join(', ');
  const fullAddress = [company.address, company.city, company.country].filter(Boolean).join(', ');
  // Whether the details card has anything at all to show. Without this the
  // card renders as an empty bordered bar on a company that's only been given
  // a name — which is exactly how most of them start life.
  const hasDetails = Boolean(
    company.email || company.phone || company.website || fullAddress || company.tax_id || manager || company.notes
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SalesHeader
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        title={company.name}
        subtitle={[company.industry, location].filter(Boolean).join(' · ') || workspaceName}
        backHref={{ href: `/sales/${workspaceId}/companies`, label: 'All customers' }}
        leading={
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e6f1fd] text-sm font-semibold text-[#0073ea]">
            {companyMonogram(company.name)}
          </span>
        }
        actions={
          canEdit && (
            <>
              <button
                onClick={() => setEditingCompany(true)}
                className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                <Pencil size={13} /> Edit details
              </button>
              <button
                onClick={() => setActiveDeal(null)}
                className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0060c2]"
              >
                <Plus size={14} /> New Deal
              </button>
            </>
          )
        }
      />

      {/* Tinted page behind white cards — the same #f6f7fb as the sidebar. On
          a plain white page every section blended into the next, which is
          what made this screen read as unstyled. */}
      <div className="flex-1 overflow-y-auto bg-[#f6f7fb] px-6 py-5">
        {/* Wide monitors otherwise stretch the two columns to ~800px each and
            leave the content marooned at the top-left. */}
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Open deals" count={totals.openCount} money={formatMoney(totals.openValue, totals.currency)} />
            <Stat
              label="Won"
              count={totals.wonCount}
              money={formatMoney(totals.wonValue, totals.currency)}
              accent="#00c875"
            />
            <Stat
              label="Lost"
              count={totals.lostCount}
              money={formatMoney(totals.lostValue, totals.currency)}
              accent="#e2445c"
            />
          </div>

          <Card>
            <CardHeader title="Company details" />
            {hasDetails ? (
              <dl className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                {company.email && (
                  <Detail label="Email">
                    <a href={`mailto:${company.email}`} className="text-[#0073ea] hover:underline">
                      {company.email}
                    </a>
                  </Detail>
                )}
                {company.phone && (
                  <Detail label="Phone">
                    <a href={`tel:${company.phone}`} className="text-[#0073ea] hover:underline">
                      {company.phone}
                    </a>
                  </Detail>
                )}
                {company.website && (
                  <Detail label="Website">
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0073ea] hover:underline"
                    >
                      {company.website}
                    </a>
                  </Detail>
                )}
                {company.tax_id && <Detail label="TIN">{company.tax_id}</Detail>}
                {fullAddress && <Detail label="Address">{fullAddress}</Detail>}
                {manager && (
                  <Detail label="Manager">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                        style={{ backgroundColor: avatarColor(manager.user_id) }}
                      >
                        {initials(manager)}
                      </span>
                      {displayName(manager)}
                    </span>
                  </Detail>
                )}
                {company.notes && (
                  <div className="sm:col-span-2">
                    <Detail label="Notes">
                      <span className="whitespace-pre-wrap">{company.notes}</span>
                    </Detail>
                  </div>
                )}
              </dl>
            ) : (
              <EmptyState
                icon={<Building2 size={18} />}
                message="No contact details on file yet."
                action={canEdit ? { label: 'Add details', onClick: () => setEditingCompany(true) } : undefined}
              />
            )}
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Card>
                <CardHeader
                  title="Deals"
                  count={deals.length}
                  action={
                    canEdit && (
                      <button
                        onClick={() => setActiveDeal(null)}
                        className="flex items-center gap-1 text-xs font-medium text-[#0073ea] hover:underline"
                      >
                        <Plus size={12} /> New deal
                      </button>
                    )
                  }
                />
                {deals.length === 0 ? (
                  <EmptyState
                    icon={<Building2 size={18} />}
                    message="No inquiries logged for this customer yet."
                    action={canEdit ? { label: 'Log the first deal', onClick: () => setActiveDeal(null) } : undefined}
                  />
                ) : (
                  <div className="-mx-1.5 space-y-0.5">
                    {deals.map((deal) => (
                      <button
                        key={deal.id}
                        onClick={() => setActiveDeal(deal)}
                        className="group flex w-full items-center gap-2 rounded-md px-1.5 py-2 text-left hover:bg-gray-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{deal.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <SalesStageBadge stage={deal.stage} />
                            {deal.expected_order_date && (
                              <span className="text-[11px] text-gray-400">
                                Expected {formatDateString(deal.expected_order_date)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {deal.value == null ? '—' : formatMoney(deal.value, deal.currency)}
                        </span>
                        <ChevronRight size={14} className="shrink-0 text-gray-300 group-hover:text-gray-500" />
                      </button>
                    ))}
                  </div>
                )}
              </Card>

              {/* The panels below open with their own <h3> + action row, which
                  lands in exactly the slot CardHeader occupies above — so they
                  drop into a Card without needing to know about it. */}
              <Card>
                <SalesContactsPanel companyId={company.id} contacts={contacts} canEdit={canEdit} onChange={setContacts} />
              </Card>
            </div>

            <div className="space-y-5">
              <Card>
                <SalesTasksPanel
                  workspaceId={workspaceId}
                  workspaceName={workspaceName}
                  companyId={company.id}
                  dealId={null}
                  tasks={tasks}
                  members={members}
                  canEdit={canEdit}
                  onChange={setTasks}
                />
              </Card>

              <Card>
                <SalesActivityPanel
                  companyId={company.id}
                  // null so anything logged here is company-level correspondence
                  // rather than being pinned to one deal.
                  dealId={null}
                  activities={activities}
                  membersByUserId={membersByUserId}
                  canEdit={canEdit}
                  onChange={setActivities}
                  showDealColumn
                  dealTitleById={dealTitleById}
                />
              </Card>
            </div>
          </div>
        </div>
      </div>

      {editingCompany && (
        <SalesCompanyModal
          workspaceId={workspaceId}
          company={company}
          members={members}
          canEdit={canEdit}
          canDelete={isOwner}
          onClose={() => setEditingCompany(false)}
          onCreated={setCompany}
          onUpdated={setCompany}
          onDeleted={() => {
            // The profile's own record is gone — a full navigation (rather
            // than router.push) drops this page's now-stale state entirely.
            window.location.href = `/sales/${workspaceId}/companies`;
          }}
        />
      )}

      {activeDeal !== undefined && (
        <SalesDealModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          deal={activeDeal}
          companies={[company]}
          contacts={contacts}
          members={members}
          canEdit={canEdit}
          defaultCompanyId={company.id}
          lockCompany
          onClose={() => setActiveDeal(undefined)}
          onCreated={(created) => {
            setDeals((prev) => [created, ...prev]);
            setActiveDeal(created);
          }}
          onUpdated={(updated) => {
            setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setActiveDeal((current) => (current && current.id === updated.id ? updated : current));
          }}
          onDeleted={(dealId) => setDeals((prev) => prev.filter((d) => d.id !== dealId))}
        />
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">{children}</div>;
}

function CardHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
        {count != null && count > 0 && <span className="ml-1 text-gray-300">({count})</span>}
      </h3>
      {action}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-20 shrink-0 text-xs leading-5 text-gray-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-gray-700">{children}</dd>
    </div>
  );
}

function EmptyState({
  icon,
  message,
  action,
}: {
  icon: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-400">{icon}</span>
      <p className="text-xs text-gray-400">{message}</p>
      {action && (
        <button onClick={action.onClick} className="text-xs font-medium text-[#0073ea] hover:underline">
          {action.label}
        </button>
      )}
    </div>
  );
}

function Stat({ label, count, money, accent }: { label: string; count: number; money: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold leading-tight" style={{ color: accent ?? '#323338' }}>
        {count}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">{money}</p>
    </div>
  );
}
