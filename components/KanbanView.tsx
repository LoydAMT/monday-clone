'use client';

import { useMemo, useState } from 'react';
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
import { GripVertical, Maximize2, Trash2 } from 'lucide-react';
import type { CellValue, Column, Item, MemberProfile } from '@/types/database';
import { getCellValue } from '@/lib/cell-helpers';
import { StatusCell } from './cells/StatusCell';
import { PeopleCell } from './cells/PeopleCell';
import { DateCell } from './cells/DateCell';
import { TextCell } from './cells/TextCell';

const NO_STATUS_ID = '__none__';

export function KanbanView({
  columns,
  items,
  members = [],
  onCellChange,
  onTitleChange,
  onOpenItem,
  onDeleteItem,
}: {
  columns: Column[];
  items: Item[];
  members?: MemberProfile[];
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onOpenItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
}) {
  const statusColumns = useMemo(() => columns.filter((c) => c.type === 'status'), [columns]);
  const [statusColumnId, setStatusColumnId] = useState(statusColumns[0]?.id);
  const statusColumn = statusColumns.find((c) => c.id === statusColumnId) ?? statusColumns[0];
  const [activeItem, setActiveItem] = useState<Item | null>(null);

  const otherColumns = columns.filter((c) => c.id !== statusColumn?.id);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (!statusColumn) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-400">
        Add a Status column to use the Kanban view.
      </div>
    );
  }

  const buckets = statusColumn.options.statuses ?? [];
  const grouped: Record<string, Item[]> = { [NO_STATUS_ID]: [] };
  for (const bucket of buckets) grouped[bucket.label] = [];
  for (const item of items) {
    const cell = getCellValue(statusColumn, item);
    const label = cell.type === 'status' && cell.value ? cell.value : NO_STATUS_ID;
    (grouped[label] ?? (grouped[label] = [])).push(item);
  }

  const columnOrder = [NO_STATUS_ID, ...buckets.map((b) => b.label)];

  function handleDragStart(event: DragStartEvent) {
    setActiveItem(items.find((i) => i.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !statusColumn) return;

    const targetLabel = String(over.id) === NO_STATUS_ID ? '' : String(over.id);
    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    const currentCell = getCellValue(statusColumn, item);
    const currentLabel = currentCell.type === 'status' ? currentCell.value : '';
    if (currentLabel === targetLabel) return;

    onCellChange(item.id, statusColumn.id, { type: 'status', value: targetLabel });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
          {columnOrder.map((id) => {
            const label = id === NO_STATUS_ID ? '' : id;
            const bucket = buckets.find((b) => b.label === label);
            const bucketItems = grouped[id] ?? [];
            return (
              <KanbanBucket key={id} id={id} label={label} color={bucket?.color} count={bucketItems.length}>
                {bucketItems.map((item) => (
                  <KanbanCard
                    key={item.id}
                    item={item}
                    statusColumn={statusColumn}
                    statusLabel={label}
                    otherColumns={otherColumns}
                    members={members}
                    onCellChange={onCellChange}
                    onTitleChange={onTitleChange}
                    onOpenItem={onOpenItem}
                    onDeleteItem={onDeleteItem}
                  />
                ))}
              </KanbanBucket>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeItem && (
          <div className="w-72 rounded-md border border-gray-300 bg-white p-3 shadow-lg">
            <p className="text-sm font-medium text-gray-800">{activeItem.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanBucket({
  id,
  label,
  color,
  count,
  children,
}: {
  id: string;
  label: string;
  color?: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`w-72 shrink-0 rounded-md bg-gray-50 ${isOver ? 'ring-2 ring-[#0073ea]' : ''}`}
    >
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color ?? '#c4c4c4' }} />
        <span className="text-sm font-semibold text-gray-700">{label || 'No status'}</span>
        <span className="text-xs text-gray-400">({count})</span>
      </div>

      <div className="min-h-[40px] space-y-2 p-2">{children}</div>
    </div>
  );
}

function KanbanCard({
  item,
  statusColumn,
  statusLabel,
  otherColumns,
  members,
  onCellChange,
  onTitleChange,
  onOpenItem,
  onDeleteItem,
}: {
  item: Item;
  statusColumn: Column;
  statusLabel: string;
  otherColumns: Column[];
  members: MemberProfile[];
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onOpenItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.4 : 1 }}
      className="group relative rounded-md border border-gray-200 bg-white p-3 shadow-sm"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1.5 top-2 cursor-grab text-gray-300 opacity-0 hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to move"
      >
        <GripVertical size={13} />
      </button>
      <div className="absolute right-2 top-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onOpenItem?.(item.id)}
          className="text-gray-300 opacity-0 hover:text-gray-500 group-hover:opacity-100"
          title="Open item"
        >
          <Maximize2 size={12} />
        </button>
        <button
          type="button"
          onClick={() => onDeleteItem?.(item.id)}
          className="text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
          title="Delete item"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="mb-2 px-4 text-sm font-medium text-gray-800">
        <TextCell value={item.title} onChange={(title) => onTitleChange(item.id, title)} />
      </div>

      <div className="mb-2">
        <StatusCell
          column={statusColumn}
          value={statusLabel}
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
                <DateCell value={cell.value} onChange={(value) => onCellChange(item.id, column.id, { type: 'date', value })} />
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
  );
}
