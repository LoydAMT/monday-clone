import { createClient } from '@/utils/supabase/server';
import { stitchMemberProfiles } from '@/lib/queries';
import { localDateString } from '@/lib/attendance-time';
import type { AttendanceRecord, MemberProfile, Workspace } from '@/types/database';

export async function getAttendanceWorkspace(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<Workspace | null> {
  const { data } = await supabase.from('workspaces').select('*').eq('id', workspaceId).single();
  return data ?? null;
}

export async function getAttendanceWorkspaceMembers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string
): Promise<MemberProfile[]> {
  const { data: memberRows, error } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role')
    .eq('workspace_id', workspaceId);
  if (error) throw error;
  if (!memberRows || memberRows.length === 0) return [];
  return stitchMemberProfiles(supabase, memberRows);
}

// Mirrors mobile's getTodayAttendance/getMyAttendanceHistory in
// src/lib/attendance.ts exactly (same table, same "today" and "last 14"
// definitions) so the server-rendered initial state matches what the client
// mutations below produce.
export async function getTodayAttendance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string
): Promise<AttendanceRecord | null> {
  const workDate = localDateString(new Date());
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('work_date', workDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyAttendanceHistory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  userId: string,
  limit = 14
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .order('work_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Owner-only "Team" view's initial load — one day, every member's record
// (or lack of one). Mirrors mobile's getWorkspaceAttendanceForDate, minus
// the member fetch since the page already has `members` from the call above.
export async function getAttendanceForWorkDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  workDate: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('work_date', workDate);
  if (error) throw error;
  return data ?? [];
}
