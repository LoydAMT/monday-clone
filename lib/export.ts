import type { CellValue, Column, Group, Item, MemberProfile } from '@/types/database';
import { getCellValue } from './cell-helpers';
import { displayName } from './avatar-color';
import { stripMentionTokens } from './mentions';

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatCellForCsv(cell: CellValue, members: MemberProfile[]): string {
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
  }
}

// Only top-level items (not subitems) get a row — subitems don't carry their
// own group, so there's no sensible "Group" column value for them here.
export function boardToCsv(columns: Column[], groups: Group[], items: Item[], members: MemberProfile[]): string {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const header = ['Group', 'Item', ...columns.map((c) => c.name)];
  const rows = items
    .filter((item) => item.parent_item_id === null)
    .map((item) => [
      groupName.get(item.group_id) ?? '',
      item.title,
      ...columns.map((c) => formatCellForCsv(getCellValue(c, item), members)),
    ]);
  const lines = [header, ...rows].map((row) => row.map(csvEscape).join(','));
  // Leading BOM so Excel opens the UTF-8 file (names, emoji, etc.) correctly.
  return String.fromCharCode(0xfeff) + lines.join('\r\n');
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Dynamically imported — this pulls in html-to-image's DOM-cloning/SVG
// serialization code, which only ever runs from a click, so keep it out of
// the initial bundle.
export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(node, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    // Capture the full scrollable content, not just what's visible in the
    // clipped viewport — both Kanban and Gantt scroll horizontally.
    width: node.scrollWidth,
    height: node.scrollHeight,
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
