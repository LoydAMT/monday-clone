'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { CellValue, Column, ColumnOptions, Group, Item, MemberProfile } from '@/types/database';
import { ItemRow } from './ItemRow';
import { GroupSummaryRow } from './GroupSummaryRow';

export function GroupSection({
  group,
  columns,
  items,
  orderingLocked = false,
  members = [],
  onCellChange,
  onOptionsChange,
  onTitleChange,
  onRenameGroup,
  onAddItem,
  onOpenItem,
}: {
  group: Group;
  columns: Column[];
  items: Item[];
  orderingLocked?: boolean;
  members?: MemberProfile[];
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOptionsChange?: (columnId: string, options: ColumnOptions) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onAddItem: (groupId: string) => void;
  onOpenItem?: (itemId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [name, setName] = useState(group.name);
  const { setNodeRef } = useDroppable({ id: group.id });

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 py-2">
        <button onClick={() => setCollapsed((c) => !c)} className="text-gray-400 hover:text-gray-600">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== group.name && onRenameGroup(group.id, name.trim())}
          className="rounded px-1 -mx-1 text-sm font-semibold outline-none hover:bg-gray-50 focus:bg-gray-50"
          style={{ color: group.color }}
        />
        <span className="text-xs text-gray-400">({items.length})</span>
      </div>

      {!collapsed && (
        <div className="overflow-hidden rounded-md border border-gray-200">
          <div ref={setNodeRef}>
            <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  columns={columns}
                  orderingLocked={orderingLocked}
                  members={members}
                  onCellChange={onCellChange}
                  onOptionsChange={onOptionsChange}
                  onTitleChange={onTitleChange}
                  onOpenItem={onOpenItem}
                />
              ))}
            </SortableContext>
          </div>

          <button
            onClick={() => onAddItem(group.id)}
            className="flex w-full items-center gap-1.5 border-t border-gray-100 px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          >
            <Plus size={13} /> Add item
          </button>

          <GroupSummaryRow columns={columns} items={items} />
        </div>
      )}
    </div>
  );
}
