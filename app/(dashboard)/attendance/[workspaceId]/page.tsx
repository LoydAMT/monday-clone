import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getAttendanceRecords, getAttendanceWorkspace, getAttendanceWorkspaceMembers } from '@/lib/attendance-queries';
import { monthRange, todayLocalDateString } from '@/lib/attendance-time';
import { AttendanceView } from '@/components/AttendanceView';

export default async function AttendancePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  const supabase = await createClient();
  const [{ data: { session } }, workspace, members] = await Promise.all([
    supabase.auth.getSession(),
    getAttendanceWorkspace(supabase, workspaceId),
    getAttendanceWorkspaceMembers(supabase, workspaceId),
  ]);
  if (!session) redirect('/login');
  if (!workspace) notFound();

  const { start, end } = monthRange(todayLocalDateString());
  const records = await getAttendanceRecords(supabase, workspaceId, start, end);

  return (
    <AttendanceView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      members={members}
      currentUserId={session.user.id}
      initialRecords={records}
      initialMonth={start}
    />
  );
}
