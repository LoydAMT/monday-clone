'use client';

import { useEffect, useState } from 'react';
import { Info, UserPlus } from 'lucide-react';
import type { Board, BoardAccess, MemberProfile, WorkspaceFeature, WorkspaceRole } from '@/types/database';
import { FEATURE_DESCRIPTIONS, FEATURE_LABELS, WORKSPACE_FEATURES } from '@/lib/permissions';
import {
  getBoardGrants,
  inviteMember,
  setBoardGrant,
  updateMemberAccess,
  updateMemberRole,
} from '@/lib/mutations';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { Modal } from './ui/Modal';

/**
 * One modal for both "invite someone with this access" and "change what an
 * existing member can reach" — `member: null` puts it in invite mode. Sharing
 * the form means an invite can't accidentally offer fewer controls than the
 * edit screen, which is the whole point of assigning access up front.
 */
export function MemberAccessModal({
  workspaceId,
  workspaceName,
  boards,
  member,
  onClose,
  onUpdated,
  onInvited,
}: {
  workspaceId: string;
  workspaceName: string;
  boards: Board[];
  member: MemberProfile | null;
  onClose: () => void;
  onUpdated: (member: MemberProfile) => void;
  onInvited: (member: MemberProfile) => void;
}) {
  const isInvite = member === null;

  const [email, setEmail] = useState('');
  // Invites are member/viewer only, matching what the popover offered before —
  // promote to owner afterwards if that's really the intent.
  const [role, setRole] = useState<WorkspaceRole>(member?.role ?? 'member');
  const [features, setFeatures] = useState<WorkspaceFeature[]>(member?.features ?? [...WORKSPACE_FEATURES]);
  const [boardAccess, setBoardAccess] = useState<BoardAccess>(member?.board_access ?? 'all');
  const [grants, setGrants] = useState<string[]>([]);
  const [initialGrants, setInitialGrants] = useState<string[]>([]);
  // Nothing to load in invite mode — the person has no grants yet.
  const [grantsLoaded, setGrantsLoaded] = useState(isInvite);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberUserId = member?.user_id;
  useEffect(() => {
    if (!memberUserId) return;
    let cancelled = false;
    getBoardGrants(workspaceId, memberUserId)
      .then((ids) => {
        if (cancelled) return;
        setGrants(ids);
        setInitialGrants(ids);
        setGrantsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setGrantsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, memberUserId]);

  // Owners bypass both knobs in RLS (can_access_board and can_view_module
  // both short-circuit on role = 'owner'), so showing the controls as live
  // for an owner would be a lie.
  const isOwnerSelected = role === 'owner';

  function toggleFeature(feature: WorkspaceFeature) {
    setFeatures((prev) => (prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]));
  }

  function toggleGrant(boardId: string) {
    setGrants((prev) => (prev.includes(boardId) ? prev.filter((id) => id !== boardId) : [...prev, boardId]));
  }

  async function handleSubmit() {
    setError(null);

    if (isInvite && !email.trim()) {
      setError('Enter the email of the person to invite');
      return;
    }

    setSaving(true);
    try {
      if (isInvite) {
        const invited = await inviteMember(
          workspaceId,
          workspaceName,
          email.trim(),
          role as Extract<WorkspaceRole, 'member' | 'viewer'>,
          { board_access: boardAccess, features, boardIds: grants }
        );
        onInvited(invited);
      } else {
        if (role !== member.role) await updateMemberRole(workspaceId, member.user_id, role);
        await updateMemberAccess(workspaceId, member.user_id, { board_access: boardAccess, features });

        // Only write the boards that actually changed, so a no-op save doesn't
        // churn the grant table.
        const added = grants.filter((id) => !initialGrants.includes(id));
        const removed = initialGrants.filter((id) => !grants.includes(id));
        await Promise.all([
          ...added.map((id) => setBoardGrant(id, member.user_id, true)),
          ...removed.map((id) => setBoardGrant(id, member.user_id, false)),
        ]);

        setInitialGrants(grants);
        onUpdated({ ...member, role, board_access: boardAccess, features });
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save access');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-lg">
      <div className="max-h-[85vh] overflow-y-auto p-5">
        {isInvite ? (
          <>
            <h2 className="mb-4 flex items-center gap-2 pr-8 text-base font-semibold text-gray-900">
              <UserPlus size={16} /> Invite to {workspaceName}
            </h2>
            <label className="mb-5 block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Email address</span>
              <input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="name@company.com"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
              />
              <span className="mt-1 block text-[11px] text-gray-400">
                They need an account already — invites attach access to an existing sign-up.
              </span>
            </label>
          </>
        ) : (
          <div className="mb-4 flex items-center gap-2.5 pr-8">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: avatarColor(member.user_id) }}
            >
              {initials(member)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900">{displayName(member)}</h2>
              <p className="truncate text-xs text-gray-400">{member.email}</p>
            </div>
          </div>
        )}

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Role</h3>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceRole)}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-[#0073ea]"
          >
            {!isInvite && <option value="owner">Owner — full access, can add boards and manage people</option>}
            <option value="member">Member — can edit what they can see</option>
            <option value="viewer">Viewer — read-only</option>
          </select>
        </section>

        {isOwnerSelected && (
          <p className="mb-5 flex items-start gap-1.5 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-[#0073ea]">
            <Info size={13} className="mt-0.5 shrink-0" />
            Owners always have every board and every module. The limits below apply once the role is Member or Viewer.
          </p>
        )}

        <section className={`mb-5 ${isOwnerSelected ? 'opacity-50' : ''}`}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Modules</h3>
          <div className="space-y-1.5">
            {WORKSPACE_FEATURES.map((feature) => (
              <label key={feature} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-gray-50">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={isOwnerSelected}
                  checked={isOwnerSelected || features.includes(feature)}
                  onChange={() => toggleFeature(feature)}
                />
                <span className="min-w-0">
                  <span className="block text-sm text-gray-800">{FEATURE_LABELS[feature]}</span>
                  <span className="block text-[11px] text-gray-400">{FEATURE_DESCRIPTIONS[feature]}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className={isOwnerSelected ? 'opacity-50' : ''}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Board access</h3>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
              <input
                type="radio"
                name="board-access"
                disabled={isOwnerSelected}
                checked={isOwnerSelected || boardAccess === 'all'}
                onChange={() => setBoardAccess('all')}
              />
              <span className="text-sm text-gray-800">All boards, including ones added later</span>
            </label>
            <label className="flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
              <input
                type="radio"
                name="board-access"
                disabled={isOwnerSelected}
                checked={!isOwnerSelected && boardAccess === 'selected'}
                onChange={() => setBoardAccess('selected')}
              />
              <span className="text-sm text-gray-800">Only the boards I pick</span>
            </label>
          </div>

          {!isOwnerSelected && boardAccess === 'selected' && (
            <div className="mt-2 rounded border border-gray-200 p-2">
              {!grantsLoaded ? (
                <p className="py-2 text-center text-xs text-gray-400">Loading boards…</p>
              ) : boards.length === 0 ? (
                <p className="py-2 text-center text-xs text-gray-400">This workspace has no boards yet.</p>
              ) : (
                <div className="max-h-48 space-y-0.5 overflow-y-auto">
                  {boards.map((board) => (
                    <label key={board.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
                      <input type="checkbox" checked={grants.includes(board.id)} onChange={() => toggleGrant(board.id)} />
                      <span className="truncate text-sm text-gray-700">{board.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {grantsLoaded && grants.length === 0 && boards.length > 0 && (
                <p className="mt-1 border-t border-gray-100 pt-1 text-[11px] text-gray-400">
                  No boards picked — they&apos;ll see no boards at all.
                </p>
              )}
            </div>
          )}
        </section>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
          >
            {saving ? (isInvite ? 'Inviting…' : 'Saving…') : isInvite ? 'Send invite' : 'Save access'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
