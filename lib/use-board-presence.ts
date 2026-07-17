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

type PresenceMeta = Omit<PresenceUser, 'cursor'>;
type CursorPayload = { user_id: string; cursor: { x: number; y: number } | null };

// Live "who's viewing this board" + cursor positions, over two different
// Supabase Realtime primitives on the same channel — deliberately, not for
// simplicity. Presence's track() is for join/leave-style state: verified
// (via a standalone script against this project) that a fresh track() call
// updating an *already-joined* member's metadata does not reliably re-fire
// `sync` for other subscribers — so cursor position, which is nothing but
// rapid metadata updates on an already-joined member, would silently never
// arrive if it rode along on presence the way "who's viewing" does. Presence
// itself never reads/writes a Postgres table, so none of this can affect the
// database or need a migration.
//
// Broadcast, verified separately, propagates every message reliably and in
// order — it's what cursor position actually uses. Cursor coordinates are
// relative to `containerRef`'s current on-screen box (via getBoundingClientRect
// on every move), not to the board's scrolled content — simplest robust
// option given each view (table/kanban/gantt) manages its own internal
// scrolling; it shows where someone's pointer is on your screen right now
// rather than tracking the exact cell they're over if your scroll position
// differs from theirs.
export function useBoardPresence(
  boardId: string,
  self: { user_id: string; email: string; full_name: string | null },
  view: string,
  containerRef: RefObject<HTMLElement | null>
): PresenceUser[] {
  const [others, setOthers] = useState<PresenceMeta[]>([]);
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number } | null>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const metaRef = useRef<PresenceMeta>({ ...self, view });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:board:${boardId}`, {
      config: { presence: { key: self.user_id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const list = Object.entries(state)
          .filter(([key]) => key !== self.user_id)
          .map(([, entries]) => entries[0])
          .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
        setOthers(list);
        // Drop cursors for anyone no longer present, so a departed user's
        // last position can't linger as a ghost cursor.
        const presentIds = new Set(list.map((u) => u.user_id));
        setCursors((prev) => {
          const next: typeof prev = {};
          for (const [id, cursor] of Object.entries(prev)) {
            if (presentIds.has(id)) next[id] = cursor;
          }
          return next;
        });
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }: { payload: CursorPayload }) => {
        setCursors((prev) => ({ ...prev, [payload.user_id]: payload.cursor }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') channel.track(metaRef.current);
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
      channelRef.current?.track(metaRef.current);
    }, 20000);

    return () => {
      clearInterval(heartbeat);
      channelRef.current = null;
      setOthers([]);
      setCursors({});
      supabase.removeChannel(channel);
    };
    // Re-subscribe only when the board or the viewer identity changes — view
    // updates track() over the same connection, and cursor moves broadcast
    // over it, in the effects below, without tearing the channel down.
  }, [boardId, self.user_id]);

  useEffect(() => {
    metaRef.current = { ...metaRef.current, ...self, view };
    channelRef.current?.track(metaRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self.user_id, self.email, self.full_name, view]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Broadcast (unlike presence track(), see above) does reliably deliver
    // every message, but still worth throttling — 60 messages/s (one per
    // animation frame) is unnecessary for something eyes perceive as smooth
    // at far less, and needlessly increases the chance of hitting the
    // project's realtime rate limit. ~10/s (matching what Figma/Google
    // Docs-style multiplayer cursors typically use) stays well under it.
    const THROTTLE_MS = 100;
    let lastSentAt = 0;
    let pendingCursor: { x: number; y: number } | null = null;
    let trailingTimeout: ReturnType<typeof setTimeout> | null = null;

    function broadcastCursor(cursor: { x: number; y: number } | null) {
      // metaRef, not the `self` param directly — this effect's deps are
      // just [containerRef] (it doesn't need to re-bind the DOM listeners
      // over a user_id that never changes mid-session), so metaRef is what
      // stays current rather than this closure's own captured `self`.
      const payload: CursorPayload = { user_id: metaRef.current.user_id, cursor };
      channelRef.current?.send({ type: 'broadcast', event: 'cursor', payload });
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

  return others.map((u) => ({ ...u, cursor: cursors[u.user_id] ?? null }));
}
