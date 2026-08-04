'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: { url: string; alt: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const hasMultiple = images.length > 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (hasMultiple && e.key === 'ArrowLeft') onNavigate((index - 1 + images.length) % images.length);
      if (hasMultiple && e.key === 'ArrowRight') onNavigate((index + 1) % images.length);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, onNavigate, index, images.length, hasMultiple]);

  const current = images[index];
  if (!current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <button onClick={onClose} title="Close" className="absolute right-4 top-4 text-white/70 hover:text-white">
        <X size={24} />
      </button>

      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index - 1 + images.length) % images.length);
          }}
          title="Previous photo"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white sm:left-4"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] object-contain"
      />

      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((index + 1) % images.length);
          }}
          title="Next photo"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white sm:right-4"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
          {index + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body
  );
}
