'use client';

import { Paperclip } from 'lucide-react';

export function FileCell({ count = 0, onOpenItem }: { count?: number; onOpenItem?: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenItem}
      disabled={!onOpenItem}
      className="relative flex h-full w-full items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 disabled:cursor-default disabled:hover:bg-transparent"
      title={count > 0 ? `${count} file${count === 1 ? '' : 's'}` : 'Files'}
    >
      <Paperclip size={14} className={count > 0 ? 'text-[#0073ea]' : undefined} />
      {count > 0 && (
        <span className="absolute right-2 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#0073ea] px-0.5 text-[9px] font-semibold leading-none text-white">
          {count}
        </span>
      )}
    </button>
  );
}
