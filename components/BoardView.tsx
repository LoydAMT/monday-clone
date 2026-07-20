'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useBoardPresence } from '@/lib/use-board-presence';
import { useMediaQuery } from '@/lib/use-media-query';
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
  LinkedItemSummary,
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
import { addLinkedItem, removeLinkedItem } from '@/lib/linked-items';
import {
  createItems,
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
  siblingBoards = [],
}: {
  initialData: BoardData;
  members?: MemberProfile[];
  currentUserId: string;
  initialAutomations?: Automation[];
  initialShareLinks?: BoardShareLink[];
  // Other boards in this workspace a new linked_record column could target —
  // fetched once server-side (getSiblingBoards), not something that changes
  // during a session, so it's a plain prop rather than state.
  siblingBoards?: { id: string; name: string }[];
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
  // useState initializer above never re-runs on its own. Tracking the last
  // seen param and re-syncing here (React's own recommended alternative to
  // an effect for "adjust state when a prop/value changes") picks up the
  // deep link in that case without an extra post-commit render pass.
  const [lastSyncedItemParam, setLastSyncedItemParam] = useState(() => searchParams.get('item'));
  const currentItemParam = searchParams.get('item');
  if (currentItemParam !== lastSyncedItemParam) {
    setLastSyncedItemParam(currentItemParam);
    if (currentItemParam) setOpenItemId(currentItemParam);
  }
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
  const [linkedRecordsByCell, setLinkedRecordsByCell] = useState<Record<string, LinkedItemSummary[]>>(
    initialData.linkedRecordsByCell
  );
  const [exporting, setExporting] = useState(false);
  const viewContainerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  // On mobile, BoardHeader + BoardToolbar eat a lot of the limited vertical
  // space — once you've scrolled down into the items, collapse them out of
  // the way and leave just a small "back to top" button, matching the
  // SCROLL_HIDE_THRESHOLD pattern already used for the Item column's
  // narrow-on-scroll behavior (small threshold so trivial scroll bounces
  // don't flicker it).
  const compact = useMediaQuery('(max-width: 639px)');
  const [scrolledPastTop, setScrolledPastTop] = useState(false);
  const SCROLL_HIDE_THRESHOLD = 24;

  // Kanban/Gantt overflow viewContainerRef itself (it's their real scroll
  // container), but Table view now manages its own internal scroll region
  // (see TableGrid's sticky-header handling) — viewContainerRef never
  // scrolls there, so TableGrid reports its scrollTop up separately via
  // onScrollTopChange instead of a scroll event ever reaching this div.
  function updateScrolledPastTop(scrollTop: number) {
    if (!compact) return;
    const shouldHide = scrollTop > SCROLL_HIDE_THRESHOLD;
    setScrolledPastTop((prev) => (prev === shouldHide ? prev : shouldHide));
  }

  function handleViewScroll(e: React.UIEvent<HTMLDivElement>) {
    updateScrolledPastTop(e.currentTarget.scrollTop);
  }

  function scrollToTop() {
    setScrolledPastTop(false);
    // Table view scrolls inside its own internal div (tableScrollRef), not
    // viewContainerRef — see updateScrolledPastTop above.
    (view === 'table' ? tableScrollRef.current : viewContainerRef.current)?.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

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

  function handleToggleEmailNotifications(enabled: boolean) {
    if (!canEdit) return;
    const previous = board;
    setBoard((b) => ({ ...b, email_notifications_enabled: enabled }));
    updateBoard(board.id, { email_notifications_enabled: enabled }).catch(() => setBoard(previous));
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

  function handleImportItems(groupId: string, groupName: string, titles: string[]) {
    if (!canEdit) return;
    if (groupName) handleRenameGroup(groupId, groupName);
    if (titles.length === 0) return;

    const previous = items;
    const startPosition = items.filter((i) => i.group_id === groupId).length;
    const tempItems: Item[] = titles.map((title, i) => ({
      id: `temp-${crypto.randomUUID()}`,
      group_id: groupId,
      parent_item_id: null,
      title,
      cells: {},
      position: startPosition + i,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    setItems((prev) => [...prev, ...tempItems]);

    createItems(groupId, titles, startPosition)
      .then((created) =>
        setItems((prev) => {
          const withoutTemps = prev.filter((i) => !tempItems.some((t) => t.id === i.id));
          return [...withoutTemps, ...created];
        })
      )
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

  function handleAddColumn(name: string, type: ColumnType, extraOptions?: Partial<ColumnOptions>) {
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
            : type === 'linked_record'
              ? { linkedBoardId: extraOptions?.linkedBoardId }
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

  function handleAddLinkedRecord(columnId: string, itemId: string, targetItemId: string, targetTitle: string) {
    if (!canEdit) return;
    const columnName = columns.find((c) => c.id === columnId)?.name ?? 'Linked record';
    const key = `${columnId}:${itemId}`;
    const previous = linkedRecordsByCell[key] ?? [];
    const tempLinkId = `temp-${crypto.randomUUID()}`;
    setLinkedRecordsByCell((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), { linkId: tempLinkId, itemId: targetItemId, title: targetTitle }],
    }));

    addLinkedItem(columnId, columnName, itemId, targetItemId, targetTitle)
      .then(({ id }) =>
        setLinkedRecordsByCell((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).map((r) => (r.linkId === tempLinkId ? { ...r, linkId: id } : r)),
        }))
      )
      .catch(() => setLinkedRecordsByCell((prev) => ({ ...prev, [key]: previous })));
  }

  function handleRemoveLinkedRecord(columnId: string, itemId: string, linkId: string) {
    if (!canEdit) return;
    const columnName = columns.find((c) => c.id === columnId)?.name ?? 'Linked record';
    const key = `${columnId}:${itemId}`;
    const previous = linkedRecordsByCell[key] ?? [];
    const removedTitle = previous.find((r) => r.linkId === linkId)?.title ?? '';
    setLinkedRecordsByCell((prev) => ({ ...prev, [key]: previous.filter((r) => r.linkId !== linkId) }));

    removeLinkedItem(linkId, itemId, columnName, removedTitle).catch(() =>
      setLinkedRecordsByCell((prev) => ({ ...prev, [key]: previous }))
    );
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

  const headerCollapsed = compact && scrolledPastTop;

  return (
    <div className="flex h-screen flex-1 flex-col overflow-hidden">
      <div
        className={`shrink-0 overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
          headerCollapsed ? 'max-h-0 opacity-0' : 'max-h-[480px] opacity-100'
        }`}
      >
        <BoardHeader
          board={board}
          view={view}
          onViewChange={setView}
          onRenameBoard={handleRenameBoard}
          onUpdateDescription={handleUpdateDescription}
          onNewItem={() => groups[0] && handleAddItem(groups[0].id)}
          onOpenTrash={() => setTrashOpen(true)}
          onOpenAutomations={() => setAutomationsOpen(true)}
          onToggleEmailNotifications={handleToggleEmailNotifications}
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
      </div>

      {headerCollapsed && (
        <button
          type="button"
          onClick={scrollToTop}
          title="Back to top"
          className="fixed left-1/2 top-2 z-50 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-gray-900/80 text-white shadow-lg backdrop-blur hover:bg-gray-900"
        >
          <ArrowUp size={16} />
        </button>
      )}

      <div ref={viewContainerRef} className="relative min-h-0 flex-1 overflow-y-auto" onScroll={handleViewScroll}>
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
            ref={tableScrollRef}
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
            linkedRecordsByCell={linkedRecordsByCell}
            boards={siblingBoards}
            onCellChange={handleCellChange}
            onOptionsChange={handleColumnOptionsChange}
            onTitleChange={handleTitleChange}
            onRenameGroup={handleRenameGroup}
            onAddItem={handleAddItem}
            onImportItems={handleImportItems}
            onAddGroup={handleAddGroup}
            onAddColumn={handleAddColumn}
            onOpenItem={setOpenItemId}
            onDeleteItem={handleDeleteItem}
            onAddLinkedRecord={handleAddLinkedRecord}
            onRemoveLinkedRecord={handleRemoveLinkedRecord}
            onRenameColumn={handleRenameColumn}
            onDeleteColumn={handleDeleteColumn}
            onScrollTopChange={updateScrolledPastTop}
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
          linkedRecordsByCell={linkedRecordsByCell}
          onAddLinkedRecord={handleAddLinkedRecord}
          onRemoveLinkedRecord={handleRemoveLinkedRecord}
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
