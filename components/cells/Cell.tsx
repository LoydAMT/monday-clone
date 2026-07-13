'use client';

import type { CellValue, Column } from '@/types/database';
import { TextCell } from './TextCell';
import { StatusCell } from './StatusCell';
import { PeopleCell } from './PeopleCell';
import { DateCell } from './DateCell';
import { NumericCell } from './NumericCell';

export function Cell({
  column,
  cellValue,
  onChange,
}: {
  column: Column;
  cellValue: CellValue;
  onChange: (value: CellValue) => void;
}) {
  switch (cellValue.type) {
    case 'text':
      return <TextCell value={cellValue.value} onChange={(value) => onChange({ type: 'text', value })} />;
    case 'status':
      return (
        <StatusCell column={column} value={cellValue.value} onChange={(value) => onChange({ type: 'status', value })} />
      );
    case 'people':
      return <PeopleCell value={cellValue.value} onChange={(value) => onChange({ type: 'people', value })} />;
    case 'date':
      return <DateCell value={cellValue.value} onChange={(value) => onChange({ type: 'date', value })} />;
    case 'numeric':
      return <NumericCell value={cellValue.value} onChange={(value) => onChange({ type: 'numeric', value })} />;
  }
}
