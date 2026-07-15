import type { Item } from '@/types/database';

export const DAY_WIDTH = 44;

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

export function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(dateStr: string, n: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + n);
  return formatISO(date);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseDate(b).getTime() - parseDate(a).getTime();
  return Math.round(ms / 86400000);
}

export function formatDayLabel(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDayNumber(dateStr: string): string {
  return String(parseDate(dateStr).getDate());
}

export function isMonthStart(dateStr: string): boolean {
  return parseDate(dateStr).getDate() === 1;
}

export function today(): string {
  return formatISO(new Date());
}

export function computeDateRange(items: Item[], columnId: string): { start: string; end: string } {
  let start: string | null = null;
  let end: string | null = null;

  for (const item of items) {
    const cell = item.cells[columnId];
    if (cell?.type !== 'timeline' || !cell.value) continue;
    if (!start || cell.value.start < start) start = cell.value.start;
    if (!end || cell.value.end > end) end = cell.value.end;
  }

  if (!start || !end) {
    return { start: addDays(today(), -3), end: addDays(today(), 14) };
  }

  return { start: addDays(start, -2), end: addDays(end, 2) };
}
