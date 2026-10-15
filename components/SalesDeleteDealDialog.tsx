'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';

/**
 * Type-to-confirm deletion for a deal. Deleting a deal takes its quotations,
 * costs, site visits, files, tasks and logged communications with it, so a
 * single "Delete" click is too easy to hit by mistake: the button stays
 * disabled until the deal's title is typed out.
 */
export function SalesDeleteDealDialog({
  dealTitle,
  contents,
  onConfirm,
  onCancel,
}: {
  dealTitle: string;
  /** Human-readable lines of what goes with the deal, e.g. "2 quotations". Empty ones are omitted by the caller. */
  contents: string[];
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === dealTitle.trim().toLowerCase();

  async function handleConfirm() {
    if (!matches || deleting) return;
    setError(null);
    setDeleting(true);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete the deal');
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={deleting ? () => {} : onCancel} widthClassName="max-w-md">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#e2445c]">
            <AlertTriangle size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Are you sure you want to delete this deal?</h2>
            <p className="mt-1.5 text-sm text-gray-500">
              <span className="font-medium text-gray-700">{dealTitle}</span> will be permanently deleted. This can’t be
              undone.
            </p>
          </div>
        </div>

        {contents.length > 0 && (
          <div className="mt-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            <p className="font-medium">This will also delete:</p>
            <ul className="mt-1 list-disc pl-4">
              {contents.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="mt-4 block">
          <span className="mb-1 block text-xs text-gray-500">
            To confirm, type <span className="font-semibold text-gray-800">{dealTitle}</span> below
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            disabled={deleting}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#e2445c]"
          />
        </label>

        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!matches || deleting}
            className="rounded-md bg-[#e2445c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#cc3a4e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete deal'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
