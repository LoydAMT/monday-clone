'use client';

export interface ToastState {
  message: string;
  onUndo?: () => void;
}

export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  if (!toast) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-md bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
      <span>{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={() => {
            toast.onUndo?.();
            onDismiss();
          }}
          className="font-medium text-[#66ccff] hover:text-white"
        >
          Undo
        </button>
      )}
    </div>
  );
}
