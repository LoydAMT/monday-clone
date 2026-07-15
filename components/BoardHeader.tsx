'use client';

import { useState } from 'react';
import { Plus, Table2, LayoutGrid as KanbanIcon } from 'lucide-react';
import type { Board } from '@/types/database';

export function BoardHeader({
  board,
  view,
  onViewChange,
  onRenameBoard,
  onUpdateDescription,
  onNewItem,
}: {
  board: Board;
  view: 'table' | 'kanban';
  onViewChange: (view: 'table' | 'kanban') => void;
  onRenameBoard: (name: string) => void;
  onUpdateDescription: (description: string) => void;
  onNewItem: () => void;
}) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && onRenameBoard(name.trim())}
            className="w-full truncate rounded px-1 -mx-1 text-xl font-semibold text-gray-900 outline-none hover:bg-gray-50 focus:bg-gray-50"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => onUpdateDescription(description)}
            placeholder="Add a description…"
            className="mt-1 w-full truncate rounded px-1 -mx-1 text-sm text-gray-500 outline-none hover:bg-gray-50 focus:bg-gray-50"
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-md border border-gray-200 p-0.5">
            <button
              onClick={() => onViewChange('table')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
                view === 'table' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <Table2 size={14} /> Table
            </button>
            <button
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${
                view === 'kanban' ? 'bg-[#0073ea] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <KanbanIcon size={14} /> Kanban
            </button>
          </div>

          <button
            onClick={onNewItem}
            className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
          >
            <Plus size={14} /> New Item
          </button>
        </div>
      </div>
    </div>
  );
}
