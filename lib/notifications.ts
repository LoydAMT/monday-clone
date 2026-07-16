import { createClient } from '@/utils/supabase/client';
import type { Notification } from '@/types/database';

const supabase = createClient();

const EMAIL_NOTIFICATION_TYPES = new Set(['assigned_to_item', 'mentioned_in_comment']);

export async function createNotification(
  workspaceId: string,
  userId: string,
  type: string,
  payload: Record<string, unknown> = {}
) {
  await supabase.from('notifications').insert({ workspace_id: workspaceId, user_id: userId, type, payload });

  // Best-effort — a slow/failed email should never block the mutation that
  // triggered it. Only the high-signal types (see EMAIL_NOTIFICATION_TYPES)
  // get an email on top of the in-app bell; the route itself also no-ops
  // until RESEND_API_KEY is configured.
  if (EMAIL_NOTIFICATION_TYPES.has(type)) {
    fetch('/api/notify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, type, payload }),
    }).catch(() => {});
  }
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
