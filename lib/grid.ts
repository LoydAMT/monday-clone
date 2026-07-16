import type { Column } from '@/types/database';

export const DEFAULT_COLUMN_WIDTH = 150;
export const DEFAULT_COLUMN_WIDTH_COMPACT = 104;
export const MIN_COLUMN_WIDTH = 80;

const HANDLE_WIDTH = 36;
const ADD_COLUMN_WIDTH = 44;
const ITEM_MIN_WIDTH = 220;
const ITEM_MIN_WIDTH_COMPACT = 150;

export function columnWidth(column: Column, compact = false): number {
  if (column.options.width != null) return column.options.width;
  return compact ? DEFAULT_COLUMN_WIDTH_COMPACT : DEFAULT_COLUMN_WIDTH;
}

// When `itemWidth` (the narrowed-on-mobile override) is set, the move handle
// and open-item buttons are hidden (see ItemRow) — collapse their 36px
// track to 0 too, instead of leaving it as dead space next to the title.
export function handleTrackWidth(itemWidth?: number): number {
  return itemWidth !== undefined ? 0 : HANDLE_WIDTH;
}

// Rows and the header must share one template — any difference (e.g. the
// header having an extra trailing column the rows don't) changes how much
// space the flexible `minmax(_,1fr)` Item column absorbs in each case,
// shifting every column after it out of alignment between header and rows.
// Every caller must be passed the exact same `columns`/`compact`/`itemWidth`
// (including any live resize-preview override) so widths stay identical
// everywhere. `itemWidth` overrides the Item column's own minimum — used on
// mobile to lock it down to a narrow width once the table's been scrolled,
// freeing up room to see more data columns at once.
export function rowGridTemplate(columns: Column[], compact = false, itemWidth?: number): string {
  const itemMin = itemWidth ?? (compact ? ITEM_MIN_WIDTH_COMPACT : ITEM_MIN_WIDTH);
  return `${handleTrackWidth(itemWidth)}px minmax(${itemMin}px,1fr) ${columns
    .map((c) => `${columnWidth(c, compact)}px`)
    .join(' ')} ${ADD_COLUMN_WIDTH}px`;
}

export function headerGridTemplate(columns: Column[], compact = false, itemWidth?: number): string {
  return rowGridTemplate(columns, compact, itemWidth);
}

// An explicit pixel width for the grid itself, not just its template —
// relying on a `min-w-fit` wrapper's fit-content guess to force horizontal
// scroll turned out to be unreliable on some mobile browsers (columns got
// squeezed to fit instead of scrolling); a real number leaves no ambiguity.
export function totalGridWidth(columns: Column[], compact = false, itemWidth?: number): number {
  const itemMin = itemWidth ?? (compact ? ITEM_MIN_WIDTH_COMPACT : ITEM_MIN_WIDTH);
  return handleTrackWidth(itemWidth) + itemMin + columns.reduce((sum, c) => sum + columnWidth(c, compact), 0) + ADD_COLUMN_WIDTH;
}
