// Full-board Excel export/import — offline editing round trip.
//
// Header scheme (shared by writer and reader below, so they can never drift
// apart): row 1 is a hidden row of stable machine keys, one per spreadsheet
// column (`__item_id__`, `col:<columnId>`, etc.) — keys stay attached to
// their column even if the user drags it elsewhere in Excel, since moving a
// column moves every row's cell in it, including row 1's. Row 2 is the
// human-readable header. Data starts at row 3. The Item ID / Parent Item ID
// columns are hidden so the user never has to touch them; a blank Item ID
// on re-import means "create a new item".
import type ExcelJS from 'exceljs';
import type {
  Board,
  CellValue,
  Column,
  Group,
  Item,
  ItemCells,
  LinkedItemSummary,
  MemberProfile,
} from '@/types/database';
import { getCellValue } from './cell-helpers';

const KEY_ITEM_ID = '__item_id__';
const KEY_PARENT_ITEM_ID = '__parent_item_id__';
const KEY_GROUP = '__group__';
const KEY_TITLE = '__title__';

function columnKey(columnId: string, part?: string): string {
  return part ? `col:${columnId}:${part}` : `col:${columnId}`;
}

interface ColSpec {
  key: string;
  header: string;
  kind: 'itemId' | 'parentItemId' | 'group' | 'title' | 'data';
  hidden?: boolean;
  column?: Column;
  part?: 'url' | 'text' | 'start' | 'end';
}

// Single source of truth for "what spreadsheet columns does this board's
// column list turn into" — used by the writer to lay out the sheet and by
// the reader to know which key(s) to look up for each board column.
function buildColumnSpecs(columns: Column[]): ColSpec[] {
  const specs: ColSpec[] = [
    { key: KEY_ITEM_ID, header: 'Item ID', kind: 'itemId', hidden: true },
    { key: KEY_PARENT_ITEM_ID, header: 'Parent Item ID', kind: 'parentItemId', hidden: true },
    { key: KEY_GROUP, header: 'Group', kind: 'group' },
    { key: KEY_TITLE, header: 'Item', kind: 'title' },
  ];
  for (const column of columns) {
    if (column.type === 'link') {
      specs.push({ key: columnKey(column.id, 'text'), header: `${column.name} (Text)`, kind: 'data', column, part: 'text' });
      specs.push({ key: columnKey(column.id, 'url'), header: `${column.name} (URL)`, kind: 'data', column, part: 'url' });
    } else if (column.type === 'timeline') {
      specs.push({ key: columnKey(column.id, 'start'), header: `${column.name} (Start)`, kind: 'data', column, part: 'start' });
      specs.push({ key: columnKey(column.id, 'end'), header: `${column.name} (End)`, kind: 'data', column, part: 'end' });
    } else {
      const readOnly = column.type === 'file' || column.type === 'linked_record';
      specs.push({
        key: columnKey(column.id),
        header: readOnly ? `${column.name} (read-only)` : column.name,
        kind: 'data',
        column,
      });
    }
  }
  return specs;
}

function columnLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface BoardExportContext {
  board: Board;
  columns: Column[];
  groups: Group[];
  items: Item[]; // top-level only (parent_item_id === null)
  subitems: Item[]; // all subitems, any parent, any group
  members: MemberProfile[];
  attachmentCounts: Record<string, number>;
  linkedRecordsByCell: Record<string, LinkedItemSummary[]>;
}

