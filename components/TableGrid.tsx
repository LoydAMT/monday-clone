'use client';

import { forwardRef, useMemo, useRef, useState } from 'react';
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
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import type { CellValue, Column, ColumnOptions, Group, Item, MemberProfile } from '@/types/database';
import { GroupSection } from './GroupSection';
import { AddColumnButton } from './AddColumnButton';
import { ColumnHeaderMenu } from './ColumnHeaderMenu';
import { ColumnResizeHandle } from './ColumnResizeHandle';
import type { SortState } from './BoardToolbar';
import { columnWidth, handleTrackWidth, headerGridTemplate, ITEM_MIN_WIDTH, totalGridWidth } from '@/lib/grid';
import { logActivity, updateGroupPositions, updateItemPositions, type ItemPositionUpdate } from '@/lib/mutations';
import { useMediaQuery } from '@/lib/use-media-query';

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

type TableGridProps = {
  columns: Column[];
  groups: Group[];
  setGroups: (updater: Group[] | ((prev: Group[]) => Group[])) => void;
  items: Item[];
  setItems: (updater: Item[] | ((prev: Item[]) => Item[])) => void;
  orderingLocked?: boolean;
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;
  members?: MemberProfile[];
  attachmentCounts?: Record<string, number>;
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOptionsChange?: (columnId: string, options: ColumnOptions) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onAddItem: (groupId: string) => void;
  onImportItems?: (groupId: string, groupName: string, titles: string[]) => void;
  onAddGroup: () => void;
  onAddColumn: (name: string, type: Column['type']) => void;
  onOpenItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onRenameColumn?: (columnId: string, name: string) => void;
  onDeleteColumn?: (columnId: string) => void;
  onScrollTopChange?: (scrollTop: number) => void;
  canEdit?: boolean;
};

