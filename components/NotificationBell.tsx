'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { Notification } from '@/types/database';
import { getNotifications, markAllRead } from '@/lib/notifications';
import { createClient } from '@/utils/supabase/client';
import { stripMentionTokens } from '@/lib/mentions';

function describeNotification(n: Notification): string {
  const payload = n.payload as Record<string, string>;
  switch (n.type) {
    case 'invited_to_workspace':
      return `You were added to "${payload.workspace_name}"`;
    case 'assigned_to_item':
      return `You were assigned to "${payload.item_title}"`;
    case 'comment_added':
      return `New comment: "${stripMentionTokens(payload.body ?? '').slice(0, 60)}"`;
    case 'mentioned_in_comment':
      return `You were mentioned: "${stripMentionTokens(payload.body ?? '').slice(0, 60)}"`;
    case 'automation_notify':
      return `Automation: "${payload.item_title}" ${payload.column_name} is now "${payload.status_value}"`;
    default:
      return n.type;
  }
}

function notificationHref(n: Notification): string | null {
  const payload = n.payload as Record<string, string>;
  if (payload.board_id) {
    return payload.item_id ? `/board/${payload.board_id}?item=${payload.item_id}` : `/board/${payload.board_id}`;
  }
  return null;
}

export function NotificationBell({ currentUserId }: { currentUserId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getNotifications().then(setNotifications);

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
        (payload) => setNotifications((prev) => [payload.new as Notification, ...prev])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unread = notifications.filter((n) => !n.read_at);

  function handleToggle() {
    setOpen((o) => !o);
    if (!open && unread.length > 0) {
      const ids = unread.map((n) => n.id);
      markAllRead(ids);
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-200/60"
        title="Notifications"
      >
        <Bell size={15} />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#e2445c] px-0.5 text-[9px] font-semibold text-white">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-80 w-72 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {notifications.length === 0 ? (
            <p className="px-2 py-3 text-xs text-gray-400">No notifications yet.</p>
          ) : (
            notifications.map((n) => {
              const href = notificationHref(n);
              const content = (
                <>
                  <p className="text-xs text-gray-800">{describeNotification(n)}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
                </>
              );
              return href ? (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="block rounded px-2 py-1.5 hover:bg-gray-50"
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id} className="rounded px-2 py-1.5">
                  {content}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
