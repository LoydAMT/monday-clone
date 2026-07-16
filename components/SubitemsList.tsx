'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CellValue, Column, Item } from '@/types/database';
import { getCellValue } from '@/lib/cell-helpers';
import { getSubitems } from '@/lib/item-thread';
import { createNewItem, logActivity, restoreItem, softDeleteItem, updateItemTitle, upsertCellData } from '@/lib/mutations';
import { StatusCell } from './cells/StatusCell';
import { TextCell } from './cells/TextCell';

export function SubitemsList({
  parentItemId,
  groupId,
  statusColumn,
  onUndoableAction,
  canEdit = true,
}: {
  parentItemId: string;
  groupId: string;
  statusColumn?: Column;
  onUndoableAction?: (message: string, onUndo: () => void) => void;
  canEdit?: boolean;
}) {
  const [subitems, setSubitems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    getSubitems(parentItemId).then((data) => {
      if (!cancelled) {
        setSubitems(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [parentItemId]);

  function handleTitleChange(itemId: string, title: string) {
    if (!canEdit) return;
    setSubitems((prev) => prev.map((s) => (s.id === itemId ? { ...s, title } : s)));
    updateItemTitle(itemId, title);
  }

  function handleStatusChange(itemId: string, value: string) {
    if (!canEdit) return;
    const target = subitems.find((s) => s.id === itemId);
    if (!target || !statusColumn) return;
    const cells = { ...target.cells, [statusColumn.id]: { type: 'status' as const, value } };
    setSubitems((prev) => prev.map((s) => (s.id === itemId ? { ...s, cells } : s)));
    upsertCellData(itemId, cells);
  }

  function handleAdd() {
    if (!canEdit) return;
    const title = draft.trim() || 'New subitem';
    setDraft('');
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempItem: Item = {
      id: tempId,
      group_id: groupId,
      parent_item_id: parentItemId,
      title,
      cells: {},
      position: subitems.length,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setSubitems((prev) => [...prev, tempItem]);

    createNewItem(groupId, subitems.length, title, parentItemId).then((created) =>
      setSubitems((prev) => prev.map((s) => (s.id === tempId ? created : s)))
    );
  }

  function handleDelete(itemId: string) {
    if (!canEdit) return;
    const target = subitems.find((s) => s.id === itemId);
    if (!target) return;

    setSubitems((prev) => prev.filter((s) => s.id !== itemId));
    softDeleteItem(itemId).then(() => {
      logActivity(parentItemId, 'subitem_removed', { subitem_id: itemId, title: target.title });
    });

    onUndoableAction?.(`"${target.title || 'Subitem'}" moved to trash`, () => {
      setSubitems((prev) => (prev.some((s) => s.id === itemId) ? prev : [...prev, target]));
      restoreItem(itemId).catch(() => {});
    });
  }

  if (loading) return <p className="text-xs text-gray-400">Loading subitems…</p>;

  return (
    <div className="space-y-1">
      {subitems.map((sub) => (
        <div key={sub.id} className="group flex items-center gap-2 rounded border border-gray-100 px-2 py-1">
          <div className={`min-w-0 flex-1 text-xs text-gray-800 ${!canEdit ? 'pointer-events-none' : ''}`}>
            <TextCell value={sub.title} onChange={(title) => handleTitleChange(sub.id, title)} />
          </div>
          {statusColumn && (
            <div className={`h-6 w-28 shrink-0 ${!canEdit ? 'pointer-events-none opacity-60' : ''}`}>
              <StatusCell
                column={statusColumn}
                value={getCellValueOf(statusColumn, sub)}
                onChange={(value) => handleStatusChange(sub.id, value)}
              />
            </div>
          )}
          {canEdit && (
            <button
              onClick={() => handleDelete(sub.id)}
              className="shrink-0 text-gray-300 opacity-100 md:opacity-0 md:hover:text-red-500 md:group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add subitem"
            className="flex-1 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#0073ea]"
          />
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-500 hover:bg-gray-200"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      )}
    </div>
  );
}

function getCellValueOf(column: Column, item: Item): string {
  const cell = getCellValue(column, item) as CellValue;
  return cell.type === 'status' ? cell.value : '';
}
