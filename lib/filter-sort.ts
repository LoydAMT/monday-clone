import type { CellValue, Column, Item } from '@/types/database';

export interface ColumnFilter {
  columnId: string;
  values: string[];
}

export interface SortState {
  columnId: string;
  direction: 'asc' | 'desc';
}

function cellText(value: CellValue | undefined): string {
  if (!value) return '';
  switch (value.type) {
    case 'text':
      return value.value;
    case 'status':
      return value.value;
    case 'people':
      return value.value.join(' ');
    case 'date':
      return value.value ?? '';
    case 'numeric':
      return value.value?.toString() ?? '';
    case 'dropdown':
      return value.value.join(' ');
    case 'checkbox':
      return value.value ? 'yes' : 'no';
    case 'link':
      return value.value ? `${value.value.text} ${value.value.url}` : '';
    case 'rating':
      return value.value?.toString() ?? '';
    case 'timeline':
      return value.value ? `${value.value.start} ${value.value.end}` : '';
    case 'file':
      return '';
    case 'progress':
      return value.value !== null ? `${value.value}%` : '';
  }
}

export function applySearch(items: Item[], columns: Column[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    return columns.some((column) => cellText(item.cells[column.id]).toLowerCase().includes(q));
  });
}

export function applyFilters(items: Item[], columns: Column[], filters: ColumnFilter[]): Item[] {
  if (filters.length === 0) return items;
  return items.filter((item) =>
    filters.every((filter) => {
      if (filter.values.length === 0) return true;
      const column = columns.find((c) => c.id === filter.columnId);
      if (!column) return true;
      const value = item.cells[column.id];

      if (column.type === 'status' && value?.type === 'status') return filter.values.includes(value.value);
      if (column.type === 'dropdown' && value?.type === 'dropdown') {
        return value.value.some((v) => filter.values.includes(v));
      }
      if (column.type === 'people' && value?.type === 'people') {
        return value.value.some((v) => filter.values.includes(v));
      }
      return cellText(value).toLowerCase().includes((filter.values[0] ?? '').toLowerCase());
    })
  );
}

function sortKey(value: CellValue | undefined): string | number {
  if (!value) return '';
  switch (value.type) {
    case 'numeric':
      return value.value ?? -Infinity;
    case 'rating':
      return value.value ?? -Infinity;
    case 'progress':
      return value.value ?? -Infinity;
    case 'date':
      return value.value ?? '';
    case 'timeline':
      return value.value?.start ?? '';
    case 'checkbox':
      return value.value ? 1 : 0;
    default:
      return cellText(value).toLowerCase();
  }
}

export function applySort(items: Item[], columns: Column[], sort: SortState | null): Item[] {
  if (!sort) return items;
  const column = columns.find((c) => c.id === sort.columnId);
  if (!column) return items;

  const sorted = [...items].sort((a, b) => {
    const av = sortKey(a.cells[column.id]);
    const bv = sortKey(b.cells[column.id]);
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });

  return sort.direction === 'desc' ? sorted.reverse() : sorted;
}
