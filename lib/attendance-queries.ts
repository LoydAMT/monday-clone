import { createClient } from '@/utils/supabase/server';
import { stitchMemberProfiles } from '@/lib/queries';
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

// Bounded to [monthStart, monthEnd] (inclusive, 'YYYY-MM-DD') rather than the
// whole table — RLS already narrows rows to "mine" for members / "everyone's"
// for owners, but a punch-clock log still grows one row per person per day
// forever, so the page always asks for one month at a time.
export async function getAttendanceRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
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