export async function buildBoardWorkbook(ctx: BoardExportContext): Promise<ExcelJS.Workbook> {
  const { default: ExcelJSRuntime } = await import('exceljs');
  const workbook = new ExcelJSRuntime.Workbook();

  const instructions = workbook.addWorksheet('Instructions');
  instructions.getColumn(1).width = 100;
  const lines = [
    `${ctx.board.name} — Excel export`,
    '',
    'How to use this file:',
    '• Edit the "Board" sheet. Each row is one item ("↳" marks a subitem).',
    '• To add a NEW item, add a new row and leave the (hidden) Item ID column blank — just fill in Group, Item, and whatever columns you want. You never need to touch the Item ID column.',
    '• Group must exactly match an existing group name on this board, or the row will be skipped when you re-import.',
    "• Status and Dropdown cells are validated pick-lists — use the dropdown arrow in the cell. A typed value that isn't one of the listed options is skipped (not created as a new option) on re-import.",
    '• People cells take a comma-separated list of member emails — see the "Board Members" sheet.',
    "• Progress must be a whole number 0-100. Rating must be a whole number from 1 to the column's max.",
    '• Columns marked "(read-only)" (Files, Linked Record) are exported for reference only — edits to them are ignored on import.',
    '• Do not unhide or edit the hidden "Item ID" / "Parent Item ID" columns — re-importing uses them to match your edits back to the right item.',
    '',
    `Exported ${new Date().toLocaleString()}`,
  ];
  lines.forEach((line, i) => {
    instructions.getCell(i + 1, 1).value = line;
  });
  instructions.getCell(1, 1).font = { bold: true, size: 14 };
  instructions.getCell(3, 1).font = { bold: true };

  // Hidden helper sheet backing the Status/Dropdown pick-lists — a range
  // reference here avoids Excel's ~255-char limit on inline list formulae
  // and awkward escaping for labels that themselves contain commas.
  const validationSheet = workbook.addWorksheet('ValidationLists', { state: 'veryHidden' });
  const validationRanges = new Map<string, string>();
  let vCol = 1;
  for (const column of ctx.columns) {
    if (column.type !== 'status' && column.type !== 'dropdown') continue;
    const options = (column.type === 'status' ? column.options.statuses : column.options.tags) ?? [];
    if (options.length === 0) continue;
    validationSheet.getCell(1, vCol).value = column.name;
    options.forEach((opt, i) => {
      validationSheet.getCell(2 + i, vCol).value = opt.label;
    });
    const letter = columnLetter(vCol);
    validationRanges.set(column.id, `ValidationLists!$${letter}$2:$${letter}$${1 + options.length}`);
    vCol++;
  }

  const membersSheet = workbook.addWorksheet('Board Members');
  membersSheet.getCell(1, 1).value = 'Email';
  membersSheet.getCell(1, 2).value = 'Name';
  membersSheet.getRow(1).font = { bold: true };
  membersSheet.getColumn(1).width = 30;
  membersSheet.getColumn(2).width = 24;
  ctx.members.forEach((m, i) => {
    membersSheet.getCell(i + 2, 1).value = m.email;
    membersSheet.getCell(i + 2, 2).value = m.full_name ?? '';
  });

  const sheet = workbook.addWorksheet('Board');
  const specs = buildColumnSpecs(ctx.columns);
  specs.forEach((spec, i) => {
    const colNum = i + 1;
    sheet.getCell(1, colNum).value = spec.key;
    sheet.getCell(2, colNum).value = spec.header;
    sheet.getColumn(colNum).width = spec.kind === 'title' ? 28 : 18;
    if (spec.hidden) sheet.getColumn(colNum).hidden = true;
  });
  sheet.getRow(1).hidden = true;
  sheet.getRow(2).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 2 }];

  const groupNameById = new Map(ctx.groups.map((g) => [g.id, g.name]));

  const topByGroup = new Map<string, Item[]>();
  for (const item of ctx.items) {
    const arr = topByGroup.get(item.group_id) ?? [];
    arr.push(item);
    topByGroup.set(item.group_id, arr);
  }
  for (const arr of topByGroup.values()) arr.sort((a, b) => a.position - b.position);

  const subitemsByParent = new Map<string, Item[]>();
  for (const item of ctx.subitems) {
    if (!item.parent_item_id) continue;
    const arr = subitemsByParent.get(item.parent_item_id) ?? [];
    arr.push(item);
    subitemsByParent.set(item.parent_item_id, arr);
  }
  for (const arr of subitemsByParent.values()) arr.sort((a, b) => a.position - b.position);

  function writeDataCell(cell: ExcelJS.Cell, spec: ColSpec, item: Item) {
    const column = spec.column!;
    const value = getCellValue(column, item);

    switch (column.type) {
      case 'text':
        cell.value = value.type === 'text' ? value.value : '';
        break;
      case 'status': {
        cell.value = value.type === 'status' ? value.value : '';
        const range = validationRanges.get(column.id);
        if (range) {
          const options = column.options.statuses ?? [];
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [range],
            showErrorMessage: true,
            errorStyle: 'stop',
            error: `Must be one of: ${options.map((o) => o.label).join(', ')}`,
          };
        }
        break;
      }
      case 'dropdown': {
        cell.value = value.type === 'dropdown' ? value.value.join(', ') : '';
        const range = validationRanges.get(column.id);
        if (range) {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [range],
            showErrorMessage: true,
            errorStyle: 'information',
            error: 'Separate multiple tags with commas.',
          };
        }
        break;
      }
      case 'people':
        cell.value =
          value.type === 'people'
            ? value.value
                .map((id) => ctx.members.find((m) => m.user_id === id)?.email ?? '')
                .filter(Boolean)
                .join(', ')
            : '';
        break;
      case 'date':
        cell.value = value.type === 'date' && value.value ? new Date(value.value) : null;
        cell.numFmt = 'yyyy-mm-dd';
        break;
      case 'numeric':
        cell.value = value.type === 'numeric' ? value.value : null;
        break;
      case 'checkbox':
        cell.value = value.type === 'checkbox' && value.value ? 'Yes' : 'No';
        cell.dataValidation = { type: 'list', allowBlank: false, formulae: ['"Yes,No"'] };
        break;
      case 'link': {
        const lv = value.type === 'link' ? value.value : null;
        cell.value = spec.part === 'url' ? (lv?.url ?? '') : (lv?.text ?? '');
        break;
      }
      case 'rating': {
        cell.value = value.type === 'rating' ? value.value : null;
        const max = column.options.ratingMax ?? 5;
        cell.dataValidation = {
          type: 'whole',
          operator: 'between',
          allowBlank: true,
          formulae: [1, max],
          showErrorMessage: true,
          error: `Must be a whole number 1-${max}`,
        };
        break;
      }
      case 'timeline': {
        const tv = value.type === 'timeline' ? value.value : null;
        const raw = spec.part === 'start' ? tv?.start : tv?.end;
        cell.value = raw ? new Date(raw) : null;
        cell.numFmt = 'yyyy-mm-dd';
        break;
      }
      case 'progress':
        cell.value = value.type === 'progress' ? value.value : null;
        cell.dataValidation = {
          type: 'whole',
          operator: 'between',
          allowBlank: true,
          formulae: [0, 100],
          showErrorMessage: true,
          error: 'Must be a whole number 0-100',
        };
        break;
      case 'file': {
        const count = ctx.attachmentCounts[item.id] ?? 0;
        cell.value = `${count} file${count === 1 ? '' : 's'} — not editable via Excel`;
        break;
      }
      case 'linked_record': {
        const links = ctx.linkedRecordsByCell[`${column.id}:${item.id}`] ?? [];
        cell.value = links.map((l) => l.title).join(', ');
        break;
      }
    }
  }

  function writeRow(rowNum: number, item: Item, groupName: string, isSubitem: boolean) {
    specs.forEach((spec, i) => {
      const cell = sheet.getCell(rowNum, i + 1);
      switch (spec.kind) {
        case 'itemId':
          cell.value = item.id;
          break;
        case 'parentItemId':
          cell.value = item.parent_item_id ?? '';
          break;
        case 'group':
          cell.value = groupName;
          break;
        case 'title':
          cell.value = (isSubitem ? '↳ ' : '') + item.title;
          break;
        case 'data':
          writeDataCell(cell, spec, item);
          break;
      }
    });
  }

  let rowNum = 3;
  for (const group of ctx.groups) {
    for (const item of topByGroup.get(group.id) ?? []) {
      writeRow(rowNum++, item, group.name, false);
      for (const sub of subitemsByParent.get(item.id) ?? []) {
        writeRow(rowNum++, sub, groupNameById.get(sub.group_id) ?? group.name, true);
      }
    }
  }

  return workbook;
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface BoardImportUpdate {
  row: number;
  itemId: string;
  title?: string;
  groupId?: string;
  cellPatch: ItemCells;
  warnings: string[];
}

