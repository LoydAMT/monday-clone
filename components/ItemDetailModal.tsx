'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CellValue, Column, ColumnOptions, Group, Item, MemberProfile } from '@/types/database';
import { Modal } from './ui/Modal';
import { Cell } from './cells/Cell';
import { getCellValue } from '@/lib/cell-helpers';
import { SubitemsList } from './SubitemsList';
import { ItemThread } from './ItemThread';
import { AttachmentsList } from './AttachmentsList';

export function ItemDetailModal({
  item,
  columns,
  groups,
  members = [],
  workspaceId,
  boardId,
  currentUserId,
  onClose,
  onCellChange,
  onOptionsChange,
  onTitleChange,
  onDeleteItem,
  onUndoableAction,
  attachmentCount = 0,
  onAttachmentCountChange,
  canEdit = true,
}: {
  item: Item;
  columns: Column[];
  groups: Group[];
  members?: MemberProfile[];
  workspaceId: string;
  boardId: string;
  currentUserId: string;
  onClose: () => void;
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOptionsChange: (columnId: string, options: ColumnOptions) => void;
  onTitleChange: (itemId: string, title: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUndoableAction?: (message: string, onUndo: () => void) => void;
  attachmentCount?: number;
  onAttachmentCountChange?: (itemId: string, delta: number) => void;
  canEdit?: boolean;
}) {
  const [title, setTitle] = useState(item.title);
  const statusColumn = columns.find((c) => c.type === 'status');

  const assignedUserIds = columns
    .filter((c) => c.type === 'people')
    .flatMap((c) => {
      const cell = getCellValue(c, item);
      return cell.type === 'people' ? cell.value : [];
    })
    .filter((id, i, arr) => arr.indexOf(id) === i && id !== currentUserId);

  return (
    <Modal onClose={onClose} widthClassName="max-w-xl">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && onTitleChange(item.id, title.trim())}
          readOnly={!canEdit}
          className="mb-4 w-full rounded px-1 -mx-1 text-lg font-semibold text-gray-900 outline-none hover:bg-gray-50 focus:bg-gray-50"
        />

        <div className="mb-5 space-y-1">
          {columns.map((column) => {
            const readOnlyCell = !canEdit && column.type !== 'file';
            return (
              <div key={column.id} className="flex items-center gap-3 rounded px-1 py-1 hover:bg-gray-50">
                <span className="w-24 shrink-0 text-xs font-medium text-gray-500">{column.name}</span>
                <div className={`h-8 flex-1 ${readOnlyCell ? 'pointer-events-none opacity-60' : ''}`}>
                  <Cell
                    column={column}
                    cellValue={getCellValue(column, item)}
                    onChange={(value) => onCellChange(item.id, column.id, value)}
                    onOptionsChange={(options) => onOptionsChange(column.id, options)}
                    members={members}
                    attachmentCount={attachmentCount}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Subitems</h3>
          <SubitemsList
            parentItemId={item.id}
            groupId={item.group_id}
            statusColumn={statusColumn}
            onUndoableAction={onUndoableAction}
            canEdit={canEdit}
          />
        </div>

        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Files</h3>
          <AttachmentsList
            itemId={item.id}
            workspaceId={workspaceId}
            onCountChange={(delta) => onAttachmentCountChange?.(item.id, delta)}
          />
        </div>

        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Updates</h3>
          <ItemThread
            itemId={item.id}
            groups={groups}
            notifyUserIds={assignedUserIds}
            workspaceId={workspaceId}
            boardId={boardId}
            onUndoableAction={onUndoableAction}
          />
        </div>

        {canEdit && (
          <div className="border-t border-gray-100 pt-3">
            <button
              onClick={() => onDeleteItem(item.id)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600"
            >
              <Trash2 size={13} /> Delete item
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
