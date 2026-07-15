'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import type { Group, Item } from '@/types/database';
import { Modal } from './ui/Modal';
import { getTrashedItems } from '@/lib/trash';
import { permanentlyDeleteItem, restoreItem } from '@/lib/mutations';

export function TrashPanel({
  groups,
  onClose,
  onRestore,
  canEdit = true,
}: {
  groups: Group[];
  onClose: () => void;
  onRestore: (item: Item) => void;
  canEdit?: boolean;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTrashedItems(groups.map((g) => g.id)).then((data) => {
      if (!cancelled) {
        setItems(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [groups]);

  function handleRestore(item: Item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    restoreItem(item.id)
      .then(onRestore)
      .catch(() => setItems((prev) => [item, ...prev]));
  }

  function handleDeleteForever(itemId: string) {
    if (confirmingId !== itemId) {
      setConfirmingId(itemId);
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    permanentlyDeleteItem(itemId);
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-lg">
      <div className="max-h-[75vh] overflow-y-auto p-5">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Trash</h2>

        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-gray-400">Nothing in the trash.</p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded border border-gray-100 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-gray-800">{item.title || 'Untitled item'}</p>
                  <p className="text-[10px] text-gray-400">
                    Deleted {item.deleted_at ? new Date(item.deleted_at).toLocaleString() : ''}
                  </p>
                </div>
                {canEdit && (
                  <>
                    <button
                      onClick={() => handleRestore(item)}
                      className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                    <button
                      onClick={() => handleDeleteForever(item.id)}
                      className={`flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs ${
                        confirmingId === item.id ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-red-500'
                      }`}
                    >
                      <Trash2 size={12} /> {confirmingId === item.id ? 'Confirm?' : 'Delete forever'}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
