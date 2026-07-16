'use client';

import { Modal } from './Modal';

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal onClose={onCancel} widthClassName="max-w-sm">
      <div className="p-5">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="mt-1.5 text-sm text-gray-500">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-[#e2445c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#cc3a4e]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
