// Attendance Excel export — a standalone report, not a round-trip
// import/export pair like lib/excel.ts's board workbook (attendance records
// aren't meant to be bulk-edited via spreadsheet and re-imported).
import type ExcelJS from 'exceljs';
import type { AttendanceRecord, MemberProfile } from '@/types/database';
import { durationHours } from './attendance-time';

export interface AttendanceExportContext {
  workspaceName: string;
  startDate: string; // 'YYYY-MM-DD', inclusive
  endDate: string; // 'YYYY-MM-DD', inclusive
  members: MemberProfile[];
  records: AttendanceRecord[];
}

function manualNotes(record: AttendanceRecord): string {
  const notes: string[] = [];
  if (record.time_in_manual) notes.push('Manual time in');
  if (record.time_out_manual) notes.push('Manual time out');
  return notes.join('; ');
}

export async function buildAttendanceWorkbook(ctx: AttendanceExportContext): Promise<ExcelJS.Workbook> {
  const { default: ExcelJSRuntime } = await import('exceljs');
  const workbook = new ExcelJSRuntime.Workbook();

  const memberById = new Map(ctx.members.map((m) => [m.user_id, m]));
  const displayName = (m: MemberProfile | undefined, fallbackUserId: string) => m?.full_name?.trim() || m?.email || fallbackUserId;

  const sortedRecords = [...ctx.records].sort((a, b) => {
    if (a.work_date !== b.work_date) return a.work_date.localeCompare(b.work_date);
    const nameA = displayName(memberById.get(a.user_id), a.user_id);
    const nameB = displayName(memberById.get(b.user_id), b.user_id);
    return nameA.localeCompare(nameB);
  });

  // ---------------------------------------------------------------------
  // "Attendance" sheet — one row per punch in the period.
  // ---------------------------------------------------------------------
  const sheet = workbook.addWorksheet('Attendance');
  sheet.getColumn(1).width = 34; // title column also backs the header row below

  const titleRow = sheet.getCell(1, 1);
  titleRow.value = `Attendance Report — ${ctx.workspaceName}`;
  titleRow.font = { bold: true, size: 14 };

  sheet.getCell(2, 1).value = `Period: ${ctx.startDate} to ${ctx.endDate}`;
  sheet.getCell(3, 1).value = `Exported ${new Date().toLocaleString()}`;
  sheet.getCell(3, 1).font = { color: { argb: 'FF6B7280' } };

  const HEADER_ROW = 5;
  const headers = ['Date', 'Member', 'Email', 'Time In', 'Time Out', 'Duration (hrs)', 'Status', 'Notes'];
  headers.forEach((header, i) => {
    const cell = sheet.getCell(HEADER_ROW, i + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  });
  sheet.getColumn(2).width = 24;
  sheet.getColumn(3).width = 30;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 15;
  sheet.getColumn(7).width = 13;
  sheet.getColumn(8).width = 32;
  sheet.views = [{ state: 'frozen', ySplit: HEADER_ROW }];

  sortedRecords.forEach((record, i) => {
    const rowNum = HEADER_ROW + 1 + i;
    const member = memberById.get(record.user_id);
    const [year, month, day] = record.work_date.split('-').map(Number);

    const dateCell = sheet.getCell(rowNum, 1);
    dateCell.value = new Date(year, month - 1, day);
    dateCell.numFmt = 'yyyy-mm-dd';

    sheet.getCell(rowNum, 2).value = displayName(member, record.user_id);
    sheet.getCell(rowNum, 3).value = member?.email ?? '';

    const timeInCell = sheet.getCell(rowNum, 4);
    timeInCell.value = new Date(record.time_in);
    timeInCell.numFmt = 'h:mm AM/PM';

    const timeOutCell = sheet.getCell(rowNum, 5);
    if (record.time_out) {
      timeOutCell.value = new Date(record.time_out);
      timeOutCell.numFmt = 'h:mm AM/PM';
    }

    const hours = durationHours(record.time_in, record.time_out);
    const durationCell = sheet.getCell(rowNum, 6);
    if (hours !== null) {
      durationCell.value = hours;
      durationCell.numFmt = '0.00';
    }

    sheet.getCell(rowNum, 7).value = record.time_out ? 'Complete' : 'In progress';
    sheet.getCell(rowNum, 8).value = manualNotes(record);
  });

  // ---------------------------------------------------------------------
  // "Summary" sheet — one row per workspace member, totalled over the period.
  // ---------------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Summary');
  summarySheet.getColumn(1).width = 34;
  summarySheet.getCell(1, 1).value = `Summary — ${ctx.workspaceName}`;
  summarySheet.getCell(1, 1).font = { bold: true, size: 14 };
  summarySheet.getCell(2, 1).value = `Period: ${ctx.startDate} to ${ctx.endDate}`;

  const SUMMARY_HEADER_ROW = 4;
  const summaryHeaders = ['Member', 'Email', 'Days Recorded', 'Total Hours'];
  summaryHeaders.forEach((header, i) => {
    const cell = summarySheet.getCell(SUMMARY_HEADER_ROW, i + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
  });
  summarySheet.getColumn(2).width = 30;
  summarySheet.getColumn(3).width = 16;
  summarySheet.getColumn(4).width = 14;
  summarySheet.views = [{ state: 'frozen', ySplit: SUMMARY_HEADER_ROW }];

  const recordsByUser = new Map<string, AttendanceRecord[]>();
  for (const record of sortedRecords) {
    const arr = recordsByUser.get(record.user_id) ?? [];
    arr.push(record);
    recordsByUser.set(record.user_id, arr);
  }

  [...ctx.members]
    .sort((a, b) => displayName(a, a.user_id).localeCompare(displayName(b, b.user_id)))
    .forEach((member, i) => {
      const rowNum = SUMMARY_HEADER_ROW + 1 + i;
      const memberRecords = recordsByUser.get(member.user_id) ?? [];
      const totalHours = memberRecords.reduce((sum, r) => sum + (durationHours(r.time_in, r.time_out) ?? 0), 0);

      summarySheet.getCell(rowNum, 1).value = displayName(member, member.user_id);
      summarySheet.getCell(rowNum, 2).value = member.email;
      summarySheet.getCell(rowNum, 3).value = memberRecords.length;
      const totalCell = summarySheet.getCell(rowNum, 4);
      totalCell.value = Math.round(totalHours * 100) / 100;
      totalCell.numFmt = '0.00';
    });

  return workbook;
}
