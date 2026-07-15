'use client';

import { useRef, useState } from 'react';

export function ProgressCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const pct = dragValue ?? value ?? 0;

  function pctFromClientX(clientX: number): number {
    const el = trackRef.current;
    if (!el) return pct;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragValue(pctFromClientX(e.clientX));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    setDragValue(pctFromClientX(e.clientX));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const final = pctFromClientX(e.clientX);
    setDragValue(null);
    onChange(final);
  }

  const barColor = pct >= 100 ? '#00c875' : pct >= 50 ? '#fdab3d' : '#579bfc';

  return (
    <div className="flex h-full w-full items-center gap-2 px-2">
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative h-3.5 flex-1 cursor-pointer rounded-full bg-gray-100"
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[10px] font-medium text-gray-500">{pct}%</span>
    </div>
  );
}
