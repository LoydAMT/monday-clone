// Date-only helpers for attendance_records.work_date, which is a plain
// 'YYYY-MM-DD' with no timezone. Everything here reads/writes using the
// browser's (or server's) local calendar date/time — never toISOString()
// for the date part, since that shifts to UTC and can land on the wrong day
// close to midnight. Mirrors instrubyte-crm-mobile's src/lib/attendance.ts
// so the two apps agree on what "today" and a given work_date mean.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayLocalDateString(): string {
  return localDateString(new Date());
}

export function formatClockTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatWorkDate(workDate: string): string {
  const [year, month, day] = workDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

// Combines a 'YYYY-MM-DD' work date with an <input type="time"> value
// ('HH:MM') into a local Date — the web equivalent of the mobile app's
// native time-only picker, which always edits a time on an already-known day.
export function combineDateAndTime(workDate: string, timeValue: string): Date {
  const [year, month, day] = workDate.split('-').map(Number);
  const [hours, minutes] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

export function toTimeInputValue(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Default range for the Excel export's date pickers — the current calendar
// month, in the same local-calendar terms as everything else here.
export function startOfMonthString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-01`;
}

export function endOfMonthString(date: Date): string {
  return localDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

// Hours worked as a plain number (not "Xh Ym" text) — the Excel export uses
// this so totals/averages are actual spreadsheet numbers, not strings.
export function durationHours(startIso: string, endIso: string | null): number | null {
  if (!endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.round((ms / 3_600_000) * 100) / 100;
}
