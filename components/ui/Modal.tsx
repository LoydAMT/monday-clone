'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({
  onClose,
  children,
  widthClassName = 'max-w-2xl',
}: {
  onClose: () => void;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 pt-10 sm:p-6 sm:pt-16">
      <div
        role="presentation"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className={`relative w-full ${widthClassName} rounded-lg bg-white shadow-xl`}>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 text-gray-400 hover:text-gray-600"
          title="Close"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}