// Forwards a ref to the div that actually scrolls (both axes — see the
// sticky-header comment below) so BoardView can drive it back to top from
// its own "back to top" button on mobile; that button can't reach this
// div's internal scroll state any other way.
export const TableGrid = forwardRef<HTMLDivElement, TableGridProps>(function TableGrid(
  {
    columns,
    groups,
    setGroups,
    items,
    setItems,
    orderingLocked = false,
    sort = null,
    onSortChange,
    members = [],
    attachmentCounts = {},
    onCellChange,
    onOptionsChange,
    onTitleChange,
    onRenameGroup,
    onAddItem,
    onImportItems,
    onAddGroup,
    onAddColumn,
    onOpenItem,
    onDeleteItem,
    onRenameColumn,
    onDeleteColumn,
    onScrollTopChange,
    canEdit = true,
  },
  scrollRef
) {
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const snapshotRef = useRef<Item[] | null>(null);
  const [resizing, setResizing] = useState<{ columnId: string; width: number } | null>(null);
  const compact = useMediaQuery('(max-width: 639px)');

  // On mobile, the Item column starts wide (readable titles) but locks down
  // to a narrow 1/5-of-screen width as soon as you've scrolled the table —
  // trading title readability for more visible data columns once you've
  // shown intent to look at them. Boolean state means React only re-renders
  // at the moment the threshold is actually crossed (setState no-ops on an
  // unchanged value), not continuously on every scroll pixel.
  const [itemNarrowed, setItemNarrowed] = useState(false);
  const NARROW_SCROLL_THRESHOLD = 24;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    // This div (not BoardView's outer viewContainerRef) is the one that
    // actually scrolls vertically now — see the sticky-header comment below
    // — so it's also the one that has to report scroll position back up for
    // BoardView's mobile collapse-the-toolbar-on-scroll behavior.
    onScrollTopChange?.(e.currentTarget.scrollTop);

    if (!compact) return;
    const shouldNarrow = e.currentTarget.scrollLeft > NARROW_SCROLL_THRESHOLD;
    setItemNarrowed((prev) => (prev === shouldNarrow ? prev : shouldNarrow));
  }

  const narrowItemWidth = compact && itemNarrowed ? Math.round(window.innerWidth / 5) : undefined;

  // Desktop drag-resize of the Item column itself — separate from the
  // mobile narrow-on-scroll behavior above (narrowItemWidth wins when both
  // could apply, since that only happens in the compact/mobile context).
  const [itemColumnWidth, setItemColumnWidth] = useState<number | undefined>(undefined);
  const effectiveItemWidth = narrowItemWidth ?? itemColumnWidth;
  const mobileNarrowed = narrowItemWidth !== undefined;

  // Keep this array's length constant across renders (dnd-kit's internal
  // effects use it as a dependency list) — gating is done per-element via
  // each useSortable's own `disabled` flag instead of emptying this array.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  // While a column is being resized, swap in a provisional width everywhere
  // header/rows/summary compute their grid template from — otherwise the
  // header would resize live while rows stayed at the old width until drop.
  const effectiveColumns = resizing
    ? columns.map((c) => (c.id === resizing.columnId ? { ...c, options: { ...c.options, width: resizing.width } } : c))
    : columns;

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
    if (event.active.data.current?.type === 'group') {
      setActiveGroup(groups.find((g) => g.id === event.active.id) ?? null);
      return;
    }
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
    snapshotRef.current = items;
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.active.data.current?.type === 'group') return;
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

    if (active.data.current?.type === 'group') {
      setActiveGroup(null);
      if (!over || active.id === over.id) return;
      const oldIndex = groups.findIndex((g) => g.id === active.id);
      const newIndex = groups.findIndex((g) => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const previousGroups = groups;
      const reordered = arrayMove(groups, oldIndex, newIndex).map((g, index) => ({ ...g, position: index }));
      setGroups(reordered);
      updateGroupPositions(reordered.map((g) => ({ id: g.id, position: g.position }))).catch(() =>
        setGroups(previousGroups)
      );
      return;
    }

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
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full flex-col px-6 py-4">
        {orderingLocked && (
          <p className="mb-2 shrink-0 text-[11px] text-gray-400">Clear search, filters, or sort to drag-reorder items.</p>
        )}
        {/* Header and rows share one scroll container so they move together
            horizontally — enough columns (e.g. adding Progress on top of
            Status/People/Timeline/Link/Date/Files) push total width past the
            viewport, and without this the extra columns were unreachable.
            Each grid below gets an explicit pixel width (not just a
            min-w-fit wrapper) — fit-content sizing for a CSS Grid nested in
            a scroll container proved unreliable on some mobile browsers,
            squeezing columns to fit instead of triggering a scrollbar.
            No CSS scroll-snap here (deliberately) — snap-mandatory combined
            with the Item column's own position:sticky is unreliable (sticky
            + scroll-snap-align is a known rough edge across browsers), and it
            fought the narrow-on-scroll logic below: mandatory snap would
            carry you straight past the un-narrow threshold to the next
            column's snap point, making it impossible to scroll back to the
            wide/unlocked state. Free-scroll + the JS threshold below is what
            actually delivers "slide, then lock."
            This div also owns the *vertical* scroll rather than leaving that
            to the page — the header's sticky top-0 below only sticks to this
            div, so this has to be the thing that actually scrolls
            vertically, not just horizontally. Its height comes from CSS
            (min-h-0 flex-1, bounded in turn by BoardView's flex layout) —
            not a one-off JS measurement — so it self-corrects on every
            reflow instead of going stale the moment anything above it
            (BoardHeader wrapping, presence avatars loading in, etc.)
            changes height after mount. */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto" onScroll={handleScroll}>
          <div
            className="sticky top-0 z-20 grid rounded-t-md border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 max-sm:text-[10px]"
            style={{
              gridTemplateColumns: headerGridTemplate(effectiveColumns, compact, effectiveItemWidth, mobileNarrowed),
              width: totalGridWidth(effectiveColumns, compact, effectiveItemWidth, mobileNarrowed),
            }}
          >
            <div className="sticky left-0 z-10 bg-gray-50" />
            <div
              className="sticky z-10 flex items-center truncate bg-gray-50 px-2 py-2"
              style={{ left: handleTrackWidth(mobileNarrowed) }}
            >
              Item
              {!compact && (
                <ColumnResizeHandle
                  width={itemColumnWidth ?? ITEM_MIN_WIDTH}
                  onResizeStart={() => {}}
                  onResizeMove={setItemColumnWidth}
                  onResizeEnd={setItemColumnWidth}
                />
              )}
            </div>
            {columns.map((column) => (
              <div key={column.id} className="group relative flex items-center border-l border-gray-200 hover:bg-gray-100">
                <button
                  onClick={() => toggleSort(column.id)}
                  className="flex min-w-0 flex-1 items-center gap-1 truncate px-2 py-2 text-left"
                >
                  <span className="truncate">{column.name}</span>
                  {sort?.columnId === column.id &&
                    (sort.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </button>
                {canEdit && (
                  <ColumnHeaderMenu
                    column={column}
                    onRename={(name) => onRenameColumn?.(column.id, name)}
                    onDelete={() => onDeleteColumn?.(column.id)}
                  />
                )}
                {canEdit && (
                  <ColumnResizeHandle
                    width={columnWidth(column, compact)}
                    onResizeStart={() => setResizing({ columnId: column.id, width: columnWidth(column, compact) })}
                    onResizeMove={(width) => setResizing({ columnId: column.id, width })}
                    onResizeEnd={(width) => {
                      setResizing(null);
                      onOptionsChange?.(column.id, { ...column.options, width });
                    }}
                  />
                )}
              </div>
            ))}
            {canEdit ? <AddColumnButton onAdd={onAddColumn} /> : <div />}
          </div>

          <div className="mt-3">
            <SortableContext items={groups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {groups.map((group) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  columns={effectiveColumns}
                  compact={compact}
                  itemWidth={effectiveItemWidth}
                  narrowed={mobileNarrowed}
                  items={itemsByGroup[group.id] ?? []}
                  orderingLocked={orderingLocked}
                  members={members}
                  attachmentCounts={attachmentCounts}
                  onCellChange={onCellChange}
                  onOptionsChange={onOptionsChange}
                  onTitleChange={onTitleChange}
                  onRenameGroup={onRenameGroup}
                  onAddItem={onAddItem}
                  onImportItems={onImportItems}
                  onOpenItem={onOpenItem}
                  onDeleteItem={onDeleteItem}
                  canEdit={canEdit}
                />
              ))}
            </SortableContext>
          </div>

          {canEdit && (
            <button
              onClick={onAddGroup}
              className="sticky left-0 flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            >
              <Plus size={15} /> Add group
            </button>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeItem && (
          <div className="flex items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm shadow-lg">
            <GripVertical size={14} className="text-gray-300" />
            {activeItem.title}
          </div>
        )}
        {activeGroup && (
          <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 shadow-lg">
            <GripVertical size={14} className="text-gray-300" />
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: activeGroup.color }} />
            <span className="text-sm font-semibold" style={{ color: activeGroup.color }}>
              {activeGroup.name}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
});
