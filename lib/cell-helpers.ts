import type { CellValue, Column, Item } from '@/types/database';

export function getCellValue(column: Column, item: Item): CellValue {
  const existing = item.cells[column.id];
  if (existing) return existing;

  switch (column.type) {
    case 'text':
      return { type: 'text', value: '' };
    case 'status':
      return { type: 'status', value: '' };
    case 'people':
      return { type: 'people', value: [] };
    case 'date':
      return { type: 'date', value: null };
    case 'numeric':
      return { type: 'numeric', value: null };
    case 'dropdown':
      return { type: 'dropdown', value: [] };
    case 'checkbox':
      return { type: 'checkbox', value: false };
    case 'link':
      return { type: 'link', value: null };
    case 'rating':
      return { type: 'rating', value: null };
    case 'timeline':
      return { type: 'timeline', value: null };
    case 'file':
      return { type: 'file', value: null };
    case 'progress':
      return { type: 'progress', value: null };
    case 'linked_record':
      return { type: 'linked_record', value: null };
  }
}
