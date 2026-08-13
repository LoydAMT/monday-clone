'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Columns3, List, Plus, Search } from 'lucide-react';
import type { MemberProfile, SalesCompany, SalesContact, SalesDeal, SalesStage } from '@/types/database';
import { formatMoney, isLostStage, isOverdue, isWonStage } from '@/lib/sales-stages';
import { pipelineTotals } from '@/lib/sales-summary';
import { moveDealToStage } from '@/lib/sales-mutations';
import { displayName } from '@/lib/avatar-color';
import { SalesHeader } from './SalesHeader';
import { SalesPipelineBoard } from './SalesPipelineBoard';
import { SalesDealTable } from './SalesDealTable';
import { SalesDealModal } from './SalesDealModal';
import { Modal } from './ui/Modal';

type StatusFilter = 'all' | 'open' | 'won' | 'lost';

export function SalesPipelineView({
  workspaceId,
  workspaceName,
  initialCompanies,
  initialContacts,
  initialDeals,
  members,
  currentUserId,
}: {
  workspaceId: string;
  workspaceName: string;
  initialCompanies: SalesCompany[];
  initialContacts: SalesContact[];
  initialDeals: SalesDeal[];
  members: MemberProfile[];
  currentUserId: string;
}) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [deals, setDeals] = useState(initialDeals);

  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // undefined = closed, null = create mode, a deal = edit mode (same tri-state
  // as InventoryView's activeItem).
  const searchParams = useSearchParams();
  const [activeDeal, setActiveDeal] = useState<SalesDeal | null | undefined>(() => {
    const dealId = searchParams.get('deal');
    return dealId ? (initialDeals.find((d) => d.id === dealId) ?? undefined) : undefined;
  });
  // Re-sync on a deep link that only changes the query param while this
  // component stays mounted — see the same idiom in BoardView.
  const [lastSyncedDealParam, setLastSyncedDealParam] = useState(() => searchParams.get('deal'));
  const currentDealParam = searchParams.get('deal');
  if (currentDealParam !== lastSyncedDealParam) {
    setLastSyncedDealParam(currentDealParam);
    if (currentDealParam) {
      const target = deals.find((d) => d.id === currentDealParam);
      if (target) setActiveDeal(target);
    }
  }

  // A drag onto the Lost column pauses here until a reason is given.
  const [pendingLoss, setPendingLoss] = useState<SalesDeal | null>(null);

  const canEdit = members.find((m) => m.user_id === currentUserId)?.role !== 'viewer';
  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const membersByUserId = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const filteredDeals = useMemo(() => {
    const query = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (query) {
        const companyName = companiesById.get(deal.company_id)?.name ?? '';
        const haystack = `${deal.title} ${deal.reference_no ?? ''} ${companyName}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (ownerFilter === 'unassigned' && deal.owner_id !== null) return false;
      if (ownerFilter !== 'all' && ownerFilter !== 'unassigned' && deal.owner_id !== ownerFilter) return false;
      if (statusFilter === 'open' && (isWonStage(deal.stage) || isLostStage(deal.stage))) return false;
      if (statusFilter === 'won' && !isWonStage(deal.stage)) return false;
      if (statusFilter === 'lost' && !isLostStage(deal.stage)) return false;
      if (overdueOnly && !isOverdue(deal.next_follow_up_on)) return false;
      return true;
    });
  }, [deals, search, ownerFilter, statusFilter, overdueOnly, companiesById]);

  // Headline numbers describe the whole pipeline, not the current filter —
  // they're the thing you check before narrowing down. Also supplies the
  // currency the board's per-column totals are labelled with.
  const totals = useMemo(() => pipelineTotals(deals), [deals]);

  function applyDealUpdate(updated: SalesDeal) {
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setActiveDeal((current) => (current && current.id === updated.id ? updated : current));
  }

  async function commitStageChange(deal: SalesDeal, stage: SalesStage, lostReason?: string) {
    const previous = deals;
    // Optimistic — the card lands in the new column immediately, like the
    // board's own status drag.
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, stage } : d)));
    try {
      const updated = await moveDealToStage(deal, stage, lostReason);
      applyDealUpdate(updated);
    } catch {
      setDeals(previous);
    }
  }

  function handleStageChange(deal: SalesDeal, stage: SalesStage) {
    // Losing a deal is the one transition worth capturing a reason for, so
    // the lost-deal review later has something to read.
    if (isLostStage(stage) && !isLostStage(deal.stage)) {
      setPendingLoss(deal);
      return;
    }
    commitStageChange(deal, stage);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SalesHeader
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        title="Sales pipeline"
        actions={
          canEdit && (
            <button
              onClick={() => setActiveDeal(null)}
              className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0060c2]"
            >
              <Plus size={14} /> New Deal
            </button>
          )
        }
      />

      <div className="flex flex-wrap gap-3 border-b border-gray-200 bg-white px-6 py-3">
        <Stat label="Open deals" value={String(totals.openCount)} sub={formatMoney(totals.openValue, totals.currency)} />
        {totals.mixedCurrency && (
          <p className="self-center text-[11px] text-gray-400">
            Totals mix currencies and are shown in {totals.currency} without conversion.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deal, customer, or RFQ no."
            className="w-full rounded-md border border-gray-200 py-1.5 pl-7 pr-2 text-xs outline-none focus:border-[#0073ea]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
        >
          <option value="open">Open deals</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="all">All deals</option>
        </select>

        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
        >
          <option value="all">All owners</option>
          <option value="unassigned">Unassigned</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {displayName(m)}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
          Overdue follow-ups
        </label>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-gray-200 p-0.5">
          <ViewButton active={view === 'board'} onClick={() => setView('board')} label="Board">
            <Columns3 size={13} />
          </ViewButton>
          <ViewButton active={view === 'list'} onClick={() => setView('list')} label="List">
            <List size={13} />
          </ViewButton>
        </div>
      </div>

      {view === 'board' ? (
        <div className="flex-1 overflow-hidden">
          <SalesPipelineBoard
            deals={filteredDeals}
            companiesById={companiesById}
            membersByUserId={membersByUserId}
            currency={totals.currency}
            canEdit={canEdit}
            onOpenDeal={setActiveDeal}
            onStageChange={handleStageChange}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 py-4">
          <SalesDealTable
            deals={filteredDeals}
            companiesById={companiesById}
            membersByUserId={membersByUserId}
            onRowClick={setActiveDeal}
          />
        </div>
      )}

      {activeDeal !== undefined && (
        <SalesDealModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          deal={activeDeal}
          companies={companies}
          contacts={initialContacts}
          members={members}
          canEdit={canEdit}
          onClose={() => setActiveDeal(undefined)}
          onCreated={(created) => {
            setDeals((prev) => [created, ...prev]);
            setActiveDeal(created);
          }}
          onUpdated={applyDealUpdate}
          onDeleted={(dealId) => setDeals((prev) => prev.filter((d) => d.id !== dealId))}
          onCompanyCreated={(created) =>
            setCompanies((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
          }
        />
      )}

      {pendingLoss && (
        <LostReasonDialog
          dealTitle={pendingLoss.title}
          onCancel={() => setPendingLoss(null)}
          onConfirm={(reason) => {
            commitStageChange(pendingLoss, 'lost', reason);
            setPendingLoss(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-[7rem] rounded-md border border-gray-100 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-lg font-semibold leading-tight text-[#323338]">{value}</p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
        active ? 'bg-[#e6f1fd] text-[#0073ea]' : 'text-gray-500 hover:bg-gray-100'
      }`}
    >
      {children}
      {label}
    </button>
  );
}

function LostReasonDialog({
  dealTitle,
  onCancel,
  onConfirm,
}: {
  dealTitle: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <Modal onClose={onCancel} widthClassName="max-w-sm">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Mark &ldquo;{dealTitle}&rdquo; as lost?</h2>
        <p className="mt-1.5 text-sm text-gray-500">Recording why makes the lost-deal review worth reading later.</p>
        <input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm(reason.trim())}
          placeholder="Price, lead time, awarded to competitor…"
          className="mt-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="rounded-md bg-[#e2445c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#cc3a4e]"
          >
            Mark as lost
          </button>
        </div>
      </div>
    </Modal>
  );
}
