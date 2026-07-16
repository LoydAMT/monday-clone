'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CellValue, Column, Group, Item, TimelineValue } from '@/types/database';
import { addDays, computeDateRange, daysBetween, formatDayLabel, formatDayNumber, isMonthStart, MAX_DAY_WIDTH, MIN_DAY_WIDTH, today } from '@/lib/gantt';
import { ColumnResizeHandle } from './ColumnResizeHandle';

const DEFAULT_LEFT_WIDTH = 220;
const ROW_HEIGHT = 36;

export function GanttView({
  columns,
  groups,
  items,
  onCellChange,
  onOpenItem,
}: {
  columns: Column[];
  groups: Group[];
  items: Item[];
  onCellChange: (itemId: string, columnId: string, value: CellValue) => void;
  onOpenItem: (itemId: string) => void;
}) {
  const timelineColumn = columns.find((c) => c.type === 'timeline');
  const statusColumn = columns.find((c) => c.type === 'status');
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);

  // Click-and-drag panning: mousedown anywhere in the chart (bars/buttons
  // stop propagation on their own mousedown, so this only fires for empty
  // chart background). Listens on window rather than the scroll container
  // so a drag that leaves the container mid-move (fast mouse) still tracks.
  const scrollRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startScrollLeft: number; moved: boolean } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // Tracks the scroll container's visible width so dayWidth (below) can
  // shrink to fit a long project's whole date range into view, rather than
  // most rows sitting outside whatever narrow slice happens to be scrolled
  // into frame.
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      const pan = panRef.current;
      const el = scrollRef.current;
      if (!pan || !el) return;
      const delta = e.clientX - pan.startX;
      if (!pan.moved && Math.abs(delta) > 4) {
        pan.moved = true;
        setIsPanning(true);
      }
      if (pan.moved) el.scrollLeft = pan.startScrollLeft - delta;
    }
    function handleMouseUp() {
      panRef.current = null;
      setIsPanning(false);
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  function handlePanStart(e: React.MouseEvent) {
    if (e.button !== 0) return;
    panRef.current = { startX: e.clientX, startScrollLeft: scrollRef.current?.scrollLeft ?? 0, moved: false };
  }

  const range = useMemo(
    () => (timelineColumn ? computeDateRange(items, timelineColumn.id) : { start: today(), end: today() }),
    [items, timelineColumn]
  );

  const totalDays = timelineColumn ? daysBetween(range.start, range.end) + 1 : 0;
  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(range.start, i)),
    [totalDays, range.start]
  );

  if (!timelineColumn) {
    return (
      <div className="px-6 py-10 text-center text-sm text-gray-400">
        Add a Timeline column to use the Gantt view.
      </div>
    );
  }

  // Fit the whole date range into the available width when it's shorter than
  // MAX_DAY_WIDTH per day would need, down to MIN_DAY_WIDTH before falling
  // back to horizontal scroll — before containerWidth's first measurement
  // (0) this evaluates to MIN_DAY_WIDTH rather than flashing MAX_DAY_WIDTH.
  const availableChartWidth = Math.max(0, containerWidth - leftWidth);
  const dayWidth = totalDays > 0
    ? Math.min(MAX_DAY_WIDTH, Math.max(MIN_DAY_WIDTH, availableChartWidth / totalDays))
    : MAX_DAY_WIDTH;

  const todayOffset = daysBetween(range.start, today()) * dayWidth;
  const chartWidth = leftWidth + totalDays * dayWidth;

  function statusColor(item: Item): string {
    if (!statusColumn) return '#0073ea';
    const cell = item.cells[statusColumn.id];
    const label = cell?.type === 'status' ? cell.value : '';
    return statusColumn.options.statuses?.find((s) => s.label === label)?.color ?? '#0073ea';
  }

  return (
    <div
      ref={scrollRef}
      data-export-root
      onMouseDown={handlePanStart}
      className={`overflow-x-auto px-6 py-4 select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div className="relative" style={{ width: chartWidth }}>
        <div
          className="pointer-events-none absolute bottom-0 top-0 z-0 w-px bg-red-300"
          style={{ left: leftWidth + todayOffset }}
        />

        <div className="sticky top-0 z-20 flex border-b border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-gray-200 bg-gray-50 px-2 py-2"
            style={{ width: leftWidth }}
          >
            <div className="relative h-full">
              Item
              <ColumnResizeHandle
                width={leftWidth}
                onResizeStart={() => {}}
                onResizeMove={setLeftWidth}
                onResizeEnd={setLeftWidth}
              />
            </div>
          </div>
          {days.map((d, i) => (
            <div key={d} className="shrink-0 border-l border-gray-100 py-2 text-center" style={{ width: dayWidth }}>
              {i === 0 || isMonthStart(d) ? formatDayLabel(d) : formatDayNumber(d)}
            </div>
          ))}
        </div>

        {groups.map((group) => {
          const groupItems = items
            .filter((i) => i.group_id === group.id)
            .filter((i) => i.cells[timelineColumn.id]?.type === 'timeline' && i.cells[timelineColumn.id]?.value)
            .sort((a, b) => a.position - b.position);

          if (groupItems.length === 0) return null;

          return (
            <div key={group.id}>
              <div
                className="sticky left-0 z-20 flex w-fit items-center gap-2 border-t border-gray-100 bg-white py-1.5 pl-2 text-xs font-semibold"
                style={{ color: group.color }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: group.color }} />
                {group.name}
              </div>

              {groupItems.map((item) => {
                const value = item.cells[timelineColumn.id]?.value as TimelineValue;
                return (
                  <div key={item.id} className="flex border-t border-gray-50" style={{ height: ROW_HEIGHT }}>
                    <button
                      onClick={() => onOpenItem(item.id)}
                      title={item.title}
                      className="sticky left-0 z-20 flex shrink-0 items-center truncate border-r border-gray-200 bg-white px-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                      style={{ width: leftWidth }}
                    >
                      <span className="truncate">{item.title}</span>
                    </button>
                    <div className="relative" style={{ width: totalDays * dayWidth }}>
                      <GanttBar
                        value={value}
                        rangeStart={range.start}
                        dayWidth={dayWidth}
                        color={statusColor(item)}
                        label={item.title}
                        onCommit={(start, end) =>
                          onCellChange(item.id, timelineColumn.id, { type: 'timeline', value: { start, end } })
                        }
                        onClick={() => onOpenItem(item.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type DragMode = 'move' | 'resize-start' | 'resize-end';

function GanttBar({
  value,
  rangeStart,
  dayWidth,
  color,
  label,
  onCommit,
  onClick,
}: {
  value: TimelineValue;
  rangeStart: string;
  dayWidth: number;
  color: string;
  label: string;
  onCommit: (start: string, end: string) => void;
  onClick: () => void;
}) {
  const [preview, setPreview] = useState<TimelineValue | null>(null);
  const dragRef = useRef<{ mode: DragMode; startX: number; origStart: string; origEnd: string } | null>(null);
  const movedRef = useRef(false);

  const current = preview ?? value;
  const left = daysBetween(rangeStart, current.start) * dayWidth;
  const width = (daysBetween(current.start, current.end) + 1) * dayWidth;

  function beginDrag(e: React.PointerEvent, mode: DragMode) {
    e.stopPropagation();
    // Also suppress the browser's compatibility mousedown for this pointer
    // interaction — otherwise it'd still bubble to the chart's own
    // mousedown-based pan handler and scroll the container while a bar is
    // being moved/resized at the same time.
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    movedRef.current = false;
    dragRef.current = { mode, startX: e.clientX, origStart: value.start, origEnd: value.end };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaDays = Math.round((e.clientX - drag.startX) / dayWidth);
    if (deltaDays !== 0) movedRef.current = true;

    if (drag.mode === 'move') {
      setPreview({ start: addDays(drag.origStart, deltaDays), end: addDays(drag.origEnd, deltaDays) });
    } else if (drag.mode === 'resize-start') {
      const newStart = addDays(drag.origStart, deltaDays);
      if (newStart <= drag.origEnd) setPreview({ start: newStart, end: drag.origEnd });
    } else {
      const newEnd = addDays(drag.origEnd, deltaDays);
      if (newEnd >= drag.origStart) setPreview({ start: drag.origStart, end: newEnd });
    }
  }

  function handlePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (!movedRef.current) {
      setPreview(null);
      onClick();
      return;
    }

    const finalValue = preview ?? value;
    setPreview(null);
    if (finalValue.start !== value.start || finalValue.end !== value.end) {
      onCommit(finalValue.start, finalValue.end);
    }
  }

  return (
    <div
      style={{ left, width, backgroundColor: color }}
      title={label}
      className="absolute top-1 bottom-1 z-10 flex cursor-grab items-center rounded px-2 text-[11px] font-medium text-white active:cursor-grabbing"
      onPointerDown={(e) => beginDrag(e, 'move')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div onPointerDown={(e) => beginDrag(e, 'resize-start')} className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize" />
      <span className="truncate">{label}</span>
      <div onPointerDown={(e) => beginDrag(e, 'resize-end')} className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize" />
    </div>
  );
}
