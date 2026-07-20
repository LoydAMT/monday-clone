import type { CellValue, MemberProfile } from '@/types/database';
import { displayName } from './avatar-color';
import { stripMentionTokens } from './mentions';

// Human-readable rendering of a cell's value — shared by CSV export and
// activity-log "changed X from A to B" descriptions so both read the same.
export function formatCellValue(cell: CellValue, members: MemberProfile[]): string {
  switch (cell.type) {
    case 'text':
      return stripMentionTokens(cell.value);
    case 'status':
      return cell.value;
    case 'people':
      return cell.value
        .map((id) => {
          const member = members.find((m) => m.user_id === id);
          return member ? displayName(member) : id;
        })
        .join(', ');
    case 'date':
      return cell.value ?? '';
    case 'numeric':
      return cell.value === null ? '' : String(cell.value);
    case 'dropdown':
      return cell.value.join(', ');
    case 'checkbox':
      return cell.value ? 'Yes' : 'No';
    case 'link':
      return cell.value ? `${cell.value.text || cell.value.url} (${cell.value.url})` : '';
    case 'rating':
      return cell.value === null ? '' : String(cell.value);
    case 'timeline':
      return cell.value ? `${cell.value.start} to ${cell.value.end}` : '';
    case 'file':
      return '';
    case 'progress':
      return cell.value === null ? '' : `${cell.value}%`;
    // Real titles live in the linked_items table, not reachable from a bare
    // CellValue (its value is always null — see types/database.ts) — CSV
    // export and activity-log text won't show linked titles until this
    // function's signature grows to accept the batched summary map too.
    case 'linked_record':
      return '';
  }
}
