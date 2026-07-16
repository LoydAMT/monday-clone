import type { Column } from '@/types/database';

export const DEFAULT_COLUMN_WIDTH = 150;
export const DEFAULT_COLUMN_WIDTH_COMPACT = 104;
export const MIN_COLUMN_WIDTH = 80;

const HANDLE_WIDTH = 36;
const ADD_COLUMN_WIDTH = 44;
export const ITEM_MIN_WIDTH = 220;
export const ITEM_MIN_WIDTH_COMPACT = 150;

export function columnWidth(column: Column, compact = false): number {
  if (column.options.width != null) return column.options.width;
  return compact ? DEFAULT_COLUMN_WIDTH_COMPACT : DEFAULT_COLUMN_WIDTH;
}

// Only the mobile narrowed-on-scroll state (`narrowed`) collapses the move
// handle/open-item track to 0 — a plain desktop drag-resize of the Item
// column also sets `itemWidth` but keeps those buttons, so it must keep
// their track too (see ItemRow).
export function handleTrackWidth(narrowed = false): number {
  return narrowed ? 0 : HANDLE_WIDTH;
}

// Rows and the header must share one template — any difference (e.g. the
// header having an extra trailing column the rows don't) changes how much
// space the flexible `minmax(_,1fr)` Item column absorbs in each case,
// shifting every column after it out of alignment between header and rows.
// Every caller must be passed the exact same `columns`/`compact`/`itemWidth`/
// `narrowed` (including any live resize-preview override) so widths stay
// identical everywhere. `itemWidth` overrides the Item column's own minimum —
// used on mobile to lock it down to a narrow width once the table's been
// scrolled, freeing up room to see more data columns at once, and also set
// by a desktop drag-resize of the Item column (which is not `narrowed`).
export function rowGridTemplate(columns: Column[], compact = false, itemWidth?: number, narrowed = false): string {
  const itemMin = itemWidth ?? (compact ? ITEM_MIN_WIDTH_COMPACT : ITEM_MIN_WIDTH);
  return `${handleTrackWidth(narrowed)}px minmax(${itemMin}px,1fr) ${columns
    .map((c) => `${columnWidth(c, compact)}px`)
    .join(' ')} ${ADD_COLUMN_WIDTH}px`;
}

export function headerGridTemplate(columns: Column[], compact = false, itemWidth?: number, narrowed = false): string {
  return rowGridTemplate(columns, compact, itemWidth, narrowed);
}

// An explicit pixel width for the grid itself, not just its template —
// relying on a `min-w-fit` wrapper's fit-content guess to force horizontal
// scroll turned out to be unreliable on some mobile browsers (columns got
// squeezed to fit instead of scrolling); a real number leaves no ambiguity.
export function totalGridWidth(columns: Column[], compact = false, itemWidth?: number, narrowed = false): number {
  const itemMin = itemWidth ?? (compact ? ITEM_MIN_WIDTH_COMPACT : ITEM_MIN_WIDTH);
  return handleTrackWidth(narrowed) + itemMin + columns.reduce((sum, c) => sum + columnWidth(c, compact), 0) + ADD_COLUMN_WIDTH;
}
