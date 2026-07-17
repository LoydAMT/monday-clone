'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

// Portals cell popups (Status/Dropdown/People/Timeline/Link pickers) to
// document.body instead of positioning them `absolute` inside the cell.
// The table's own scroll region is a bounded, `overflow-auto` box (needed
// for the sticky column header) — an `absolute` popup is still a descendant
// of that box for clipping purposes even though it's positioned outside the
// anchor's normal flow, so any popup opening near the bottom (or right) edge
// of the currently-scrolled table would get visually clipped, sometimes
// hiding its interactive contents entirely. Positioning via the anchor's
// real viewport coordinates and a portal sidesteps that.
export function FloatingPanel({
  anchorRef,
  open,
  onClose,
  className = '',
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    // The anchor moves (or scrolls out of view entirely) the moment any
    // scrollable ancestor scrolls — closing on scroll/resize avoids a
    // fixed-position popup drifting away from the cell it belongs to,
    // rather than trying to keep re-measuring and following it.
    function handleReposition() {
      onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [open, anchorRef, onClose]);

  if (!open || !position) return null;

  return createPortal(
    <div ref={panelRef} style={{ position: 'fixed', top: position.top, left: position.left }} className={className}>
      {children}
    </div>,
    document.body
  );
}
