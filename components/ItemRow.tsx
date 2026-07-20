'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Maximize2, Trash2 } from 'lucide-react';
import type { CellValue, Column, ColumnOptions, Item, LinkedItemSummary, MemberProfile } from '@/types/database';
import { Cell } from './cells/Cell';
import { getCellValue } from '@/lib/cell-helpers';
import { handleTrackWidth, rowGridTemplate, totalGridWidth } from '@/lib/grid';
import { TextCell } from './cells/TextCell';
import { ConfirmDialog } from './ui/ConfirmDialog';

export function ItemRow({
  item,
  columns,
  compact = false,
  itemWidth,
  narrowed = false,
  orderingLocked = false,
  members = [],
  attachmentCounts = {},
  linkedRecordsByCell = {},
  onCellChange,
  onOptionsChange,
  onTitleChange,
  onOpenItem,
  onDeleteItem,
  onAddLinkedRecord,
  onRemoveLinkedRecord,
  canEdit = true,
}: {
  item: Item;
  columns: Column[];
  compact?: boolean;
  itemWidth?: number;
  narrowed?: boolean;
  orderingLocked?: boolean;
  members?: MemberProfile[];
  attachmentCounts?: Record<string, number>;
  linkedRecordsByCell?: Record<string, LinkedItemSummary[]>;
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOptionsChange?: (columnId: string, options: ColumnOptions) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onOpenItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onAddLinkedRecord?: (columnId: string, itemId: string, targetItemId: string, targetTitle: string) => void;
  onRemoveLinkedRecord?: (columnId: string, itemId: string, linkId: string) => void;
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

  // Once the Item column locked down to its narrow mobile width, the
  // move handle and open-item arrow eat most of that width themselves,
  // leaving barely any of it for the title — drop both so the title gets
  // the full narrow column instead of a sliver of it. A desktop drag-resize
  // of the Item column also sets `itemWidth` but should never hide these
  // buttons, which is why `narrowed` arrives as its own prop instead of
  // being inferred from itemWidth being defined.
  const statusColumn = columns.find((c) => c.type === 'status');
  const statusValue = statusColumn ? getCellValue(statusColumn, item) : null;
  const isItemDone = statusValue?.type === 'status' && statusValue.value === 'Done';

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        gridTemplateColumns: rowGridTemplate(columns, compact, itemWidth, narrowed),
        width: totalGridWidth(columns, compact, itemWidth, narrowed),
      }}
      className="group grid border-t border-gray-100 bg-white hover:bg-blue-50/30"
    >
      {orderingLocked || !canEdit || narrowed ? (
        <div className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/30" />
      ) : (
        <button
          {...attributes}
          {...listeners}
          className="sticky left-0 z-10 flex cursor-grab items-center justify-center bg-white text-gray-300 opacity-100 group-hover:bg-blue-50/30 active:cursor-grabbing md:opacity-0 md:hover:text-gray-500 md:group-hover:opacity-100"
        >
          <GripVertical size={14} />
        </button>
      )}

      <div
        className="sticky z-10 flex items-center gap-1 border-r border-gray-100 bg-white px-1 text-sm text-gray-800 group-hover:bg-blue-50/30"
        style={{ left: handleTrackWidth(narrowed) }}
      >
        {!narrowed && (
          <button
            type="button"
            onClick={() => onOpenItem?.(item.id)}
            className="shrink-0 text-gray-300 opacity-100 md:opacity-0 md:hover:text-gray-500 md:group-hover:opacity-100"
            title="Open item"
          >
            <Maximize2 size={12} />
          </button>
        )}
        <div className={`min-w-0 flex-1 ${!canEdit ? 'pointer-events-none' : ''}`}>
          <TextCell value={item.title} onChange={(title) => onTitleChange(item.id, title)} compact={compact} />
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
              isDone={isItemDone}
              linkedRecords={linkedRecordsByCell[`${column.id}:${item.id}`] ?? []}
              onAddLinkedRecord={(targetItemId, targetTitle) =>
                onAddLinkedRecord?.(column.id, item.id, targetItemId, targetTitle)
              }
              onRemoveLinkedRecord={(linkId) => onRemoveLinkedRecord?.(column.id, item.id, linkId)}
            />
          </div>
        );
      })}
      {canEdit ? (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="flex items-center justify-center text-gray-300 opacity-100 md:opacity-0 md:hover:text-red-500 md:group-hover:opacity-100"
          title="Delete item"
        >
          <Trash2 size={13} />
        </button>
      ) : (
        <div />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete item?"
          message={`"${item.title || 'This item'}" will be moved to trash. You can restore it from there.`}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDeleteItem?.(item.id);
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
