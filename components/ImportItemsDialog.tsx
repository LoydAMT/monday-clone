'use client';

import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import { parseExcelFirstColumn } from '@/lib/import';

const PREVIEW_LIMIT = 8;

export function ImportItemsDialog({
  file,
  onImport,
  onClose,
}: {
  file: File;
  onImport: (groupName: string, titles: string[]) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [rows, setRows] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    parseExcelFirstColumn(file)
      .then((values) => {
        if (cancelled) return;
        setRows(values);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // The first row names the group (table) the rest of the column is
  // imported into — everything after it becomes one item per row.
  const groupName = rows[0];
  const titles = rows.slice(1);

  function handleImport() {
    setImporting(true);
    onImport(groupName, titles);
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-sm">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">Import table</h2>

        {status === 'loading' && <p className="mt-3 text-sm text-gray-500">Reading {file.name}…</p>}

        {status === 'error' && (
          <>
            <p className="mt-3 text-sm text-gray-500">
              Couldn&apos;t read &quot;{file.name}&quot; — make sure it&apos;s a .xlsx file with values in the first
              column.
            </p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                Close
              </button>
            </div>
          </>
        )}

        {status === 'ready' && (
          <>
            {!groupName ? (
              <p className="mt-3 text-sm text-gray-500">No values found in the first column of &quot;{file.name}&quot;.</p>
            ) : (
              <>
                <p className="mt-3 text-xs text-gray-500">
                  Group will be renamed to <span className="font-medium text-gray-800">&quot;{groupName}&quot;</span>
                </p>

                <p className="mt-3 text-xs font-medium text-gray-500">
                  {titles.length} item{titles.length === 1 ? '' : 's'} will be added:
                </p>
                {titles.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-400">No item rows below the table name.</p>
                ) : (
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                    {titles.slice(0, PREVIEW_LIMIT).map((title, i) => (
                      <li key={i} className="truncate">
                        {title}
                      </li>
                    ))}
                    {titles.length > PREVIEW_LIMIT && (
                      <li className="text-gray-400">and {titles.length - PREVIEW_LIMIT} more…</li>
                    )}
                  </ul>
                )}
              </>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                disabled={importing}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              {groupName && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
                >
                  {importing ? 'Importing…' : 'Import'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