export interface BoardImportCreate {
  row: number;
  groupId: string;
  parentItemId: string | null;
  title: string;
  cells: ItemCells;
  warnings: string[];
}

export interface BoardImportRejected {
  row: number;
  reason: string;
}

export interface BoardImportResult {
  updates: BoardImportUpdate[];
  creates: BoardImportCreate[];
  rejected: BoardImportRejected[];
  ignoredColumns: string[];
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim();
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    return '';
  }
  return String(value).trim();
}

function isRowBlank(row: ExcelJS.Row): boolean {
  let hasValue = false;
  row.eachCell({ includeEmpty: false }, () => {
    hasValue = true;
  });
  return !hasValue;
}

function parseDateText(raw: ExcelJS.CellValue): { value: string | null; invalid: boolean } {
  if (raw == null) return { value: null, invalid: false };
  if (raw instanceof Date) return { value: raw.toISOString().slice(0, 10), invalid: false };
  const text = cellText(raw).trim();
  if (!text) return { value: null, invalid: false };
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return { value: null, invalid: true };
  return { value: parsed.toISOString().slice(0, 10), invalid: false };
}

function parseCellForColumn(
  column: Column,
  read: (key: string) => ExcelJS.CellValue,
  memberByEmail: Map<string, MemberProfile>
): { value?: CellValue; warning?: string } {
  switch (column.type) {
    case 'text':
      return { value: { type: 'text', value: cellText(read(columnKey(column.id))) } };
    case 'status': {
      const raw = cellText(read(columnKey(column.id))).trim();
      if (!raw) return { value: { type: 'status', value: '' } };
      const match = (column.options.statuses ?? []).find((o) => o.label.toLowerCase() === raw.toLowerCase());
      if (!match) return { warning: `"${raw}" is not a valid Status option for "${column.name}" — cell skipped` };
      return { value: { type: 'status', value: match.label } };
    }
    case 'dropdown': {
      const raw = cellText(read(columnKey(column.id))).trim();
      if (!raw) return { value: { type: 'dropdown', value: [] } };
      const options = column.options.tags ?? [];
      const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
      const matched: string[] = [];
      const bad: string[] = [];
      for (const t of tokens) {
        const match = options.find((o) => o.label.toLowerCase() === t.toLowerCase());
        if (match) matched.push(match.label);
        else bad.push(t);
      }
      return {
        value: { type: 'dropdown', value: matched },
        warning: bad.length
          ? `${bad.map((b) => `"${b}"`).join(', ')} not a valid option for "${column.name}" — ignored`
          : undefined,
      };
    }
    case 'people': {
      const raw = cellText(read(columnKey(column.id))).trim();
      if (!raw) return { value: { type: 'people', value: [] } };
      const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
      const matched: string[] = [];
      const bad: string[] = [];
      for (const t of tokens) {
        const member = memberByEmail.get(t.toLowerCase());
        if (member) matched.push(member.user_id);
        else bad.push(t);
      }
      return {
        value: { type: 'people', value: matched },
        warning: bad.length
          ? `${bad.map((b) => `"${b}"`).join(', ')} not a board member for "${column.name}" — ignored`
          : undefined,
      };
    }
    case 'date': {
      const raw = read(columnKey(column.id));
      const { value, invalid } = parseDateText(raw);
      if (invalid) return { warning: `"${cellText(raw)}" is not a valid date for "${column.name}" — cell skipped` };
      return { value: { type: 'date', value } };
    }
    case 'numeric': {
      const text = cellText(read(columnKey(column.id))).trim();
      if (!text) return { value: { type: 'numeric', value: null } };
      const num = Number(text);
      if (Number.isNaN(num)) return { warning: `"${text}" is not a number for "${column.name}" — cell skipped` };
      return { value: { type: 'numeric', value: num } };
    }
    case 'checkbox': {
      const raw = cellText(read(columnKey(column.id))).trim().toLowerCase();
      if (['yes', 'true', '1'].includes(raw)) return { value: { type: 'checkbox', value: true } };
      if (['no', 'false', '0', ''].includes(raw)) return { value: { type: 'checkbox', value: false } };
      return { warning: `"${raw}" is not Yes/No for "${column.name}" — cell skipped` };
    }
    case 'link': {
      const url = cellText(read(columnKey(column.id, 'url'))).trim();
      const text = cellText(read(columnKey(column.id, 'text'))).trim();
      if (!url && !text) return { value: { type: 'link', value: null } };
      return { value: { type: 'link', value: { url, text } } };
    }
    case 'rating': {
      const raw = cellText(read(columnKey(column.id))).trim();
      if (!raw) return { value: { type: 'rating', value: null } };
      const num = Number(raw);
      const max = column.options.ratingMax ?? 5;
      if (!Number.isInteger(num) || num < 1 || num > max) {
        return { warning: `"${raw}" is not a whole number 1-${max} for "${column.name}" — cell skipped` };
      }
      return { value: { type: 'rating', value: num } };
    }
    case 'timeline': {
      const startRaw = read(columnKey(column.id, 'start'));
      const endRaw = read(columnKey(column.id, 'end'));
      const start = parseDateText(startRaw);
      const end = parseDateText(endRaw);
      if (start.invalid || end.invalid) {
        return { warning: `Timeline dates for "${column.name}" could not be read — cell skipped` };
      }
      if (!start.value && !end.value) return { value: { type: 'timeline', value: null } };
      if (!start.value || !end.value) {
        return { warning: `Timeline for "${column.name}" needs both a Start and End date — cell skipped` };
      }
      return { value: { type: 'timeline', value: { start: start.value, end: end.value } } };
    }
    case 'progress': {
      const raw = cellText(read(columnKey(column.id))).trim();
      if (!raw) return { value: { type: 'progress', value: null } };
      const num = Number(raw);
      if (!Number.isInteger(num) || num < 0 || num > 100) {
        return { warning: `"${raw}" is not a whole number 0-100 for "${column.name}" — cell skipped` };
      }
      return { value: { type: 'progress', value: num } };
    }
    case 'file':
    case 'linked_record':
      return {};
  }
}

