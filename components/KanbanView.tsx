'use client';

import { useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import type { CellValue, Column, Item, MemberProfile } from '@/types/database';
import { getCellValue } from '@/lib/cell-helpers';
import { StatusCell } from './cells/StatusCell';
import { PeopleCell } from './cells/PeopleCell';
import { DateCell } from './cells/DateCell';
import { TextCell } from './cells/TextCell';

export function KanbanView({
  columns,
  items,
  members = [],
  onCellChange,
  onTitleChange,
  onOpenItem,
}: {
  columns: Column[];
  items: Item[];
  members?: MemberProfile[];
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onOpenItem?: (itemId: string) => void;
}) {
  const statusColumns = useMemo(() => columns.filter((c) => c.type === 'status'), [columns]);
  const [statusColumnId, setStatusColumnId] = useState(statusColumns[0]?.id);
  const statusColumn = statusColumns.find((c) => c.id === statusColumnId) ?? statusColumns[0];

  const otherColumns = columns.filter((c) => c.id !== statusColumn?.id);

  if (!statusColumn) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-400">
        Add a Status column to use the Kanban view.
      </div>
    );
  }

  const buckets = statusColumn.options.statuses ?? [];
  const grouped: Record<string, Item[]> = { '': [] };
  for (const bucket of buckets) grouped[bucket.label] = [];
  for (const item of items) {
    const cell = getCellValue(statusColumn, item);
    const label = cell.type === 'status' ? cell.value : '';
    (grouped[label] ?? (grouped[label] = [])).push(item);
  }

  const columnOrder = ['', ...buckets.map((b) => b.label)];

  return (
    <div className="px-6 py-4">
      {statusColumns.length > 1 && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-gray-500">Group by:</span>
          <select
            value={statusColumn.id}
            onChange={(e) => setStatusColumnId(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          >
            {statusColumns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columnOrder.map((label) => {
          const bucket = buckets.find((b) => b.label === label);
          const bucketItems = grouped[label] ?? [];
          return (
            <div key={label || 'none'} className="w-72 shrink-0 rounded-md bg-gray-50">
              <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: bucket?.color ?? '#c4c4c4' }}
                />
                <span className="text-sm font-semibold text-gray-700">{label || 'No status'}</span>
                <span className="text-xs text-gray-400">({bucketItems.length})</span>
              </div>

              <div className="space-y-2 p-2">
                {bucketItems.map((item) => (
                  <div key={item.id} className="group relative rounded-md border border-gray-200 bg-white p-3 shadow-sm">
                    <button
                      type="button"
                      onClick={() => onOpenItem?.(item.id)}
                      className="absolute right-2 top-2 text-gray-300 opacity-0 hover:text-gray-500 group-hover:opacity-100"
                      title="Open item"
                    >
                      <Maximize2 size={12} />
                    </button>
                    <div className="mb-2 pr-4 text-sm font-medium text-gray-800">
                      <TextCell value={item.title} onChange={(title) => onTitleChange(item.id, title)} />
                    </div>

                    <div className="mb-2">
                      <StatusCell
                        column={statusColumn}
                        value={label}
                        onChange={(value) => onCellChange(item.id, statusColumn.id, { type: 'status', value })}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {otherColumns.map((column) => {
                        const cell = getCellValue(column, item);
                        if (column.type === 'people') {
                          return (
                            <PeopleCell
                              key={column.id}
                              value={cell.type === 'people' ? cell.value : []}
                              onChange={(value) => onCellChange(item.id, column.id, { type: 'people', value })}
                              members={members}
                            />
                          );
                        }
                        if (column.type === 'date' && cell.type === 'date' && cell.value) {
                          return (
                            <div key={column.id} className="text-xs text-gray-500">
                              <DateCell
                                value={cell.value}
                                onChange={(value) => onCellChange(item.id, column.id, { type: 'date', value })}
                              />
                            </div>
                          );
                        }
                        if (column.type === 'numeric' && cell.type === 'numeric' && cell.value !== null) {
                          return (
                            <span key={column.id} className="text-xs font-medium text-gray-500">
                              {column.name}: {cell.value.toLocaleString()}
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
