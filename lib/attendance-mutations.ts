import { createClient } from '@/utils/supabase/client';
import type { AttendanceRecord } from '@/types/database';
import { localDateString } from '@/lib/attendance-time';

const supabase = createClient();

// The 2-hour / 8-hour bounds mirrored here are also enforced by check
// constraints on attendance_records — this is just a friendlier message than
// the raw Postgres error for the common case of typing a wildly wrong time.
function friendlyError(e: unknown, fallback: string): Error {
  const message = e instanceof Error ? e.message : '';
  if (message.includes('time_in_within_2h') || message.includes('time_out_within_2h')) {
    return new Error('Time can only be adjusted within 2 hours of the original clock time.');
  }
  if (message.includes('manual_entry_max_8h')) {
    return new Error('A fully manual entry (no real punch) can be at most 8 hours.');
  }
  if (message.includes('time_out_after_time_in')) {
    return new Error('Clock-out time must be after the clock-in time.');
  }
  return new Error(fallback);
}

export async function clockIn(workspaceId: string): Promise<AttendanceRecord> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const now = new Date();
  const { data, error } = await supabase
    .from('attendance_records')
    .insert({
      workspace_id: workspaceId,
      user_id: auth.user.id,
      work_date: localDateString(now),
      time_in: now.toISOString(),
      time_in_original: now.toISOString(),
    })
    .select()
    .single();
  if (error || !data) throw friendlyError(error, 'Failed to clock in');
  return data;
}

export async function clockOut(recordId: string): Promise<AttendanceRecord> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('attendance_records')
    .update({ time_out: now, time_out_original: now })
    .eq('id', recordId)
    .select()
    .single();
  if (error || !data) throw friendlyError(error, 'Failed to clock out');
  return data;
}

export async function updateTimeIn(recordId: string, isoTime: string): Promise<AttendanceRecord> {
  const { data, error } = await supabase
    .from('attendance_records')
    .update({ time_in: isoTime, time_in_manual: true })
    .eq('id', recordId)
    .select()
    .single();
  if (error || !data) throw friendlyError(error, 'Failed to update clock-in time');
  return data;
}

export async function updateTimeOut(recordId: string, isoTime: string): Promise<AttendanceRecord> {
  const { data, error } = await supabase
    .from('attendance_records')
    .update({ time_out: isoTime, time_out_manual: true })
    .eq('id', recordId)
    .select()
    .single();
  if (error || !data) throw friendlyError(error, 'Failed to update clock-out time');
  return data;
}

export async function getAttendanceRecordsForMonth(
  workspaceId: string,
  monthStart: string,
  monthEnd: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('work_date', monthStart)
    .lte('work_date', monthEnd)
    .order('work_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
