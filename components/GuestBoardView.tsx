'use client';

import { useState } from 'react';
import { Eye, GanttChartSquare, Table2, LayoutGrid as KanbanIcon } from 'lucide-react';
import type { Board, Column, Group, Item } from '@/types/database';
import { TableGrid } from './TableGrid';
import { KanbanView } from './KanbanView';
import { GanttView } from './GanttView';

type GuestViewMode = 'table' | 'kanban' | 'gantt';

function noop() {}

// Read-only rendering of a shared board for people without an account.
// Reuses the same TableGrid/KanbanView/GanttView the authenticated board
// page uses, with canEdit={false} (same inert-cell treatment the viewer
// role already gets) and no-op mutation handlers — no new "read-only mode"
// had to be built. Per the share-link scope, no comments/activity/
// attachments: onOpenItem is a no-op, so clicking an item never opens
// ItemDetailModal (which is where those live).
export function GuestBoardView({
  board,
  columns,
  groups,
  items,
}: {
  board: Board;
  columns: Column[];
  groups: Group[];
  items: Item[];
}) {
  const [view, setView] = useState<GuestViewMode>('table');
  const [groupsState, setGroupsState] = useState(groups);
  const [itemsState, setItemsState] = useState(items);

  return (
    <div className="flex h-screen flex-col overflow-y-auto bg-[#f6f7fb]">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900">{board.name}</h1>
            {board.description && <p className="mt-1 truncate text-sm text-gray-500">{board.description}</p>}
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
            <Eye size={11} /> View only
          </span>
        </div>

        <div className="mt-3 flex w-fit rounded-md border border-gray-200 p-0.5">
          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
              view === 'table' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Table2 size={14} /> <span className="hidden sm:inline">Table</span>
          </button>
          <button
            onClick={() => setView('kanban')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
              view === 'kanban' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <KanbanIcon size={14} /> <span className="hidden sm:inline">Kanban</span>
          </button>
          <button
            onClick={() => setView('gantt')}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
              view === 'gantt' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <GanttChartSquare size={14} /> <span className="hidden sm:inline">Gantt</span>
          </button>
        </div>
      </div>

      <div className="flex-1">
        {view === 'table' ? (
          <TableGrid
            columns={columns}
            groups={groupsState}
            setGroups={setGroupsState}
            items={itemsState}
            setItems={setItemsState}
            onCellChange={noop}
            onTitleChange={noop}
            onRenameGroup={noop}
            onAddItem={noop}
            onAddGroup={noop}
            onAddColumn={noop}
            onOpenItem={noop}
            canEdit={false}
          />
        ) : view === 'kanban' ? (
          <KanbanView columns={columns} items={itemsState} onCellChange={noop} onTitleChange={noop} onOpenItem={noop} canEdit={false} />
        ) : (
          <GanttView columns={columns} groups={groupsState} items={itemsState} onCellChange={noop} onOpenItem={noop} />
        )}
      </div>
    </div>
  );
}
