'use client';

import { useEffect, useRef, useState } from 'react';
import { File, Trash2, Upload } from 'lucide-react';
import type { Attachment } from '@/types/database';
import { deleteAttachment, formatFileSize, getAttachments, getAttachmentUrl, uploadAttachment } from '@/lib/attachments';

export function AttachmentsList({
  itemId,
  workspaceId,
  onCountChange,
}: {
  itemId: string;
  workspaceId: string;
  onCountChange?: (delta: number) => void;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAttachments(itemId).then((data) => {
      if (!cancelled) {
        setAttachments(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await uploadAttachment(workspaceId, itemId, file);
        setAttachments((prev) => [attachment, ...prev]);
        onCountChange?.(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(attachment: Attachment) {
    setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    deleteAttachment(attachment);
    onCountChange?.(-1);
  }

  async function handleDownload(attachment: Attachment) {
    const url = await getAttachmentUrl(attachment.storage_path);
    window.open(url, '_blank');
  }

  if (loading) return <p className="text-xs text-gray-400">Loading files…</p>;

  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div key={a.id} className="group flex items-center gap-2 rounded border border-gray-100 px-2 py-1.5">
          <File size={14} className="shrink-0 text-gray-400" />
          <button
            onClick={() => handleDownload(a)}
            className="min-w-0 flex-1 truncate text-left text-xs text-[#0073ea] hover:underline"
          >
            {a.file_name}
          </button>
          <span className="shrink-0 text-[10px] text-gray-400">{formatFileSize(a.file_size)}</span>
          <button
            onClick={() => handleDelete(a)}
            className="shrink-0 text-gray-300 opacity-100 md:opacity-0 md:hover:text-red-500 md:group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}

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
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed px-3 py-3 text-xs ${
          dragOver ? 'border-[#0073ea] bg-blue-50 text-[#0073ea]' : 'border-gray-200 text-gray-400 hover:border-gray-300'
        }`}
      >
        <Upload size={13} />
        {uploading ? 'Uploading…' : 'Click or drop files to upload (max 10MB)'}
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
