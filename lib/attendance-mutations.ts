import { createClient } from '@/utils/supabase/client';
import type { AttendanceRecord } from '@/types/database';
import { localDateString } from '@/lib/attendance-time';

const supabase = createClient();

// Mirrors instrubyte-crm-mobile's src/lib/attendance.ts — same validation,
// same field semantics — so a record edited here behaves identically if
// later viewed/edited from the mobile app, and vice versa.
export const MAX_ADJUSTMENT_HOURS = 2;
export const MAX_MANUAL_SHIFT_HOURS = 8;

export async function timeIn(
  workspaceId: string,
  userId: string,
  time: Date,
  manual: boolean
): Promise<AttendanceRecord> {
  const workDate = localDateString(new Date());
  const iso = time.toISOString();
  const { data, error } = await supabase
    .from('attendance_records')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      work_date: workDate,
      time_in: iso,
      time_in_original: iso,
      time_in_manual: manual,
    })
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function timeOut(record: AttendanceRecord, time: Date, manual: boolean): Promise<AttendanceRecord> {
  if (time.getTime() <= new Date(record.time_in).getTime()) {
    throw new Error('Time out must be after time in.');
  }
  if (record.time_in_manual && manual) {
    const hours = (time.getTime() - new Date(record.time_in).getTime()) / 3_600_000;
    if (hours > MAX_MANUAL_SHIFT_HOURS) {
      throw new Error(`A fully manual entry can't be longer than ${MAX_MANUAL_SHIFT_HOURS} hours.`);
    }
  }

  const iso = time.toISOString();
  const { data, error } = await supabase
    .from('attendance_records')
    .update({ time_out: iso, time_out_original: iso, time_out_manual: manual })
    .eq('id', record.id)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

function assertWithinAdjustmentWindow(original: string, next: Date) {
  const hours = Math.abs(next.getTime() - new Date(original).getTime()) / 3_600_000;
  if (hours > MAX_ADJUSTMENT_HOURS) {
    throw new Error(`You can only adjust this by up to ${MAX_ADJUSTMENT_HOURS} hours from the original time.`);
  }
}

export async function adjustTimeIn(record: AttendanceRecord, time: Date): Promise<AttendanceRecord> {
  assertWithinAdjustmentWindow(record.time_in_original, time);
  if (record.time_out && time.getTime() >= new Date(record.time_out).getTime()) {
    throw new Error('Time in must be before time out.');
  }
  const { data, error } = await supabase
    .from('attendance_records')
    .update({ time_in: time.toISOString() })
    .eq('id', record.id)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

export async function adjustTimeOut(record: AttendanceRecord, time: Date): Promise<AttendanceRecord> {
  if (!record.time_out_original) throw new Error('No time out recorded yet.');
  assertWithinAdjustmentWindow(record.time_out_original, time);
  if (time.getTime() <= new Date(record.time_in).getTime()) {
    throw new Error('Time out must be after time in.');
  }
  const { data, error } = await supabase
    .from('attendance_records')
    .update({ time_out: time.toISOString() })
    .eq('id', record.id)
    .select()
    .single();
  if (error || !data) throw error;
  return data;
}

// Team view's date navigation (client-side refetch as the owner picks a
// different day) — the initial day's data comes from
// getAttendanceForWorkDate on the server instead.
export async function getAttendanceRecordsForDate(workspaceId: string, workDate: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('work_date', workDate);
  if (error) throw error;
  return data ?? [];
}

// Backs the Excel export — every workspace member's records across a date
// range (inclusive). RLS already restricts this to "everyone's" only for
// owners, so a non-owner calling it just gets their own rows back.
export async function getAttendanceRecordsForRange(
  workspaceId: string,
  startDate: string,
  endDate: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('work_date', startDate)
    .lte('work_date', endDate)
    .order('work_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
