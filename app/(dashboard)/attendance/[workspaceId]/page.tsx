import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getAttendanceWorkspace, getAttendanceWorkspaceMembers, getMyAttendanceHistory, getTodayAttendance } from '@/lib/attendance-queries';
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

  // Needs the session's user id resolved above, so it can't join the batch.
  const [today, history] = await Promise.all([
    getTodayAttendance(supabase, workspaceId, session.user.id),
    getMyAttendanceHistory(supabase, workspaceId, session.user.id),
  ]);

  return (
    <AttendanceView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      members={members}
      currentUserId={session.user.id}
      initialToday={today}
      initialHistory={history}
    />
  );
}
