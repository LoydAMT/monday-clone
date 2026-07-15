'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ActivityLog, Group } from '@/types/database';
import { addComment, deleteComment, getItemThread, type ThreadEntry } from '@/lib/item-thread';

function describeActivity(activity: ActivityLog, groups: Group[]): string {
  const meta = activity.meta as Record<string, string>;
  switch (activity.action) {
    case 'item_created':
      return 'created this item';
    case 'title_changed':
      return `renamed this item from "${meta.from}" to "${meta.to}"`;
    case 'status_changed':
      return `changed ${meta.column_name} from "${meta.from || 'blank'}" to "${meta.to || 'blank'}"`;
    case 'moved_group': {
      const from = groups.find((g) => g.id === meta.from_group_id)?.name ?? 'another group';
      const to = groups.find((g) => g.id === meta.to_group_id)?.name ?? 'another group';
      return `moved this item from "${from}" to "${to}"`;
    }
    case 'subitem_added':
      return `added subitem "${meta.title}"`;
    case 'subitem_removed':
      return `removed subitem "${meta.title}"`;
    case 'attachment_added':
      return `attached "${meta.file_name}"`;
    case 'attachment_removed':
      return `removed attachment "${meta.file_name}"`;
    default:
      return activity.action;
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ItemThread({
  itemId,
  groups,
  notifyUserIds = [],
  workspaceId,
  boardId,
  onUndoableAction,
}: {
  itemId: string;
  groups: Group[];
  notifyUserIds?: string[];
  workspaceId?: string;
  boardId?: string;
  onUndoableAction?: (message: string, onUndo: () => void) => void;
}) {
  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    let cancelled = false;
    getItemThread(itemId).then((data) => {
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  function handlePost() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    addComment(itemId, body, notifyUserIds, workspaceId, boardId).then((comment) =>
      setEntries((prev) => [...prev, { kind: 'comment', created_at: comment.created_at, comment }])
    );
  }

  function handleDeleteComment(commentId: string) {
    const entry = entries.find((e) => e.kind === 'comment' && e.comment.id === commentId);
    if (!entry || entry.kind !== 'comment') return;
    const comment = entry.comment;

    setEntries((prev) => prev.filter((e) => !(e.kind === 'comment' && e.comment.id === commentId)));

    const timeoutId = setTimeout(() => {
      deleteComment(commentId);
      pendingDeletes.current.delete(commentId);
    }, 6000);
    pendingDeletes.current.set(commentId, timeoutId);

    onUndoableAction?.('Comment deleted', () => {
      const pending = pendingDeletes.current.get(commentId);
      if (pending) {
        clearTimeout(pending);
        pendingDeletes.current.delete(commentId);
      }
      setEntries((prev) =>
        prev.some((e) => e.kind === 'comment' && e.comment.id === commentId)
          ? prev
          : [...prev, { kind: 'comment', created_at: comment.created_at, comment }]
      );
    });
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handlePost();
            }
          }}
          placeholder="Write an update…"
          rows={2}
          className="flex-1 resize-none rounded border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
        />
        <button
          onClick={handlePost}
          className="self-end rounded bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
        >
          Post
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading updates…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400">No updates yet.</p>
      ) : (
        <div className="space-y-2">
          {entries
            .slice()
            .reverse()
            .map((entry) =>
              entry.kind === 'comment' ? (
                <div
                  key={entry.comment.id}
                  className="group flex items-start justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-gray-800">{entry.comment.body}</p>
                    <p className="mt-1 text-[10px] text-gray-400">{formatTime(entry.created_at)}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteComment(entry.comment.id)}
                    className="shrink-0 text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : (
                <p key={entry.activity.id} className="text-[11px] text-gray-400">
                  {describeActivity(entry.activity, groups)} · {formatTime(entry.created_at)}
                </p>
              )
            )}
        </div>
      )}
    </div>
  );
}
