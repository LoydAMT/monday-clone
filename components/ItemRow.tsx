'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { CellValue, Column, Item } from '@/types/database';
import { Cell } from './cells/Cell';
import { getCellValue } from '@/lib/cell-helpers';
import { rowGridTemplate } from '@/lib/grid';
import { TextCell } from './cells/TextCell';

export function ItemRow({
  item,
  columns,
  onCellChange,
  onTitleChange,
}: {
  item: Item;
  columns: Column[];
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onTitleChange: (itemId: string, title: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, gridTemplateColumns: rowGridTemplate(columns.length) }}
      className="group grid border-t border-gray-100 bg-white hover:bg-blue-50/30"
    >
      <button
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center justify-center text-gray-300 opacity-0 hover:text-gray-500 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>

      <div className="flex items-center border-r border-gray-100 px-1 text-sm text-gray-800">
        <TextCell value={item.title} onChange={(title) => onTitleChange(item.id, title)} />
      </div>

      {columns.map((column) => (
        <div key={column.id} className="flex items-center border-r border-gray-100">
          <Cell
            column={column}
            cellValue={getCellValue(column, item)}
            onChange={(value) => onCellChange(item.id, column.id, value)}
          />
        </div>
      ))}
    </div>
  );
}
