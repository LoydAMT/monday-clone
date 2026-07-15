'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Maximize2, Trash2 } from 'lucide-react';
import type { CellValue, Column, ColumnOptions, Item, MemberProfile } from '@/types/database';
import { Cell } from './cells/Cell';
import { getCellValue } from '@/lib/cell-helpers';
import { rowGridTemplate } from '@/lib/grid';
import { TextCell } from './cells/TextCell';

export function ItemRow({
  item,
  columns,
  orderingLocked = false,
  members = [],
  attachmentCounts = {},
  onCellChange,
  onOptionsChange,
  onTitleChange,
  onOpenItem,
  onDeleteItem,
  canEdit = true,
}: {
  item: Item;
  columns: Column[];
  orderingLocked?: boolean;
  members?: MemberProfile[];
  attachmentCounts?: Record<string, number>;
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOptionsChange?: (columnId: string, options: ColumnOptions) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onOpenItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  canEdit?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'item' },
    disabled: orderingLocked || !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, gridTemplateColumns: rowGridTemplate(columns) }}
      className="group grid border-t border-gray-100 bg-white hover:bg-blue-50/30"
    >
      {orderingLocked || !canEdit ? (
        <div className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/30" />
      ) : (
        <button
          {...attributes}
          {...listeners}
          className="sticky left-0 z-10 flex cursor-grab items-center justify-center bg-white text-gray-300 opacity-0 hover:text-gray-500 group-hover:bg-blue-50/30 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </button>
      )}

      <div className="sticky left-[36px] z-10 flex items-center gap-1 border-r border-gray-100 bg-white px-1 text-sm text-gray-800 group-hover:bg-blue-50/30">
        <button
          type="button"
          onClick={() => onOpenItem?.(item.id)}
          className="shrink-0 text-gray-300 opacity-0 hover:text-gray-500 group-hover:opacity-100"
          title="Open item"
        >
          <Maximize2 size={12} />
        </button>
        <div className={`min-w-0 flex-1 ${!canEdit ? 'pointer-events-none' : ''}`}>
          <TextCell value={item.title} onChange={(title) => onTitleChange(item.id, title)} />
        </div>
      </div>

      {columns.map((column) => {
        const readOnlyCell = !canEdit && column.type !== 'file';
        return (
          <div
            key={column.id}
            className={`flex items-center justify-center border-r border-gray-100 ${
              readOnlyCell ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <Cell
              column={column}
              cellValue={getCellValue(column, item)}
              onChange={(value) => onCellChange(item.id, column.id, value)}
              onOptionsChange={(options) => onOptionsChange?.(column.id, options)}
              members={members}
              onOpenItem={() => onOpenItem?.(item.id)}
              attachmentCount={attachmentCounts[item.id] ?? 0}
            />
          </div>
        );
      })}
      {canEdit ? (
        <button
          type="button"
          onClick={() => onDeleteItem?.(item.id)}
          className="flex items-center justify-center text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
          title="Delete item"
        >
          <Trash2 size={13} />
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}
