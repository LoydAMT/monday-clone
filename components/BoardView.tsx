'use client';

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BoardData, CellValue, Column, ColumnOptions, ColumnType, Group, Item, MemberProfile } from '@/types/database';
import { DEFAULT_STATUS_OPTIONS } from '@/types/database';
import { BoardHeader, type BoardViewMode } from './BoardHeader';
import { BoardToolbar, type ColumnFilter, type SortState } from './BoardToolbar';
import { TableGrid } from './TableGrid';
import { KanbanView } from './KanbanView';
import { GanttView } from './GanttView';
import { ItemDetailModal } from './ItemDetailModal';
import { TrashPanel } from './TrashPanel';
import { Toast, type ToastState } from './ui/Toast';
import { applyFilters, applySearch, applySort } from '@/lib/filter-sort';
import { createNotification } from '@/lib/notifications';
import {
  createNewColumn,
  createNewGroup,
  createNewItem,
  logActivity,
  renameGroup,
  restoreItem,
  softDeleteItem,
  updateBoard,
  updateColumnOptions,
  updateItemTitle,
  upsertCellData,
} from '@/lib/mutations';

export function BoardView({
  initialData,
  members = [],
  currentUserId,
}: {
  initialData: BoardData;
  members?: MemberProfile[];
  currentUserId: string;
}) {
  const [board, setBoard] = useState(initialData.board);
  const [columns, setColumns] = useState<Column[]>(initialData.columns);
  const [groups, setGroups] = useState<Group[]>(initialData.groups);
  const [items, setItems] = useState<Item[]>(initialData.items);
  const [view, setView] = useState<BoardViewMode>('table');
  const searchParams = useSearchParams();
  const [openItemId, setOpenItemId] = useState<string | null>(() => searchParams.get('item'));
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [sort, setSort] = useState<SortState | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>(initialData.attachmentCounts);

  function showToast(message: string, onUndo: () => void) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, onUndo });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 6000);
  }

  function handleAttachmentCountChange(itemId: string, delta: number) {
    setAttachmentCounts((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] ?? 0) + delta) }));
  }

  const orderingLocked = search.trim() !== '' || filters.length > 0 || sort !== null;

  const visibleItems = useMemo(() => {
    const searched = applySearch(items, columns, search);
    const filtered = applyFilters(searched, columns, filters);
    return applySort(filtered, columns, sort);
  }, [items, columns, search, filters, sort]);

  function handleRenameBoard(name: string) {
    const previous = board;
    setBoard((b) => ({ ...b, name }));
    updateBoard(board.id, { name }).catch(() => setBoard(previous));
  }

  function handleUpdateDescription(description: string) {
    const previous = board;
    setBoard((b) => ({ ...b, description }));
    updateBoard(board.id, { description }).catch(() => setBoard(previous));
  }

  function handleCellChange(itemId: string, columnId: string, value: CellValue) {
    const previous = items;
    const target = items.find((i) => i.id === itemId);
    if (!target) return;
    const previousValue = target.cells[columnId];

    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, cells: { ...item.cells, [columnId]: value } } : item))
    );
    const newCells = { ...target.cells, [columnId]: value };
    upsertCellData(itemId, newCells).catch(() => setItems(previous));

    const column = columns.find((c) => c.id === columnId);
    if (column?.type === 'status' && value.type === 'status' && previousValue?.type === 'status' && previousValue.value !== value.value) {
      logActivity(itemId, 'status_changed', { column_name: column.name, from: previousValue.value, to: value.value });
    }

    if (column?.type === 'people' && value.type === 'people') {
      const before = previousValue?.type === 'people' ? previousValue.value : [];
      const newlyAssigned = value.value.filter((id) => !before.includes(id) && id !== currentUserId);
      for (const userId of newlyAssigned) {
        createNotification(board.workspace_id, userId, 'assigned_to_item', {
          item_title: target.title,
          board_id: board.id,
          item_id: itemId,
        });
      }
    }
  }

  function handleTitleChange(itemId: string, title: string) {
    const previous = items;
    const previousTitle = previous.find((i) => i.id === itemId)?.title;
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, title } : item)));
    updateItemTitle(itemId, title, previousTitle).catch(() => setItems(previous));
  }

  function handleColumnOptionsChange(columnId: string, options: ColumnOptions) {
    const previous = columns;
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, options } : c)));
    updateColumnOptions(columnId, options).catch(() => setColumns(previous));
  }

  function handleDeleteItem(itemId: string) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setOpenItemId((id) => (id === itemId ? null : id));
    softDeleteItem(itemId).catch(() =>
      setItems((prev) => (prev.some((i) => i.id === itemId) ? prev : [...prev, item]))
    );

    showToast(`"${item.title || 'Item'}" moved to trash`, () => {
      setItems((prev) => (prev.some((i) => i.id === itemId) ? prev : [...prev, item]));
      restoreItem(itemId).catch(() => {});
    });
  }

  function handleRestoreItem(item: Item) {
    if (item.parent_item_id === null) {
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
    }
  }

  function handleRenameGroup(groupId: string, name: string) {
    const previous = groups;
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
    renameGroup(groupId, name).catch(() => setGroups(previous));
  }

  function handleAddItem(groupId: string) {
    const previous = items;
    const position = items.filter((i) => i.group_id === groupId).length;
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempItem: Item = {
      id: tempId,
      group_id: groupId,
      parent_item_id: null,
      title: 'New Item',
      cells: {},
      position,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, tempItem]);

    createNewItem(groupId, position, 'New Item')
      .then((created) => setItems((prev) => prev.map((i) => (i.id === tempId ? created : i))))
      .catch(() => setItems(previous));
  }

  function handleAddGroup() {
    const previous = groups;
    const position = groups.length;
    const tempId = `temp-${crypto.randomUUID()}`;
    const colors = ['#579bfc', '#00c875', '#fdab3d', '#a25ddc', '#e2445c', '#66ccff'];
    const tempGroup: Group = {
      id: tempId,
      board_id: board.id,
      name: 'New Group',
      color: colors[Math.floor(Math.random() * colors.length)],
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setGroups((prev) => [...prev, tempGroup]);

    createNewGroup(board.id, position, 'New Group')
      .then((created) => setGroups((prev) => prev.map((g) => (g.id === tempId ? created : g))))
      .catch(() => setGroups(previous));
  }

  function handleAddColumn(name: string, type: ColumnType) {
    const previous = columns;
    const position = columns.length;
    const options: ColumnOptions =
      type === 'status'
        ? { statuses: DEFAULT_STATUS_OPTIONS }
        : type === 'dropdown'
          ? { tags: DEFAULT_STATUS_OPTIONS }
          : type === 'rating'
            ? { ratingMax: 5 }
            : {};
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempColumn: Column = {
      id: tempId,
      board_id: board.id,
      name,
      type,
      options,
      position,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setColumns((prev) => [...prev, tempColumn]);

    createNewColumn(board.id, position, name, type, options)
      .then((created) => setColumns((prev) => prev.map((c) => (c.id === tempId ? created : c))))
      .catch(() => setColumns(previous));
  }

  const openItem = items.find((i) => i.id === openItemId) ?? null;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-y-auto">
      <BoardHeader
        board={board}
        view={view}
        onViewChange={setView}
        onRenameBoard={handleRenameBoard}
        onUpdateDescription={handleUpdateDescription}
        onNewItem={() => groups[0] && handleAddItem(groups[0].id)}
        onOpenTrash={() => setTrashOpen(true)}
      />

      <BoardToolbar
        columns={columns}
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        members={members}
      />

      {view === 'table' ? (
        <TableGrid
          columns={columns}
          groups={groups}
          items={visibleItems}
          setItems={setItems}
          orderingLocked={orderingLocked}
          sort={sort}
          onSortChange={setSort}
          members={members}
          attachmentCounts={attachmentCounts}
          onCellChange={handleCellChange}
          onOptionsChange={handleColumnOptionsChange}
          onTitleChange={handleTitleChange}
          onRenameGroup={handleRenameGroup}
          onAddItem={handleAddItem}
          onAddGroup={handleAddGroup}
          onAddColumn={handleAddColumn}
          onOpenItem={setOpenItemId}
        />
      ) : view === 'kanban' ? (
        <KanbanView
          columns={columns}
          items={visibleItems}
          members={members}
          onCellChange={handleCellChange}
          onTitleChange={handleTitleChange}
          onOpenItem={setOpenItemId}
        />
      ) : (
        <GanttView
          columns={columns}
          groups={groups}
          items={visibleItems}
          onCellChange={handleCellChange}
          onOpenItem={setOpenItemId}
        />
      )}

      {openItem && (
        <ItemDetailModal
          item={openItem}
          columns={columns}
          groups={groups}
          members={members}
          workspaceId={board.workspace_id}
          boardId={board.id}
          currentUserId={currentUserId}
          onClose={() => setOpenItemId(null)}
          onCellChange={handleCellChange}
          onOptionsChange={handleColumnOptionsChange}
          onTitleChange={handleTitleChange}
          onDeleteItem={handleDeleteItem}
          onUndoableAction={showToast}
          attachmentCount={attachmentCounts[openItem.id] ?? 0}
          onAttachmentCountChange={handleAttachmentCountChange}
        />
      )}

      {trashOpen && (
        <TrashPanel groups={groups} onClose={() => setTrashOpen(false)} onRestore={handleRestoreItem} />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
