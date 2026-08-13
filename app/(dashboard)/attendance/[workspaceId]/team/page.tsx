import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getAttendanceForWorkDate, getAttendanceWorkspace, getAttendanceWorkspaceMembers } from '@/lib/attendance-queries';
import { todayLocalDateString } from '@/lib/attendance-time';
import { AttendanceTeamView } from '@/components/AttendanceTeamView';

export default async function AttendanceTeamPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  const supabase = await createClient();
  const [{ data: { session } }, workspace, members] = await Promise.all([
    supabase.auth.getSession(),
    getAttendanceWorkspace(supabase, workspaceId),
    getAttendanceWorkspaceMembers(supabase, workspaceId),
  ]);
  if (!session) redirect('/login');
  if (!workspace) notFound();

  // No owner-only redirect here, matching the mobile screen — RLS already
  // narrows attendance_records to "mine only" for non-owners, so visiting
  // directly just shows a mostly-empty roster instead of leaking data.
  const workDate = todayLocalDateString();
  const records = await getAttendanceForWorkDate(supabase, workspaceId, workDate);

  return (
    <AttendanceTeamView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      members={members}
      initialWorkDate={workDate}
      initialRecords={records}
    />
  );
}
