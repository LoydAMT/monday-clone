import type { Column } from '@/types/database';

export const DEFAULT_COLUMN_WIDTH = 150;
export const MIN_COLUMN_WIDTH = 80;

export function columnWidth(column: Column): number {
  return column.options.width ?? DEFAULT_COLUMN_WIDTH;
}

// Rows and the header must share one template — any difference (e.g. the
// header having an extra trailing column the rows don't) changes how much
// space the flexible `minmax(220px,1fr)` Item column absorbs in each case,
// shifting every column after it out of alignment between header and rows.
// Every caller must be passed the exact same `columns` (including any live
// resize-preview override) so widths stay identical between header and rows.
export function rowGridTemplate(columns: Column[]) {
  return `36px minmax(220px,1fr) ${columns.map((c) => `${columnWidth(c)}px`).join(' ')} 44px`;
}

export function headerGridTemplate(columns: Column[]) {
  return rowGridTemplate(columns);
}
