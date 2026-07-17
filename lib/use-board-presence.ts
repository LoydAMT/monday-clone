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

    // Safety net: if the underlying socket drops and reconnects (a network
    // blip, laptop sleep/wake, wifi switch — all routine), the client
    // doesn't always reliably re-fire the SUBSCRIBED status above, which
    // would silently stop announcing this tab's presence to everyone else
    // until a manual refresh — "I don't always see if I'm on a board with
    // someone" is exactly what that looks like from the other side.
    // Re-announcing periodically bounds how long that can go unnoticed and
    // self-heals it without needing to precisely detect every reconnect;
    // track() on an already-current channel is a cheap no-op broadcast, not
    // a resubscribe.
    const heartbeat = setInterval(() => {
      channelRef.current?.track(payloadRef.current);
    }, 20000);

    return () => {
      clearInterval(heartbeat);
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

    // Supabase Realtime enforces a per-connection message-rate limit on
    // presence track() calls — broadcasting on every animation frame
    // (~60/s) while the mouse moves comfortably exceeds it, so the server
    // silently throttles/drops most of them. That's exactly what
    // intermittent, mostly-frozen remote cursors look like: it's not that
    // the feature doesn't work, it's that most updates never arrive.
    // ~10/s (matching what Figma/Google Docs-style multiplayer cursors
    // typically use) is still visually smooth and stays well under it.
    const THROTTLE_MS = 100;
    let lastSentAt = 0;
    let pendingCursor: { x: number; y: number } | null = null;
    let trailingTimeout: ReturnType<typeof setTimeout> | null = null;

    function broadcastCursor(cursor: { x: number; y: number } | null) {
      payloadRef.current = { ...payloadRef.current, cursor };
      channelRef.current?.track(payloadRef.current);
      lastSentAt = Date.now();
    }

    // Leading + trailing throttle: sends immediately if enough time has
    // passed, otherwise schedules one trailing send for the *latest*
    // position so a burst of movement always ends with an up-to-date
    // broadcast instead of silently dropping whatever arrived mid-throttle.
    function scheduleCursor(cursor: { x: number; y: number } | null) {
      pendingCursor = cursor;
      const elapsed = Date.now() - lastSentAt;
      if (elapsed >= THROTTLE_MS) {
        broadcastCursor(pendingCursor);
        return;
      }
      if (!trailingTimeout) {
        trailingTimeout = setTimeout(() => {
          trailingTimeout = null;
          broadcastCursor(pendingCursor);
        }, THROTTLE_MS - elapsed);
      }
    }

    function handleMove(e: MouseEvent) {
      const rect = container!.getBoundingClientRect();
      scheduleCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    function handleLeave() {
      scheduleCursor(null);
    }

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseleave', handleLeave);
    return () => {
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('mouseleave', handleLeave);
      if (trailingTimeout) clearTimeout(trailingTimeout);
    };
  }, [containerRef]);

  return others;
}
