// Date-only helpers for attendance_records.work_date, which is a plain
// 'YYYY-MM-DD' with no timezone. Everything here reads/writes using the
// browser's (or server's) local calendar date/time — never toISOString()
// for the date part, since that shifts to UTC and can land on the wrong day
// close to midnight.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayLocalDateString(): string {
  return localDateString(new Date());
}

// First/last day of the month containing `monthStart` ('YYYY-MM-DD', day
// ignored), both inclusive and in 'YYYY-MM-DD' form.
export function monthRange(monthStart: string): { start: string; end: string } {
  const [year, month] = monthStart.split('-').map(Number);
  const start = `${year}-${pad2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { start, end };
}

export function shiftMonth(monthStart: string, delta: number): string {
  const [year, month] = monthStart.split('-').map(Number);
  const shifted = new Date(year, month - 1 + delta, 1);
  return localDateString(shifted);
}

export function formatMonthLabel(monthStart: string): string {
  const [year, month] = monthStart.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatWorkDate(workDate: string): string {
  const [year, month, day] = workDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDuration(timeIn: string, timeOut: string | null): string {
  if (!timeOut) return '—';
  const ms = new Date(timeOut).getTime() - new Date(timeIn).getTime();
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// <input type="datetime-local"> reads/writes local time with no timezone
// suffix — round-trip through Date's local getters/setters, not ISO strings.
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  return `${localDateString(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}
