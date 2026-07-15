'use client';

import type { CellValue, Column, ColumnOptions, MemberProfile } from '@/types/database';
import { TextCell } from './TextCell';
import { StatusCell } from './StatusCell';
import { PeopleCell } from './PeopleCell';
import { DateCell } from './DateCell';
import { NumericCell } from './NumericCell';
import { DropdownCell } from './DropdownCell';
import { CheckboxCell } from './CheckboxCell';
import { LinkCell } from './LinkCell';
import { RatingCell } from './RatingCell';
import { TimelineCell } from './TimelineCell';
import { FileCell } from './FileCell';
import { ProgressCell } from './ProgressCell';

export function Cell({
  column,
  cellValue,
  onChange,
  onOptionsChange,
  members = [],
  onOpenItem,
  attachmentCount = 0,
}: {
  column: Column;
  cellValue: CellValue;
  onChange: (value: CellValue) => void;
  onOptionsChange?: (options: ColumnOptions) => void;
  members?: MemberProfile[];
  onOpenItem?: () => void;
  attachmentCount?: number;
}) {
  switch (cellValue.type) {
    case 'text':
      return (
        <TextCell value={cellValue.value} onChange={(value) => onChange({ type: 'text', value })} members={members} />
      );
    case 'status':
      return (
        <StatusCell column={column} value={cellValue.value} onChange={(value) => onChange({ type: 'status', value })} />
      );
    case 'people':
      return (
        <PeopleCell
          value={cellValue.value}
          onChange={(value) => onChange({ type: 'people', value })}
          members={members}
        />
      );
    case 'date':
      return <DateCell value={cellValue.value} onChange={(value) => onChange({ type: 'date', value })} />;
    case 'numeric':
      return <NumericCell value={cellValue.value} onChange={(value) => onChange({ type: 'numeric', value })} />;
    case 'dropdown':
      return (
        <DropdownCell
          column={column}
          value={cellValue.value}
          onChange={(value) => onChange({ type: 'dropdown', value })}
          onOptionsChange={(options) => onOptionsChange?.(options)}
        />
      );
    case 'checkbox':
      return <CheckboxCell value={cellValue.value} onChange={(value) => onChange({ type: 'checkbox', value })} />;
    case 'link':
      return <LinkCell value={cellValue.value} onChange={(value) => onChange({ type: 'link', value })} />;
    case 'rating':
      return (
        <RatingCell column={column} value={cellValue.value} onChange={(value) => onChange({ type: 'rating', value })} />
      );
    case 'timeline':
      return <TimelineCell value={cellValue.value} onChange={(value) => onChange({ type: 'timeline', value })} />;
    case 'file':
      return <FileCell count={attachmentCount} onOpenItem={onOpenItem} />;
    case 'progress':
      return <ProgressCell value={cellValue.value} onChange={(value) => onChange({ type: 'progress', value })} />;
  }
}
