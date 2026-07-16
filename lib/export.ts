import type { Column, Group, Item, MemberProfile } from '@/types/database';
import { getCellValue } from './cell-helpers';
import { formatCellValue } from './cell-format';

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
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
      ...columns.map((c) => formatCellValue(getCellValue(c, item), members)),
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

// Rasterizes the full node (scrollWidth/scrollHeight, same as
// exportNodeAsPng — never just the clipped viewport) and drops it into a
// single PDF page sized to match exactly, so a wide Gantt timeline lands
// entirely on one page instead of being cropped or split across pages.
export async function exportNodeAsPdf(node: HTMLElement, filename: string) {
  const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const width = node.scrollWidth;
  const height = node.scrollHeight;
  const dataUrl = await toPng(node, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
    width,
    height,
  });

  const doc = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  });
  doc.addImage(dataUrl, 'PNG', 0, 0, width, height);
  doc.save(filename);
}
