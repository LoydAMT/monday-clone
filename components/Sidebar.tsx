'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Clock, Copy, Handshake, LayoutGrid, Menu, MoreHorizontal, Package, Plus, LogOut, SlidersHorizontal, Trash2, UserPlus, X } from 'lucide-react';
import type { MemberProfile } from '@/types/database';
import type { WorkspaceWithBoards } from '@/lib/queries';
import {
  createNewBoard,
  createBoardFromTemplate,
  deleteBoard,
  duplicateBoard,
  removeMember,
} from '@/lib/mutations';
import { BOARD_TEMPLATES } from '@/lib/templates';
import { WORKSPACE_FEATURES, hasFeature, roleLabel } from '@/lib/permissions';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { MemberAccessModal } from './MemberAccessModal';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { NotificationBell } from './NotificationBell';
import { signOut } from '@/app/login/actions';

export function Sidebar({
  workspaces,
  currentUserId,
}: {
  workspaces: WorkspaceWithBoards[];
  currentUserId: string;
}) {
  const router = useRouter();
  const params = useParams<{ boardId?: string }>();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  function goToBoard(board: { id: string }) {
    setMobileOpen(false);
    startTransition(() => {
      router.push(`/board/${board.id}`);
      router.refresh();
    });
  }

  async function handleCreateBlankBoard(workspaceId: string, boardCount: number) {
    const board = await createNewBoard(workspaceId, boardCount);
    goToBoard(board);
  }

  async function handleCreateFromTemplate(workspaceId: string, boardCount: number, templateId: string) {
    const template = BOARD_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    const board = await createBoardFromTemplate(workspaceId, boardCount, template);
    goToBoard(board);
  }

  async function handleDuplicateBoard(boardId: string) {
    const board = await duplicateBoard(boardId);
    goToBoard(board);
  }

  async function handleDeleteBoard(boardId: string) {
    const wasActive = params?.boardId === boardId;
    await deleteBoard(boardId);
    if (wasActive) {
      startTransition(() => {
        router.push('/');
        router.refresh();
      });
    } else {
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        title="Open menu"
        className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-sm md:hidden"
      >
        <Menu size={18} />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        // The mobile drawer styles (fixed/z-50/translate) are all scoped
        // under max-md: so they only ever apply below the md breakpoint —
        // at md+ none of them match at all, rather than relying on a md:
        // override to cancel them back out. That "apply then walk back"
        // approach previously left position:fixed + an active translateX
        // transform in effect on desktop in some cases (a transform other
        // than none creates a stacking context, which was trapping
        // NotificationBell's dropdown and letting the table's sticky group
        // headers paint over the whole sidebar) — scoping to max-md: makes
        // that class of bug structurally impossible instead of walking it back.
        className={`flex h-screen w-64 flex-col border-r border-gray-200 bg-[#f6f7fb] transition-transform duration-200 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 ${
          mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0073ea] text-white">
            <LayoutGrid size={16} />
          </div>
          <span className="flex-1 truncate text-sm font-semibold text-gray-900">work-boards</span>
          <NotificationBell currentUserId={currentUserId} />
          <button onClick={() => setMobileOpen(false)} title="Close menu" className="text-gray-400 hover:text-gray-600 md:hidden">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {workspaces.map((workspace) => {
            const isCollapsed = collapsed[workspace.id];
            const myMembership = workspace.members.find((m) => m.user_id === currentUserId);
            const canEdit = myMembership?.role !== 'viewer';
            const isWorkspaceOwner = myMembership?.role === 'owner';
            // Mirrors the RLS feature gate so a restricted member isn't shown
            // links that would only 404 — the database is what enforces it.
            const showBoards = hasFeature(myMembership, 'boards');
            const showInventory = hasFeature(myMembership, 'inventory');
            const showAttendance = hasFeature(myMembership, 'attendance');
            const showSales = hasFeature(myMembership, 'sales');
            return (
              <div key={workspace.id} className="mb-3">
                <div className="flex items-center gap-1 pr-1">
                  <button
                    onClick={() => setCollapsed((c) => ({ ...c, [workspace.id]: !c[workspace.id] }))}
                    className="flex flex-1 items-center gap-1 rounded px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-200/60"
                  >
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    <span className="truncate">{workspace.name}</span>
                  </button>
                  <MembersPopover workspace={workspace} currentUserId={currentUserId} />
                </div>

                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5 pl-3">
                    {showInventory && (
                      <Link
                        href={`/inventory/${workspace.id}`}
                        onClick={() => setMobileOpen(false)}
                        className={`mb-0.5 flex items-center gap-1.5 rounded px-2 py-1.5 text-sm ${
                          pathname === `/inventory/${workspace.id}`
                            ? 'bg-[#e6f1fd] font-medium text-[#0073ea]'
                            : 'text-gray-700 hover:bg-gray-200/60'
                        }`}
                      >
                        <Package size={14} />
                        Inventory
                      </Link>
                    )}

                    {showAttendance && (
                      <Link
                        href={`/attendance/${workspace.id}`}
                        onClick={() => setMobileOpen(false)}
                        className={`mb-0.5 flex items-center gap-1.5 rounded px-2 py-1.5 text-sm ${
                          pathname === `/attendance/${workspace.id}`
                            ? 'bg-[#e6f1fd] font-medium text-[#0073ea]'
                            : 'text-gray-700 hover:bg-gray-200/60'
                        }`}
                      >
                        <Clock size={14} />
                        Attendance
                      </Link>
                    )}

                    {showSales && (
                      <Link
                        href={`/sales/${workspace.id}`}
                        onClick={() => setMobileOpen(false)}
                        // startsWith, unlike the exact matches above — the sales
                        // module has nested company routes that should keep the
                        // section highlighted.
                        className={`mb-0.5 flex items-center gap-1.5 rounded px-2 py-1.5 text-sm ${
                          pathname.startsWith(`/sales/${workspace.id}`)
                            ? 'bg-[#e6f1fd] font-medium text-[#0073ea]'
                            : 'text-gray-700 hover:bg-gray-200/60'
                        }`}
                      >
                        <Handshake size={14} />
                        Sales
                      </Link>
                    )}

                    {showBoards &&
                      workspace.boards.map((board) => {
                        const active = params?.boardId === board.id;
                        return (
                          <div key={board.id} className="group flex items-center">
                            <Link
                              href={`/board/${board.id}`}
                              onClick={() => setMobileOpen(false)}
                              className={`block flex-1 truncate rounded px-2 py-1.5 text-sm ${
                                active ? 'bg-[#e6f1fd] font-medium text-[#0073ea]' : 'text-gray-700 hover:bg-gray-200/60'
                              }`}
                            >
                              {board.name}
                            </Link>
                            {canEdit && (
                              <BoardMenu
                                onDuplicate={() => handleDuplicateBoard(board.id)}
                                onDelete={() => handleDeleteBoard(board.id)}
                                canDelete={isWorkspaceOwner}
                              />
                            )}
                          </div>
                        );
                      })}

                    {/* Board creation is owner-only (boards_insert_own in
                        migration 0020); members would just hit an RLS error. */}
                    {isWorkspaceOwner && (
                      <NewBoardMenu
                        disabled={isPending}
                        onCreateBlank={() => handleCreateBlankBoard(workspace.id, workspace.boards.length)}
                        onCreateFromTemplate={(templateId) =>
                          handleCreateFromTemplate(workspace.id, workspace.boards.length, templateId)
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <form action={signOut} className="border-t border-gray-200 px-2 py-2">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-200/60"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </form>
      </aside>
    </>
  );
}

function MembersPopover({
  workspace,
  currentUserId,
}: {
  workspace: WorkspaceWithBoards;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<MemberProfile[]>(workspace.members);
  const [open, setOpen] = useState(false);
  // null = modal closed, 'new' = invite mode, a member = editing their access.
  const [accessTarget, setAccessTarget] = useState<MemberProfile | 'new' | null>(null);
  const [removingMember, setRemovingMember] = useState<MemberProfile | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const isOwner = members.find((m) => m.user_id === currentUserId)?.role === 'owner';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // The access modal and the remove confirmation both portal to
      // document.body, so a click inside either is outside `ref` — closing
      // the popover underneath would unmount the dialog mid-decision.
      if (accessTarget || removingMember) return;
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, accessTarget, removingMember]);

  async function handleRemove(member: MemberProfile) {
    const previous = members;
    setRemoveError(null);
    setMembers((prev) => prev.filter((m) => m.user_id !== member.user_id));
    setRemovingMember(null);
    try {
      await removeMember(workspace.id, member.user_id);
    } catch (e) {
      // Previously this awaited with no catch, so a rejected delete left the
      // person gone from the list but still in the workspace.
      setMembers(previous);
      setRemoveError(e instanceof Error ? e.message : 'Could not remove that member');
    }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center -space-x-1.5 py-1">
        {members.slice(0, 4).map((m) => (
          <span
            key={m.user_id}
            title={displayName(m)}
            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#f6f7fb] text-[8px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(m.user_id) }}
          >
            {initials(m)}
          </span>
        ))}
        {members.length === 0 && <span className="text-[10px] text-gray-300">+</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <p className="mb-1 px-1 text-[11px] font-medium text-gray-500">Members</p>
          <div className="mb-1 max-h-40 space-y-0.5 overflow-y-auto">
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              // Owners are never restricted, so "limited" only ever applies to
              // members and viewers — see can_access_board / can_view_module.
              const limited =
                m.role !== 'owner' &&
                (m.board_access !== 'all' || m.features.length < WORKSPACE_FEATURES.length);
              return (
                <div key={m.user_id} className="flex items-center gap-2 rounded px-1 py-1">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                    style={{ backgroundColor: avatarColor(m.user_id) }}
                  >
                    {initials(m)}
                  </span>
                  <span className="flex-1 truncate text-xs text-gray-700" title={m.email}>
                    {displayName(m)}
                  </span>
                  {isOwner && !isSelf ? (
                    <button
                      onClick={() => setAccessTarget(m)}
                      title="Manage boards and modules"
                      className="flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:border-[#0073ea] hover:text-[#0073ea]"
                    >
                      <SlidersHorizontal size={10} />
                      {roleLabel(m.role)}
                      {limited && ' · limited'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400">{m.role}</span>
                  )}
                  {isOwner && !isSelf && (
                    <button
                      onClick={() => setRemovingMember(m)}
                      title={`Remove ${displayName(m)} from this workspace`}
                      className="text-gray-300 hover:text-red-500"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {removeError && <p className="mb-1 px-1 text-[10px] text-red-500">{removeError}</p>}

          {isOwner && (
            <div className="border-t border-gray-100 pt-2">
              {/* Opens the same form used to edit access, so boards and
                  modules are chosen as part of inviting rather than in a
                  second pass afterwards. */}
              <button
                onClick={() => setAccessTarget('new')}
                className="flex w-full items-center justify-center gap-1.5 rounded bg-[#0073ea] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2]"
              >
                <UserPlus size={12} /> Invite member
              </button>
            </div>
          )}
        </div>
      )}

      {accessTarget && (
        <MemberAccessModal
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          boards={workspace.boards}
          member={accessTarget === 'new' ? null : accessTarget}
          onClose={() => setAccessTarget(null)}
          onUpdated={(updated) =>
            setMembers((prev) => prev.map((m) => (m.user_id === updated.user_id ? updated : m)))
          }
          onInvited={(invited) => setMembers((prev) => [...prev, invited])}
        />
      )}

      {removingMember && (
        <ConfirmDialog
          title={`Remove ${displayName(removingMember)}?`}
          message={`They lose access to ${workspace.name} immediately — every board and every module. Anything they created stays. Their board selections are cleared, so re-inviting them starts fresh.`}
          confirmLabel="Remove member"
          onConfirm={() => handleRemove(removingMember)}
          onCancel={() => setRemovingMember(null)}
        />
      )}
    </div>
  );
}

function NewBoardMenu({
  disabled,
  onCreateBlank,
  onCreateFromTemplate,
}: {
  disabled: boolean;
  onCreateBlank: () => void;
  onCreateFromTemplate: (templateId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-200/60 hover:text-gray-600 disabled:opacity-50"
      >
        <Plus size={14} />
        New Board
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <button
            onClick={() => {
              onCreateBlank();
              setOpen(false);
            }}
            className="w-full rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
          >
            Blank board
          </button>
          <div className="my-1 border-t border-gray-100" />
          {BOARD_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                onCreateFromTemplate(template.id);
                setOpen(false);
              }}
              className="w-full rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
              title={template.description}
            >
              {template.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardMenu({
  onDuplicate,
  onDelete,
  canDelete,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600"
      >
        <MoreHorizontal size={14} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          <button
            onClick={() => {
              onDuplicate();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
          >
            <Copy size={12} /> Duplicate
          </button>
          {canDelete && (
            <button
              onClick={() => {
                if (!confirmingDelete) {
                  setConfirmingDelete(true);
                  return;
                }
                onDelete();
                setOpen(false);
                setConfirmingDelete(false);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                confirmingDelete ? 'bg-red-50 text-red-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Trash2 size={12} /> {confirmingDelete ? 'Confirm delete?' : 'Delete'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
