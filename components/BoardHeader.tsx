'use client';

import { useState } from 'react';
import { Download, Eye, GanttChartSquare, Plus, Table2, LayoutGrid as KanbanIcon, Trash2 } from 'lucide-react';
import type { Board } from '@/types/database';

export type BoardViewMode = 'table' | 'kanban' | 'gantt';

export function BoardHeader({
  board,
  view,
  onViewChange,
  onRenameBoard,
  onUpdateDescription,
  onNewItem,
  onOpenTrash,
  onExport,
  exporting = false,
  canEdit = true,
}: {
  board: Board;
  view: BoardViewMode;
  onViewChange: (view: BoardViewMode) => void;
  onRenameBoard: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onNewItem: () => void;
  onOpenTrash: () => void;
  onExport?: () => void;
  exporting?: boolean;
  canEdit?: boolean;
}) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && onRenameBoard(name.trim())}
              readOnly={!canEdit}
              className="w-full truncate rounded px-1 -mx-1 text-xl font-semibold text-gray-900 outline-none hover:bg-gray-50 focus:bg-gray-50"
            />
            {!canEdit && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
                <Eye size={11} /> Viewing only
              </span>
            )}
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onUpdateDescription(description)}
            placeholder="Add a description…"
            readOnly={!canEdit}
            className="mt-1 w-full truncate rounded px-1 -mx-1 text-sm text-gray-500 outline-none hover:bg-gray-50 focus:bg-gray-50"
          />
        </div>

        <div className="flex flex-wrap shrink-0 items-center gap-2">
          {onExport && (
            <button
              onClick={onExport}
              disabled={exporting}
              title={view === 'table' ? 'Export as CSV' : 'Export as image'}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            >
              <Download size={15} />
            </button>
          )}
          <button
            onClick={onOpenTrash}
            title="Trash"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Trash2 size={15} />
          </button>

          <div className="flex rounded-md border border-gray-200 p-0.5">
            <button
              onClick={() => onViewChange('table')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
                view === 'table' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Table2 size={14} /> <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
                view === 'kanban' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <KanbanIcon size={14} /> <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => onViewChange('gantt')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
                view === 'gantt' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <GanttChartSquare size={14} /> <span className="hidden sm:inline">Gantt</span>
            </button>
          </div>

          {canEdit && (
            <button
              onClick={onNewItem}
              className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
            >
              <Plus size={14} /> <span className="hidden sm:inline">New Item</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
