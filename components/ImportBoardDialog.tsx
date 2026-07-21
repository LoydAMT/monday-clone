'use client';

import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import type { Column, Group, Item, MemberProfile } from '@/types/database';
import { parseBoardWorkbook, type BoardImportResult } from '@/lib/excel';
import { getAllSubitemsForBoard } from '@/lib/item-thread';

const PREVIEW_LIMIT = 8;

export function ImportBoardDialog({
  file,
  columns,
  groups,
  items,
  members,
  onConfirm,
  onClose,
}: {
  file: File;
  columns: Column[];
  groups: Group[];
  items: Item[];
  members: MemberProfile[];
  onConfirm: (result: BoardImportResult) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [result, setResult] = useState<BoardImportResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const groupIds = groups.map((g) => g.id);
        const subitems = await getAllSubitemsForBoard(groupIds);
        const parsed = await parseBoardWorkbook(file, columns, groups, items, subitems, members);
        if (cancelled) return;
        setResult(parsed);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-parse if the file itself changes — columns/groups/items/members
    // are a point-in-time snapshot for this one parse, not a live dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const warnings = result
    ? [...result.updates, ...result.creates].flatMap((r) => r.warnings.map((message) => ({ row: r.row, message })))
    : [];

  function handleConfirm() {
    if (!result) return;
    onConfirm(result);
    onClose();
  }

  const nothingToImport = result !== null && result.updates.length === 0 && result.creates.length === 0;

  return (
    <Modal onClose={onClose} widthClassName="max-w-md">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Import from Excel</h2>

        {status === 'loading' && <p className="mt-3 text-sm text-gray-500">Reading {file.name}…</p>}

        {status === 'error' && (
          <>
            <p className="mt-3 text-sm text-gray-500">
              Couldn&apos;t read &quot;{file.name}&quot; — make sure it&apos;s a .xlsx file exported from this board.
            </p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                Close
              </button>
            </div>
          </>
        )}

        {status === 'ready' && result && (
          <>
            <p className="mt-3 text-xs text-gray-500">
              {result.updates.length} item{result.updates.length === 1 ? '' : 's'} will update, {result.creates.length} new
              item{result.creates.length === 1 ? '' : 's'} will be created
              {result.rejected.length > 0 && `, ${result.rejected.length} row${result.rejected.length === 1 ? '' : 's'} skipped`}.
            </p>

            {result.rejected.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500">Skipped rows:</p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                  {result.rejected.slice(0, PREVIEW_LIMIT).map((r, i) => (
                    <li key={i}>
                      Row {r.row}: {r.reason}
                    </li>
                  ))}
                  {result.rejected.length > PREVIEW_LIMIT && (
                    <li className="text-red-400">and {result.rejected.length - PREVIEW_LIMIT} more…</li>
                  )}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500">
                  {warnings.length} cell warning{warnings.length === 1 ? '' : 's'} (row still imported, value skipped):
                </p>
                <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto rounded border border-amber-100 bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                  {warnings.slice(0, PREVIEW_LIMIT).map((w, i) => (
                    <li key={i}>
                      Row {w.row}: {w.message}
                    </li>
                  ))}
                  {warnings.length > PREVIEW_LIMIT && (
                    <li className="text-amber-400">and {warnings.length - PREVIEW_LIMIT} more…</li>
                  )}
                </ul>
              </div>
            )}

            {result.ignoredColumns.length > 0 && (
              <p className="mt-3 text-xs text-gray-400">
                {result.ignoredColumns.length} column{result.ignoredColumns.length === 1 ? '' : 's'} in the file no longer
                exist on this board and {result.ignoredColumns.length === 1 ? 'was' : 'were'} ignored.
              </p>
            )}

            {nothingToImport && result.rejected.length === 0 && (
              <p className="mt-3 text-xs text-gray-400">No rows found to import.</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
              {!nothingToImport && (
                <button
                  onClick={handleConfirm}
                  className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
                >
                  Import
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
