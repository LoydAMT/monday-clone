'use client';

import { useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import type { CellValue, Column, ColumnOptions, Group, Item, MemberProfile } from '@/types/database';
import { GroupSection } from './GroupSection';
import { AddColumnButton } from './AddColumnButton';
import type { SortState } from './BoardToolbar';
import { headerGridTemplate } from '@/lib/grid';
import { logActivity, updateItemPositions, type ItemPositionUpdate } from '@/lib/mutations';

type ByGroup = Record<string, Item[]>;

function toByGroup(items: Item[], groups: Group[]): ByGroup {
  const map: ByGroup = {};
  for (const g of groups) map[g.id] = [];
  for (const item of items) map[item.group_id]?.push(item);
  for (const g of groups) map[g.id].sort((a, b) => a.position - b.position);
  return map;
}

function flatten(byGroup: ByGroup, groups: Group[]): Item[] {
  return groups.flatMap((g) => byGroup[g.id] ?? []);
}

export function TableGrid({
  columns,
  groups,
  items,
  setItems,
  orderingLocked = false,
  sort = null,
  onSortChange,
  members = [],
  onCellChange,
  onOptionsChange,
  onTitleChange,
  onRenameGroup,
  onAddItem,
  onAddGroup,
  onAddColumn,
  onOpenItem,
}: {
  columns: Column[];
  groups: Group[];
  items: Item[];
  setItems: (updater: Item[] | ((prev: Item[]) => Item[])) => void;
  orderingLocked?: boolean;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  members?: MemberProfile[];
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOptionsChange?: (columnId: string, options: ColumnOptions) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onAddItem: (groupId: string) => void;
  onAddGroup: () => void;
  onAddColumn: (name: string, type: Column['type']) => void;
  onOpenItem?: (itemId: string) => void;
}) {
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const snapshotRef = useRef<Item[] | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const activeSensors = orderingLocked ? [] : sensors;

  function toggleSort(columnId: string) {
    if (!onSortChange) return;
    if (sort?.columnId !== columnId) return onSortChange({ columnId, direction: 'asc' });
    if (sort.direction === 'asc') return onSortChange({ columnId, direction: 'desc' });
    onSortChange(null);
  }

  const itemsByGroup = useMemo(() => toByGroup(items, groups), [items, groups]);

  function findContainer(id: string): string | undefined {
    if (itemsByGroup[id]) return id;
    return items.find((i) => i.id === id)?.group_id;
  }

  function handleDragStart(event: DragStartEvent) {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
    snapshotRef.current = items;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setItems((prev) => {
      const byGroup = toByGroup(prev, groups);
      const activeItems = byGroup[activeContainer];
      const activeIndex = activeItems.findIndex((i) => i.id === activeId);
      if (activeIndex === -1) return prev;
      const moving = activeItems[activeIndex];

      const overItems = byGroup[overContainer];
      const overIndex = overItems.findIndex((i) => i.id === overId);
      const insertIndex = overIndex >= 0 ? overIndex : overItems.length;

      byGroup[activeContainer] = [...activeItems.slice(0, activeIndex), ...activeItems.slice(activeIndex + 1)];
      byGroup[overContainer] = [
        ...overItems.slice(0, insertIndex),
        { ...moving, group_id: overContainer },
        ...overItems.slice(insertIndex),
      ];

      return flatten(byGroup, groups);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    const previous = snapshotRef.current;
    snapshotRef.current = null;

    if (!over) {
      if (previous) setItems(previous);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    let byGroup = toByGroup(items, groups);
    if (activeContainer && overContainer && activeContainer === overContainer) {
      const groupItems = byGroup[activeContainer];
      const activeIndex = groupItems.findIndex((i) => i.id === activeId);
      const overIndex = groupItems.findIndex((i) => i.id === overId);
      if (activeIndex !== -1 && overIndex !== -1) {
        byGroup = { ...byGroup, [activeContainer]: arrayMove(groupItems, activeIndex, overIndex) };
      }
    }

    const positionUpdates: ItemPositionUpdate[] = [];
    const updatedByGroup: ByGroup = {};
    for (const [groupId, groupItems] of Object.entries(byGroup)) {
      updatedByGroup[groupId] = groupItems.map((item, index) => {
        const isReconciled = !item.id.startsWith('temp-');
        if (isReconciled && (item.position !== index || item.group_id !== groupId)) {
          positionUpdates.push({ id: item.id, group_id: groupId, position: index });
        }
        return { ...item, group_id: groupId, position: index };
      });
    }

    setItems(flatten(updatedByGroup, groups));

    if (positionUpdates.length === 0) return;

    const originalGroupId = previous?.find((i) => i.id === activeId)?.group_id;
    const movedUpdate = positionUpdates.find((u) => u.id === activeId);
    if (originalGroupId && movedUpdate && movedUpdate.group_id !== originalGroupId) {
      logActivity(activeId, 'moved_group', { from_group_id: originalGroupId, to_group_id: movedUpdate.group_id });
    }

    updateItemPositions(positionUpdates).catch(() => {
      if (previous) setItems(previous);
    });
  }

  return (
    <DndContext
      sensors={activeSensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="px-6 py-4">
        {orderingLocked && (
          <p className="mb-2 text-[11px] text-gray-400">Clear search, filters, or sort to drag-reorder items.</p>
        )}
        <div
          className="grid overflow-hidden rounded-md border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500"
          style={{ gridTemplateColumns: headerGridTemplate(columns.length) }}
        >
          <div />
          <div className="px-2 py-2">Item</div>
          {columns.map((column) => (
            <button
              key={column.id}
              onClick={() => toggleSort(column.id)}
              className="flex items-center gap-1 truncate border-l border-gray-200 px-2 py-2 text-left hover:bg-gray-100"
            >
              <span className="truncate">{column.name}</span>
              {sort?.columnId === column.id &&
                (sort.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
            </button>
          ))}
          <AddColumnButton onAdd={onAddColumn} />
        </div>

        <div className="mt-3">
          {groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              columns={columns}
              items={itemsByGroup[group.id] ?? []}
              orderingLocked={orderingLocked}
              members={members}
              onCellChange={onCellChange}
              onOptionsChange={onOptionsChange}
              onTitleChange={onTitleChange}
              onRenameGroup={onRenameGroup}
              onAddItem={onAddItem}
              onOpenItem={onOpenItem}
            />
          ))}
        </div>

        <button
          onClick={onAddGroup}
          className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600"
        >
          <Plus size={15} /> Add group
        </button>
      </div>

      <DragOverlay>
        {activeItem && (
          <div className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm shadow-lg">
            <GripVertical size={14} className="text-gray-300" />
            {activeItem.title}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
