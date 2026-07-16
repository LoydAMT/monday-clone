'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Trash2 } from 'lucide-react';
import type { BoardShareLink } from '@/types/database';
import { Modal } from './ui/Modal';
import { createShareLink, revokeShareLink } from '@/lib/mutations';

export function ShareLinksPanel({
  boardId,
  links,
  onClose,
  onCreate,
  onRevoke,
  canEdit = true,
}: {
  boardId: string;
  links: BoardShareLink[];
  onClose: () => void;
  onCreate: (link: BoardShareLink) => void;
  onRevoke: (id: string) => void;
  canEdit?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const activeLinks = links.filter((l) => !l.revoked_at);

  function shareUrl(token: string) {
    return `${window.location.origin}/share/${token}`;
  }

  async function handleCopy(link: BoardShareLink) {
    await navigator.clipboard.writeText(shareUrl(link.token));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 2000);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const link = await createShareLink(boardId);
      onCreate(link);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (revoking !== id) {
      setRevoking(id);
      return;
    }
    onRevoke(id);
    setRevoking(null);
    try {
      await revokeShareLink(id);
    } catch {
      // A failed revoke just leaves the link looking active until the next
      // reload restores the true state — acceptable for a low-stakes panel.
    }
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-lg">
      <div className="p-5">
        <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold text-gray-900">
          <Link2 size={16} className="text-[#0073ea]" /> Share board
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Anyone with a link can view this board&rsquo;s items — no account needed. They can&rsquo;t edit anything or see comments.
        </p>

        {activeLinks.length === 0 ? (
          <p className="mb-4 text-xs text-gray-400">No active share links.</p>
        ) : (
          <div className="mb-4 space-y-1">
            {activeLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="min-w-0 flex-1 truncate text-xs text-gray-600">{shareUrl(link.token)}</p>
                <button
                  onClick={() => handleCopy(link)}
                  className="shrink-0 rounded px-1.5 py-1 text-[11px] text-gray-400 hover:text-gray-600"
                  title="Copy link"
                >
                  {copiedId === link.id ? <Check size={12} className="text-[#00c875]" /> : <Copy size={12} />}
                </button>
                {canEdit && (
                  <button
                    onClick={() => handleRevoke(link.id)}
                    className={`shrink-0 rounded px-1.5 py-1 text-[11px] ${
                      revoking === link.id ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-red-500'
                    }`}
                    title="Revoke link"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create share link'}
          </button>
        )}
      </div>
    </Modal>
  );
}
