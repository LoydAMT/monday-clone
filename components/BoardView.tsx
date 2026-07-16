'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useBoardPresence } from '@/lib/use-board-presence';
import { avatarColor, initials } from '@/lib/avatar-color';
import type {
  Automation,
  BoardData,
  BoardShareLink,
  CellValue,
  Column,
  ColumnOptions,
  ColumnType,
  Group,
  Item,
  MemberProfile,
} from '@/types/database';
import { DEFAULT_STATUS_OPTIONS } from '@/types/database';
import { BoardHeader, type BoardViewMode } from './BoardHeader';
import { BoardToolbar, type ColumnFilter, type SortState } from './BoardToolbar';
import { TableGrid } from './TableGrid';
import { KanbanView } from './KanbanView';
import { GanttView } from './GanttView';
import { ItemDetailModal } from './ItemDetailModal';
import { TrashPanel } from './TrashPanel';
import { AutomationsPanel } from './AutomationsPanel';
import { ShareLinksPanel } from './ShareLinksPanel';
import { Toast, type ToastState } from './ui/Toast';
import { applyFilters, applySearch, applySort } from '@/lib/filter-sort';
import { boardToCsv, downloadTextFile, exportNodeAsPdf, exportNodeAsPng } from '@/lib/export';
import { formatCellValue } from '@/lib/cell-format';
import { today } from '@/lib/gantt';
import { createNotification } from '@/lib/notifications';
import {
  createNewColumn,
  createNewGroup,
  createNewItem,
  deleteColumn,
  getAutomationRunItemIds,
  logActivity,
  recordAutomationRun,
  renameColumn,
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
  initialAutomations = [],
  initialShareLinks = [],
}: {
  initialData: BoardData;
  members?: MemberProfile[];
  currentUserId: string;
  initialAutomations?: Automation[];
  initialShareLinks?: BoardShareLink[];
}) {
  const [board, setBoard] = useState(initialData.board);
  const [columns, setColumns] = useState<Column[]>(initialData.columns);
  const [groups, setGroups] = useState<Group[]>(initialData.groups);
  const [items, setItems] = useState<Item[]>(initialData.items);
  const [view, setView] = useState<BoardViewMode>('table');
  const searchParams = useSearchParams();
  const [openItemId, setOpenItemId] = useState<string | null>(() => searchParams.get('item'));

  // Clicking a mention/assignment notification for an item on the board
  // you're already viewing only changes the `item` query param — Next.js
  // reuses this mounted component rather than remounting it, so the
  // useState initializer above never re-runs on its own. Re-sync whenever
  // the param changes so the deep link still opens the modal in that case.
  useEffect(() => {
    const id = searchParams.get('item');
    if (id) setOpenItemId(id);
  }, [searchParams]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ColumnFilter[]>([]);
  const [sort, setSort] = useState<SortState | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [automations, setAutomations] = useState<Automation[]>(initialAutomations);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLinks, setShareLinks] = useState<BoardShareLink[]>(initialShareLinks);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>(initialData.attachmentCounts);
  const [exporting, setExporting] = useState(false);
  const viewContainerRef = useRef<HTMLDivElement>(null);

  const me = members.find((m) => m.user_id === currentUserId);
  const myRole = me?.role;
  const canEdit = myRole !== 'viewer';

  const presenceUsers = useBoardPresence(
    board.id,
    { user_id: currentUserId, email: me?.email ?? '', full_name: me?.full_name ?? null },
    view,
    viewContainerRef
  );
  const visibleCursors = presenceUsers.filter((u) => u.view === view && u.cursor);

  // Kept in sync with `groups` so the realtime item handler below can check
  // "is this item one of ours" without depending on (and re-subscribing on)
  // every groups change.
  const groupIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    groupIdsRef.current = new Set(groups.map((g) => g.id));
  }, [groups]);

  // Live sync: other viewers' edits to this board's groups/columns/items
  // appear here without a refresh. `boards`/`groups`/`columns`/`items` are
  // already in the supabase_realtime publication (0001_init.sql), so this
  // needs no schema change. Subscriptions are unfiltered rather than using
  // Realtime's `filter` option: DELETE payloads only carry the primary key
  // by default (replica identity), so a `board_id=eq.` filter would silently
  // drop delete events — checking board/group membership client-side against
  // `payload.new` (always complete) is simpler and correct for every event
  // type. A no-op filter/removal for another board's row is harmless.
  useEffect(() => {
    const supabase = createClient();
    const boardId = board.id;
    const channel = supabase
      .channel(`board-${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setGroups((prev) => prev.filter((g) => g.id !== oldId));
          return;
        }
        const row = payload.new as Group;
        if (row.board_id !== boardId) return;
        setGroups((prev) => (prev.some((g) => g.id === row.id) ? prev.map((g) => (g.id === row.id ? row : g)) : [...prev, row]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'columns' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) setColumns((prev) => prev.filter((c) => c.id !== oldId));
          return;
        }
        const row = payload.new as Column;
        if (row.board_id !== boardId) return;
        setColumns((prev) => (prev.some((c) => c.id === row.id) ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row]));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const oldId = (payload.old as { id?: string }).id;
          if (oldId) {
            setItems((prev) => prev.filter((i) => i.id !== oldId));
            setOpenItemId((id) => (id === oldId ? null : id));
          }
          return;
        }
        const row = payload.new as Item;
        setItems((prev) => {
          const exists = prev.some((i) => i.id === row.id);
          if (row.deleted_at) return exists ? prev.filter((i) => i.id !== row.id) : prev;
          if (exists) return prev.map((i) => (i.id === row.id ? row : i));
          if (!groupIdsRef.current.has(row.group_id)) return prev;
          return [...prev, row];
        });
        if (row.deleted_at) setOpenItemId((id) => (id === row.id ? null : id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [board.id]);

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
    if (!canEdit) return;
    const previous = board;
    setBoard((b) => ({ ...b, name }));
    updateBoard(board.id, { name }).catch(() => setBoard(previous));
  }

  function handleUpdateDescription(description: string) {
    if (!canEdit) return;
    const previous = board;
    setBoard((b) => ({ ...b, description }));
    updateBoard(board.id, { description }).catch(() => setBoard(previous));
  }

  function handleCellChange(itemId: string, columnId: string, value: CellValue) {
    if (!canEdit) return;
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
    // Every column type gets logged (not just Status) — file cells have no
    // value of their own to compare (attachments log their own add/remove).
    if (column && column.type !== 'file') {
      const from = previousValue ? formatCellValue(previousValue, members) : '';
      const to = formatCellValue(value, members);
      if (from !== to) {
        logActivity(itemId, 'cell_changed', { column_name: column.name, from, to });
      }
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

    // "When Status changes to X, notify someone" automations.
    if (column?.type === 'status' && value.type === 'status' && previousValue?.type === 'status' && previousValue.value !== value.value) {
      const matches = automations.filter(
        (a) => a.trigger_type === 'status_changed' && a.trigger_column_id === columnId && a.trigger_value === value.value
      );
      for (const automation of matches) {
        if (!automation.action_user_id) continue;
        createNotification(board.workspace_id, automation.action_user_id, 'automation_notify', {
          item_title: target.title,
          board_id: board.id,
          item_id: itemId,
          column_name: column.name,
          status_value: value.value,
        });
      }
    }
  }

  // "When a date passes, change Status" automations. There's no server-side
  // scheduler in this project, so this is a "catch up since last visit"
  // scan run once whenever the board's automation rules load, rather than a
  // true at-midnight trigger — automation_runs (checked per automation
  // below) makes sure each item is only ever affected once, so it won't
  // fight a status you changed back manually on a later visit.
  useEffect(() => {
    if (!canEdit) return;
    const dateAutomations = automations.filter((a) => a.trigger_type === 'date_passed');
    if (dateAutomations.length === 0) return;

    let cancelled = false;

    (async () => {
      const todayStr = today();
      for (const automation of dateAutomations) {
        const dateColumn = columns.find((c) => c.id === automation.trigger_column_id);
        const statusColumn = columns.find((c) => c.id === automation.action_column_id);
        if (!dateColumn || !statusColumn || !automation.action_value) continue;

        const alreadyRan = await getAutomationRunItemIds(automation.id);
        if (cancelled) return;

        for (const item of items) {
          if (alreadyRan.has(item.id)) continue;
          const dateCell = item.cells[dateColumn.id];
          if (dateCell?.type !== 'date' || !dateCell.value || dateCell.value >= todayStr) continue;

          const statusCell = item.cells[statusColumn.id];
          const currentValue = statusCell?.type === 'status' ? statusCell.value : '';
          if (currentValue !== automation.action_value) {
            handleCellChange(item.id, statusColumn.id, { type: 'status', value: automation.action_value });
          }
          recordAutomationRun(automation.id, item.id);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only re-run when the rule set itself changes, not on every item edit —
    // this is a background catch-up pass, not a live per-keystroke trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automations]);

  function handleTitleChange(itemId: string, title: string) {
    if (!canEdit) return;
    const previous = items;
    const previousTitle = previous.find((i) => i.id === itemId)?.title;
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, title } : item)));
    updateItemTitle(itemId, title, previousTitle).catch(() => setItems(previous));
  }

  function handleColumnOptionsChange(columnId: string, options: ColumnOptions) {
    if (!canEdit) return;
    const previous = columns;
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, options } : c)));
    updateColumnOptions(columnId, options).catch(() => setColumns(previous));
  }

  function handleRenameColumn(columnId: string, name: string) {
    if (!canEdit) return;
    const previous = columns;
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name } : c)));
    renameColumn(columnId, name).catch(() => setColumns(previous));
  }

  function handleDeleteColumn(columnId: string) {
    if (!canEdit) return;
    const previous = columns;
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    deleteColumn(columnId).catch(() => setColumns(previous));
  }

  function handleDeleteItem(itemId: string) {
    if (!canEdit) return;
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
    if (!canEdit) return;
    if (item.parent_item_id === null) {
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item]));
    }
  }

  function handleRenameGroup(groupId: string, name: string) {
    if (!canEdit) return;
    const previous = groups;
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
    renameGroup(groupId, name).catch(() => setGroups(previous));
  }

  function handleAddItem(groupId: string) {
    if (!canEdit) return;
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
    if (!canEdit) return;
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
    if (!canEdit) return;
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

  async function handleExport() {
    if (exporting) return;
    const safeName = (board.name || 'board').replace(/[\\/:*?"<>|]/g, '-');
    if (view === 'table') {
      downloadTextFile(`${safeName}.csv`, boardToCsv(columns, groups, visibleItems, members), 'text/csv;charset=utf-8;');
      return;
    }
    if (!viewContainerRef.current) return;
    // Kanban/Gantt each scroll horizontally inside their own nested div, not
    // viewContainerRef itself (which never overflows), so capturing
    // viewContainerRef directly only ever grabbed whatever was currently
    // visible in the clipped viewport. The actual scrolling element is
    // marked with data-export-root — its scrollWidth/scrollHeight reflects
    // the true full content size.
    const exportNode =
      viewContainerRef.current.querySelector<HTMLElement>('[data-export-root]') ?? viewContainerRef.current;
    setExporting(true);
    try {
      if (view === 'gantt') {
        await exportNodeAsPdf(exportNode, `${safeName}-gantt.pdf`);
      } else {
        await exportNodeAsPng(exportNode, `${safeName}-${view}.png`);
      }
    } finally {
      setExporting(false);
    }
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
        onOpenAutomations={() => setAutomationsOpen(true)}
        onOpenShare={() => setShareOpen(true)}
        onExport={handleExport}
        exporting={exporting}
        canEdit={canEdit}
        presenceUsers={presenceUsers}
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

      <div ref={viewContainerRef} className="relative">
        {visibleCursors.map((u) => (
          <div
            key={u.user_id}
            className="pointer-events-none absolute z-40 flex items-center gap-1 transition-[left,top] duration-100"
            style={{ left: u.cursor!.x, top: u.cursor!.y }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill={avatarColor(u.user_id)} className="drop-shadow">
              <path d="M1 1l6.5 13.5L9 9l5.5-1.5z" />
            </svg>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
              style={{ backgroundColor: avatarColor(u.user_id) }}
            >
              {initials(u)}
            </span>
          </div>
        ))}
        {view === 'table' ? (
          <TableGrid
            columns={columns}
            groups={groups}
            setGroups={setGroups}
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
            onDeleteItem={handleDeleteItem}
            onRenameColumn={handleRenameColumn}
            onDeleteColumn={handleDeleteColumn}
            canEdit={canEdit}
          />
        ) : view === 'kanban' ? (
          <KanbanView
            columns={columns}
            items={visibleItems}
            members={members}
            onCellChange={handleCellChange}
            onTitleChange={handleTitleChange}
            onOpenItem={setOpenItemId}
            onDeleteItem={handleDeleteItem}
            canEdit={canEdit}
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
      </div>

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
          canEdit={canEdit}
        />
      )}

      {trashOpen && (
        <TrashPanel groups={groups} onClose={() => setTrashOpen(false)} onRestore={handleRestoreItem} canEdit={canEdit} />
      )}

      {automationsOpen && (
        <AutomationsPanel
          boardId={board.id}
          columns={columns}
          members={members}
          automations={automations}
          onClose={() => setAutomationsOpen(false)}
          onCreate={(automation) => setAutomations((prev) => [...prev, automation])}
          onDelete={(id) => setAutomations((prev) => prev.filter((a) => a.id !== id))}
          canEdit={canEdit}
        />
      )}

      {shareOpen && (
        <ShareLinksPanel
          boardId={board.id}
          links={shareLinks}
          onClose={() => setShareOpen(false)}
          onCreate={(link) => setShareLinks((prev) => [...prev, link])}
          onRevoke={(id) =>
            setShareLinks((prev) => prev.map((l) => (l.id === id ? { ...l, revoked_at: new Date().toISOString() } : l)))
          }
          canEdit={canEdit}
        />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
