'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageOff, Trash2, Upload } from 'lucide-react';
import type { InventoryPhoto } from '@/types/database';
import {
  deleteInventoryPhoto,
  getInventoryPhotoUrl,
  getInventoryPhotos,
  uploadInventoryPhoto,
} from '@/lib/inventory-photos';

export function InventoryPhotosPanel({
  itemId,
  workspaceId,
  onCoverPhotoChange,
}: {
  itemId: string;
  workspaceId: string;
  onCoverPhotoChange?: (itemId: string, url: string | null) => void;
}) {
  const [photos, setPhotos] = useState<InventoryPhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getInventoryPhotos(itemId).then((data) => {
      if (!cancelled) {
        setPhotos(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  // Fetch each photo's signed URL lazily as photos load in, rather than
  // blocking the whole grid on every URL resolving together.
  useEffect(() => {
    for (const photo of photos) {
      if (urls[photo.id]) continue;
      getInventoryPhotoUrl(photo.storage_path).then((url) => {
        setUrls((prev) => (prev[photo.id] ? prev : { ...prev, [photo.id]: url }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  // The cover photo shown in the list view is whichever photo was added
  // first — recomputed any time the local photo set changes.
  useEffect(() => {
    if (!onCoverPhotoChange) return;
    if (photos.length === 0) {
      onCoverPhotoChange(itemId, null);
      return;
    }
    const cover = photos.reduce((oldest, p) => (p.created_at < oldest.created_at ? p : oldest), photos[0]);
    const cachedUrl = urls[cover.id];
    if (cachedUrl) {
      onCoverPhotoChange(itemId, cachedUrl);
    } else {
      getInventoryPhotoUrl(cover.storage_path).then((url) => onCoverPhotoChange(itemId, url));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, urls, itemId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const photo = await uploadInventoryPhoto(workspaceId, itemId, file);
        setPhotos((prev) => [photo, ...prev]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleDelete(photo: InventoryPhoto) {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    deleteInventoryPhoto(photo);
  }

  if (loading) return <p className="text-xs text-gray-400">Loading photos…</p>;

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded border border-gray-200 bg-gray-50">
              {urls[photo.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls[photo.id]} alt={photo.file_name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full animate-pulse bg-gray-100" />
              )}
              <button
                onClick={() => handleDelete(photo)}
                title="Delete photo"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 hover:bg-black/70 group-hover:opacity-100"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <ImageOff size={14} />
          No photos yet
        </div>
      )}

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
        {uploading ? 'Uploading…' : 'Click or drop photos to upload (max 10MB)'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
