'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CalendarClock, GripVertical } from 'lucide-react';
import type { MemberProfile, SalesCompany, SalesDeal, SalesStage } from '@/types/database';
import { SALES_STAGES, formatCompactMoney, formatDateString, formatMoney, isOverdue, isDueToday } from '@/lib/sales-stages';
import { groupDealsByStage, sumDealValues } from '@/lib/sales-summary';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';

export function SalesPipelineBoard({
  deals,
  companiesById,
  membersByUserId,
  // Currency the per-column totals are labelled with — the board's dominant
  // one, resolved once by the parent so all eleven headers agree even when a
  // column happens to hold a single foreign-currency deal.
  currency,
  canEdit,
  onOpenDeal,
  onStageChange,
}: {
  deals: SalesDeal[];
  companiesById: Map<string, SalesCompany>;
  membersByUserId: Map<string, MemberProfile>;
  currency: string;
  canEdit: boolean;
  onOpenDeal: (deal: SalesDeal) => void;
  onStageChange: (deal: SalesDeal, stage: SalesStage) => void;
}) {
  const [activeDeal, setActiveDeal] = useState<SalesDeal | null>(null);

  // Constant-length sensor array and per-card `disabled` gating, for the
  // reason spelled out in KanbanView.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const grouped = groupDealsByStage(deals);

  function handleDragStart(event: DragStartEvent) {
    setActiveDeal(deals.find((d) => d.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const deal = deals.find((d) => d.id === active.id);
    const stage = String(over.id) as SalesStage;
    if (!deal || deal.stage === stage) return;

    onStageChange(deal, stage);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-3 overflow-x-auto px-6 pb-4 pt-4">
        {SALES_STAGES.map((stage) => {
          const stageDeals = grouped[stage.id] ?? [];
          return (
            <StageColumn
              key={stage.id}
              id={stage.id}
              label={stage.label}
              color={stage.color}
              description={stage.description}
              count={stageDeals.length}
              total={sumDealValues(stageDeals)}
              currency={currency}
            >
              {stageDeals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  company={companiesById.get(deal.company_id)}
                  owner={deal.owner_id ? membersByUserId.get(deal.owner_id) : undefined}
                  canEdit={canEdit}
                  onOpen={() => onOpenDeal(deal)}
                />
              ))}
              {stageDeals.length === 0 && (
                <p className="px-2 py-3 text-center text-[11px] text-gray-300">Drop a deal here</p>
              )}
            </StageColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeDeal && (
          <div className="w-64 rounded-md border border-gray-300 bg-white p-3 shadow-lg">
            <p className="text-sm font-medium text-gray-800">{activeDeal.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  id,
  label,
  color,
  description,
  count,
  total,
  currency,
  children,
}: {
  id: string;
  label: string;
  color: string;
  description: string;
  count: number;
  total: number;
  currency: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-md bg-gray-50 ${isOver ? 'ring-2 ring-[#0073ea]' : ''}`}
    >
      <div className="sticky top-0 rounded-t-md border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="flex-1 truncate text-xs font-semibold text-gray-700" title={description}>
            {label}
          </span>
          <span className="text-[11px] text-gray-400">{count}</span>
        </div>
        {total > 0 && (
          <p className="mt-0.5 pl-4 text-[11px] font-medium text-gray-500">{formatCompactMoney(total, currency)}</p>
        )}
      </div>

      <div className="min-h-[60px] flex-1 space-y-2 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

function DealCard({
  deal,
  company,
  owner,
  canEdit,
  onOpen,
}: {
  deal: SalesDeal;
  company: SalesCompany | undefined;
  owner: MemberProfile | undefined;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id, disabled: !canEdit });

  const followUpOverdue = isOverdue(deal.next_follow_up_on);
  const followUpToday = isDueToday(deal.next_follow_up_on);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="group relative rounded-md border border-gray-200 bg-white shadow-sm hover:border-gray-300"
    >
      {canEdit && (
        <button
          {...attributes}
          {...listeners}
          className="absolute left-1 top-2 cursor-grab text-gray-300 opacity-100 active:cursor-grabbing md:opacity-0 md:hover:text-gray-500 md:group-hover:opacity-100"
          title="Drag to another stage"
        >
          <GripVertical size={13} />
        </button>
      )}

      {/* The card body is the click target rather than the whole card, so the
          drag handle above keeps its own pointer events instead of racing the
          open-deal click. */}
      <button type="button" onClick={onOpen} className="block w-full px-3 py-2.5 pl-5 text-left">
        <p className="truncate text-sm font-medium text-gray-800">{deal.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-gray-400">{company?.name ?? 'Unknown company'}</p>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-gray-700">
            {deal.value == null ? '—' : formatMoney(deal.value, deal.currency)}
          </span>
          {owner && (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
              style={{ backgroundColor: avatarColor(owner.user_id) }}
              title={`Owner: ${displayName(owner)}`}
            >
              {initials(owner)}
            </span>
          )}
        </div>

        {deal.next_follow_up_on && (
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
              followUpOverdue
                ? 'bg-red-50 text-[#e2445c]'
                : followUpToday
                  ? 'bg-orange-50 text-[#fdab3d]'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            <CalendarClock size={10} />
            {followUpOverdue ? 'Overdue' : followUpToday ? 'Today' : formatDateString(deal.next_follow_up_on)}
          </span>
        )}
      </button>
    </div>
  );
}