export async function parseBoardWorkbook(
  file: File,
  columns: Column[],
  groups: Group[],
  items: Item[],
  subitems: Item[],
  members: MemberProfile[]
): Promise<BoardImportResult> {
  const { default: ExcelJSRuntime } = await import('exceljs');
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJSRuntime.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets.find((ws) => {
    let found = false;
    ws.getRow(1).eachCell((cell) => {
      if (cellText(cell.value) === KEY_ITEM_ID) found = true;
    });
    return found;
  });
  if (!sheet) throw new Error('NOT_A_BOARD_EXPORT');

  const keyToCol = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const key = cellText(cell.value);
    if (key) keyToCol.set(key, colNumber);
  });

  const dataKeys = new Set<string>();
  for (const column of columns) {
    if (column.type === 'link') {
      dataKeys.add(columnKey(column.id, 'text'));
      dataKeys.add(columnKey(column.id, 'url'));
    } else if (column.type === 'timeline') {
      dataKeys.add(columnKey(column.id, 'start'));
      dataKeys.add(columnKey(column.id, 'end'));
    } else {
      dataKeys.add(columnKey(column.id));
    }
  }
  const ignoredColumns = [...keyToCol.keys()].filter((k) => k.startsWith('col:') && !dataKeys.has(k));

  const itemById = new Map<string, Item>([...items, ...subitems].map((i) => [i.id, i]));
  const groupIdByName = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g.id]));
  const memberByEmail = new Map(members.map((m) => [m.email.toLowerCase(), m]));

  const result: BoardImportResult = { updates: [], creates: [], rejected: [], ignoredColumns };

  const lastRow = sheet.lastRow?.number ?? 2;
  for (let rowNum = 3; rowNum <= lastRow; rowNum++) {
    const row = sheet.getRow(rowNum);
    if (isRowBlank(row)) continue;

    const read = (key: string): ExcelJS.CellValue => {
      const col = keyToCol.get(key);
      return col ? row.getCell(col).value : null;
    };

    const rawItemId = cellText(read(KEY_ITEM_ID));
    const rawParentId = cellText(read(KEY_PARENT_ITEM_ID));
    const rawGroup = cellText(read(KEY_GROUP)).trim();
    const rawTitle = cellText(read(KEY_TITLE)).replace(/^↳\s*/, '').trim();

    const groupId = groupIdByName.get(rawGroup.toLowerCase());
    if (!groupId) {
      result.rejected.push({ row: rowNum, reason: `Group "${rawGroup || '(blank)'}" not found` });
      continue;
    }

    let parentItemId: string | null = null;
    if (rawParentId) {
      if (!itemById.has(rawParentId)) {
        result.rejected.push({
          row: rowNum,
          reason: 'Parent item not found (it may have been a new row earlier in this same import — import it separately first)',
        });
        continue;
      }
      parentItemId = rawParentId;
    }

    const existingItem = rawItemId ? itemById.get(rawItemId) : undefined;
    if (rawItemId && !existingItem) {
      result.rejected.push({ row: rowNum, reason: 'Item ID no longer exists on this board' });
      continue;
    }

    const warnings: string[] = [];
    const cells: ItemCells = {};
    for (const column of columns) {
      if (column.type === 'file' || column.type === 'linked_record') continue;
      const parsed = parseCellForColumn(column, read, memberByEmail);
      if (parsed.warning) warnings.push(parsed.warning);
      if (parsed.value !== undefined) cells[column.id] = parsed.value;
    }

    if (existingItem) {
      const update: BoardImportUpdate = { row: rowNum, itemId: existingItem.id, cellPatch: cells, warnings };
      if (rawTitle && rawTitle !== existingItem.title) update.title = rawTitle;
      if (groupId !== existingItem.group_id) update.groupId = groupId;
      result.updates.push(update);
    } else {
      result.creates.push({
        row: rowNum,
        groupId,
        parentItemId,
        title: rawTitle || 'New Item',
        cells,
        warnings,
      });
    }
  }

  return result;
}
