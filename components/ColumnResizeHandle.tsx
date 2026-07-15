'use client';

import { useRef } from 'react';
import { MIN_COLUMN_WIDTH } from '@/lib/grid';

export function ColumnResizeHandle({
  width,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
}: {
  width: number;
  onResizeStart: () => void;
  onResizeMove: (width: number) => void;
  onResizeEnd: (width: number) => void;
}) {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  function widthFromClientX(clientX: number): number {
    return Math.max(MIN_COLUMN_WIDTH, Math.round(startWidthRef.current + (clientX - startXRef.current)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    onResizeStart();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    onResizeMove(widthFromClientX(e.clientX));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onResizeEnd(widthFromClientX(e.clientX));
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title="Drag to resize column"
      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none hover:bg-[#0073ea]/40"
    />
  );
}
