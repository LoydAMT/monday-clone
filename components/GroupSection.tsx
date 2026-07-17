'use client';

import { useEffect, useRef, useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronRight, GripVertical, Plus, Upload } from 'lucide-react';
import type { CellValue, Column, ColumnOptions, Group, Item, MemberProfile } from '@/types/database';
import { ItemRow } from './ItemRow';
import { GroupSummaryRow } from './GroupSummaryRow';
import { ImportItemsDialog } from './ImportItemsDialog';

export function GroupSection({
  group,
  columns,
  compact = false,
  itemWidth,
  narrowed = false,
  items,
  orderingLocked = false,
  members = [],
  attachmentCounts = {},
  onCellChange,
  onOptionsChange,
  onTitleChange,
  onRenameGroup,
  onAddItem,
  onImportItems,
  onOpenItem,
  onDeleteItem,
  canEdit = true,
}: {
  group: Group;
  columns: Column[];
  compact?: boolean;
  itemWidth?: number;
  narrowed?: boolean;
  items: Item[];
  orderingLocked?: boolean;
  members?: MemberProfile[];
  attachmentCounts?: Record<string, number>;
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOptionsChange?: (columnId: string, options: ColumnOptions) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onAddItem: (groupId: string) => void;
  onImportItems?: (groupId: string, groupName: string, titles: string[]) => void;
  onOpenItem?: (itemId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  canEdit?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [name, setName] = useState(group.name);
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // group.name only ever changes here via this component's own onBlur (in
  // which case `name` already matches it) — except an import can now rename
  // the group from outside, so this syncs that external change in too.
  useEffect(() => setName(group.name), [group.name]);
  // The whole group section is one combined draggable+droppable region: the
  // handle below reorders it among sibling groups, and the same node stays
  // the drop target items resolve to when dragged into this group (matching
  // the old dedicated useDroppable, but now covering the header too so you
  // can drop onto a collapsed group instead of only its (hidden) item list).
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id, data: { type: 'group' }, disabled: orderingLocked || !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-5">
      <div className="sticky left-0 z-10 flex w-fit items-center gap-2 bg-white py-2">
        {orderingLocked || !canEdit ? (
          <span className="w-3.5" />
        ) : (
          <button
            {...attributes}
            {...listeners}
            title="Drag to reorder group"
            className="cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </button>
        )}
        <button onClick={() => setCollapsed((c) => !c)} className="text-gray-400 hover:text-gray-600">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== group.name && onRenameGroup(group.id, name.trim())}
          readOnly={!canEdit}
          className="rounded px-1 -mx-1 text-sm font-semibold outline-none max-sm:text-xs hover:bg-gray-50 focus:bg-gray-50"
          style={{ color: group.color }}
        />
        <span className="text-xs text-gray-400 max-sm:text-[10px]">({items.length})</span>
      </div>

      {!collapsed && (
        <div className="rounded-md border border-gray-200">
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                columns={columns}
                compact={compact}
                itemWidth={itemWidth}
                narrowed={narrowed}
                orderingLocked={orderingLocked}
                members={members}
                attachmentCounts={attachmentCounts}
                onCellChange={onCellChange}
                onOptionsChange={onOptionsChange}
                onTitleChange={onTitleChange}
                onOpenItem={onOpenItem}
                onDeleteItem={onDeleteItem}
                canEdit={canEdit}
              />
            ))}
          </SortableContext>

          {canEdit && (
            <div className="flex items-stretch border-t border-gray-100">
              <button
                onClick={() => onAddItem(group.id)}
                className="flex flex-1 items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              >
                <Plus size={13} /> Add item
              </button>
              {onImportItems && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Import items from an Excel file"
                    className="flex items-center gap-1.5 border-l border-gray-100 px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  >
                    <Upload size={13} /> Import
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setImportFile(file);
                      e.target.value = '';
                    }}
                  />
                </>
              )}
            </div>
          )}

          <GroupSummaryRow columns={columns} compact={compact} itemWidth={itemWidth} narrowed={narrowed} items={items} />
        </div>
      )}

      {importFile && (
        <ImportItemsDialog
          file={importFile}
          onClose={() => setImportFile(null)}
          onImport={(groupName, titles) => {
            onImportItems?.(group.id, groupName, titles);
            setImportFile(null);
          }}
        />
      )}
    </div>
  );
}
