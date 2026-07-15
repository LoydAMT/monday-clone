import { createClient } from '@/utils/supabase/client';
import type { ActivityLog, Comment, Item } from '@/types/database';
import { createNotification } from '@/lib/notifications';

const supabase = createClient();

export type ThreadEntry =
  | { kind: 'comment'; created_at: string; comment: Comment }
  | { kind: 'activity'; created_at: string; activity: ActivityLog };

export async function getItemThread(itemId: string): Promise<ThreadEntry[]> {
  const [{ data: comments, error: commentsError }, { data: activity, error: activityError }] = await Promise.all([
    supabase.from('comments').select('*').eq('item_id', itemId),
    supabase.from('activity_log').select('*').eq('item_id', itemId),
  ]);
  if (commentsError) throw commentsError;
  if (activityError) throw activityError;

  const entries: ThreadEntry[] = [
    ...(comments ?? []).map((comment): ThreadEntry => ({ kind: 'comment', created_at: comment.created_at, comment })),
    ...(activity ?? []).map((activity): ThreadEntry => ({ kind: 'activity', created_at: activity.created_at, activity })),
  ];

  return entries.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function addComment(
  itemId: string,
  body: string,
  notifyUserIds: string[] = [],
  workspaceId?: string,
  boardId?: string,
  mentionedUserIds: string[] = []
): Promise<Comment> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('comments')
    .insert({ item_id: itemId, user_id: auth.user.id, body })
    .select()
    .single();
  if (error || !data) throw error;

  if (workspaceId) {
    for (const userId of notifyUserIds) {
      if (userId === auth.user.id) continue;
      createNotification(workspaceId, userId, 'comment_added', { item_id: itemId, board_id: boardId, body });
    }
    // Mentioned people get their own notification type even if they're also
    // assigned (notifyUserIds) — don't double-notify the same person twice.
    for (const userId of mentionedUserIds) {
      if (userId === auth.user.id || notifyUserIds.includes(userId)) continue;
      createNotification(workspaceId, userId, 'mentioned_in_comment', { item_id: itemId, board_id: boardId, body });
    }
  }

  return data;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

export async function getSubitems(parentItemId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('parent_item_id', parentItemId)
    .is('deleted_at', null)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
