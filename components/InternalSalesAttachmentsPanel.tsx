'use client';

import { useEffect, useRef, useState } from 'react';
import { File, Trash2, Upload } from 'lucide-react';
import type { SalesAttachment } from '@/types/database';
import {
  MAX_SALES_FILE_SIZE_BYTES,
  deleteSalesAttachment,
  getSalesAttachments,
  getSalesAttachmentUrl,
  uploadSalesAttachment,
} from '@/lib/internal-sales-attachments';
import { formatFileSize } from '@/lib/attachments';
import { formatDateTime } from '@/lib/sales-stages';

/**
 * Files on a customer, one of its deals, or one quotation of a deal.
 * - `quotationId`: that quotation's files (e.g. the customer's PO).
 * - `dealId`: the deal's own files; quotation files live on their quotation.
 * - neither: everything on the company, tagging files that belong to a deal
 *   or quotation, and uploading company-level files.
 */
export function InternalSalesAttachmentsPanel({
  workspaceId,
  companyId,
  dealId,
  quotationId = null,
  canEdit,
  dealTitleById,
  compact = false,
  onCountChange,
}: {
  workspaceId: string;
  companyId: string;
  dealId: string | null;
  quotationId?: string | null;
  canEdit: boolean;
  /** Company-level view only: resolves a file's deal_id to a title for its tag. */
  dealTitleById?: Map<string, string>;
  /** Drops the heading, for use nested inside another row. */
  compact?: boolean;
  /** Reports +1 / -1 as files are added or removed, so a parent can keep a badge in step. */
  onCountChange?: (delta: number) => void;
}) {
  const scopeKey = `${companyId}:${dealId ?? ''}:${quotationId ?? ''}`;
  // Which scope `files` was fetched for. Deriving "loading" from this, rather
  // than flipping a flag inside the effect, keeps the effect free of
  // synchronous setState (same approach as InternalSalesDealModal's detail load).
  const [loaded, setLoaded] = useState<{ key: string; files: SalesAttachment[]; failed: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSalesAttachments({ companyId, dealId, quotationId })
      .then((files) => {
        if (!cancelled) setLoaded({ key: scopeKey, files, failed: null });
      })
      .catch((e) => {
        // Supabase errors are plain objects with a message, not Error instances.
        const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Unknown error';
        if (!cancelled) setLoaded({ key: scopeKey, files: [], failed: message });
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, dealId, quotationId, scopeKey]);

  const loading = loaded?.key !== scopeKey;
  const files = loaded?.key === scopeKey ? loaded.files : [];

  function patchFiles(update: (prev: SalesAttachment[]) => SalesAttachment[]) {
    setLoaded((prev) => (prev && prev.key === scopeKey ? { ...prev, files: update(prev.files) } : prev));
  }

  async function handleFiles(list: FileList | null) {
    if (!canEdit || !list || list.length === 0) return;
    setError(null);
    setUploading(true);
    // One bad file (too big, rejected) shouldn't abandon the rest of the batch.
    const failures: string[] = [];
    for (const file of Array.from(list)) {
      try {
        const created = await uploadSalesAttachment(workspaceId, { companyId, dealId, quotationId }, file);
        patchFiles((prev) => [created, ...prev]);
        onCountChange?.(1);
      } catch (e) {
        failures.push(e instanceof Error ? e.message : `Failed to upload "${file.name}"`);
      }
    }
    if (failures.length > 0) setError(failures.join(' '));
    setUploading(false);
    // Let the same file be picked again after a failure.
    if (inputRef.current) inputRef.current.value = '';
  }

  async function handleOpen(file: SalesAttachment) {
    setError(null);
    // Open the tab inside the click handler — a window opened after an await
    // is treated as a popup and blocked. Cut the opener link before pointing
    // it at the signed URL so that page can't reach back into this one.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    try {
      const url = await getSalesAttachmentUrl(file.storage_path);
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : 'Could not open the file');
    }
  }

  async function handleDelete(file: SalesAttachment) {
    const previous = files;
    setError(null);
    patchFiles((prev) => prev.filter((f) => f.id !== file.id));
    onCountChange?.(-1);
    try {
      await deleteSalesAttachment(file);
    } catch (e) {
      patchFiles(() => previous);
      onCountChange?.(1);
      setError(e instanceof Error ? e.message : 'Failed to delete the file');
    }
  }

  return (
    <div>
      {!compact && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Files {files.length > 0 && `(${files.length})`}
          </h3>
        </div>
      )}

      {loading && <p className="py-2 text-xs text-gray-400">Loading files…</p>}
      {loaded?.key === scopeKey && loaded.failed && (
        <p className="py-2 text-xs text-red-500">Couldn’t load files: {loaded.failed}</p>
      )}

      {!loading && !loaded?.failed && files.length === 0 && !canEdit && (
        <p className="py-4 text-center text-xs text-gray-400">No files attached.</p>
      )}

      <div className="space-y-1.5">
        {files.map((file) => {
          const dealTitle = file.deal_id ? dealTitleById?.get(file.deal_id) : undefined;
          // Only the company-wide list mixes scopes, so only it needs the tag.
          const quoteLabel =
            !dealId && file.quotation
              ? `Quotation ${file.quotation.quote_number}${file.quotation.revision > 0 ? ` rev. ${file.quotation.revision}` : ''}`
              : undefined;
          return (
            <div key={file.id} className="group flex items-center gap-2 rounded border border-gray-100 px-2 py-1.5">
              <File size={14} className="shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => handleOpen(file)}
                  title={file.file_name}
                  className="block max-w-full truncate text-left text-xs font-medium text-[#0073ea] hover:underline"
                >
                  {file.file_name}
                </button>
                <p className="truncate text-[10px] text-gray-400">
                  {formatFileSize(file.file_size)} · {formatDateTime(file.created_at)}
                  {dealTitle && ` · ${dealTitle}`}
                  {quoteLabel && ` · ${quoteLabel}`}
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleDelete(file)}
                  title="Delete file"
                  className="shrink-0 text-gray-300 opacity-100 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`mt-2 flex cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed px-3 py-3 text-xs ${
            dragOver ? 'border-[#0073ea] bg-blue-50 text-[#0073ea]' : 'border-gray-200 text-gray-400 hover:border-gray-300'
          }`}
        >
          <Upload size={13} />
          {uploading
            ? 'Uploading…'
            : `Click or drop files to attach (max ${MAX_SALES_FILE_SIZE_BYTES / 1024 / 1024}MB each)`}
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
