import { createClient } from '@/utils/supabase/client';
import type { Notification } from '@/types/database';

const supabase = createClient();

export async function createNotification(
  workspaceId: string,
  userId: string,
  type: string,
  payload: Record<string, unknown> = {}
) {
  await supabase.from('notifications').insert({ workspace_id: workspaceId, user_id: userId, type, payload });
}

export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function markAllRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids);
  if (error) throw error;
}
