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
  }
}
