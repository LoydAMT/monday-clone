'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/client';

export interface PresenceUser {
  user_id: string;
  email: string;
  full_name: string | null;
  view: string;
  cursor: { x: number; y: number } | null;
}

// Live "who's viewing this board" + cursor positions. Presence is a pure
// in-memory broadcast channel on top of Supabase Realtime — it never reads
// or writes a Postgres table, so it can't affect the database or need a
// migration. Cursor coordinates are relative to `containerRef`'s current
// on-screen box (via getBoundingClientRect on every move), not to the
// board's scrolled content — simplest robust option given each view
// (table/kanban/gantt) manages its own internal scrolling; it shows where
// someone's pointer is on your screen right now rather than tracking the
// exact cell they're over if your scroll position differs from theirs.
export function useBoardPresence(
  boardId: string,
  self: { user_id: string; email: string; full_name: string | null },
  view: string,
  containerRef: RefObject<HTMLElement | null>
): PresenceUser[] {
  const [others, setOthers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const payloadRef = useRef<PresenceUser>({ ...self, view, cursor: null });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:board:${boardId}`, {
      config: { presence: { key: self.user_id } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>();
        const list = Object.entries(state)
          .filter(([key]) => key !== self.user_id)
          .map(([, entries]) => entries[0])
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        setOthers(list);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track(payloadRef.current);
      });

    return () => {
      channelRef.current = null;
      setOthers([]);
      supabase.removeChannel(channel);
    };
    // Re-subscribe only when the board or the viewer identity changes —
    // `view`/cursor updates broadcast over the same connection via track()
    // in the effects below, without tearing the channel down.
  }, [boardId, self.user_id]);

  useEffect(() => {
    payloadRef.current = { ...payloadRef.current, ...self, view };
    channelRef.current?.track(payloadRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.user_id, self.email, self.full_name, view]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    function broadcastCursor(cursor: { x: number; y: number } | null) {
      payloadRef.current = { ...payloadRef.current, cursor };
      channelRef.current?.track(payloadRef.current);
    }
    function handleMove(e: MouseEvent) {
      if (frame) return;
      const rect = container!.getBoundingClientRect();
      frame = requestAnimationFrame(() => {
        frame = 0;
        broadcastCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      });
    }
    function handleLeave() {
      broadcastCursor(null);
    }

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseleave', handleLeave);
    return () => {
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('mouseleave', handleLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [containerRef]);

  return others;
}
