'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Copy, LayoutGrid, MoreHorizontal, Plus, LogOut, Trash2, X } from 'lucide-react';
import type { MemberProfile } from '@/types/database';
import type { WorkspaceWithBoards } from '@/lib/queries';
import {
  createNewBoard,
  createBoardFromTemplate,
  deleteBoard,
  duplicateBoard,
  inviteMember,
  removeMember,
} from '@/lib/mutations';
import { BOARD_TEMPLATES } from '@/lib/templates';
import { avatarColor, initialsFromEmail } from '@/lib/avatar-color';
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();

  function goToBoard(board: { id: string }) {
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
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-[#f6f7fb]">
      <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0073ea] text-white">
          <LayoutGrid size={16} />
        </div>
        <span className="flex-1 truncate text-sm font-semibold text-gray-900">work-boards</span>
        <NotificationBell currentUserId={currentUserId} />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {workspaces.map((workspace) => {
          const isCollapsed = collapsed[workspace.id];
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
                  {workspace.boards.map((board) => {
                    const active = params?.boardId === board.id;
                    return (
                      <div key={board.id} className="group flex items-center">
                        <Link
                          href={`/board/${board.id}`}
                          className={`block flex-1 truncate rounded px-2 py-1.5 text-sm ${
                            active ? 'bg-[#e6f1fd] font-medium text-[#0073ea]' : 'text-gray-700 hover:bg-gray-200/60'
                          }`}
                        >
                          {board.name}
                        </Link>
                        <BoardMenu
                          onDuplicate={() => handleDuplicateBoard(board.id)}
                          onDelete={() => handleDeleteBoard(board.id)}
                        />
                      </div>
                    );
                  })}

                  <NewBoardMenu
                    disabled={isPending}
                    onCreateBlank={() => handleCreateBlankBoard(workspace.id, workspace.boards.length)}
                    onCreateFromTemplate={(templateId) =>
                      handleCreateFromTemplate(workspace.id, workspace.boards.length, templateId)
                    }
                  />
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
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isOwner = members.find((m) => m.user_id === currentUserId)?.role === 'owner';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleInvite() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setPending(true);
    try {
      const member = await inviteMember(workspace.id, workspace.name, trimmed);
      setMembers((prev) => [...prev, member]);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invite');
    } finally {
      setPending(false);
    }
  }

  async function handleRemove(userId: string) {
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    await removeMember(workspace.id, userId);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center -space-x-1.5 py-1">
        {members.slice(0, 4).map((m) => (
          <span
            key={m.user_id}
            title={m.email}
            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#f6f7fb] text-[8px] font-semibold text-white"
            style={{ backgroundColor: avatarColor(m.user_id) }}
          >
            {initialsFromEmail(m.email)}
          </span>
        ))}
        {members.length === 0 && <span className="text-[10px] text-gray-300">+</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          <p className="mb-1 px-1 text-[11px] font-medium text-gray-500">Members</p>
          <div className="mb-1 max-h-40 space-y-0.5 overflow-y-auto">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2 rounded px-1 py-1">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                  style={{ backgroundColor: avatarColor(m.user_id) }}
                >
                  {initialsFromEmail(m.email)}
                </span>
                <span className="flex-1 truncate text-xs text-gray-700">{m.email}</span>
                <span className="text-[10px] text-gray-400">{m.role}</span>
                {isOwner && m.role !== 'owner' && (
                  <button onClick={() => handleRemove(m.user_id)} className="text-gray-300 hover:text-red-500">
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="border-t border-gray-100 pt-2">
              <div className="flex items-center gap-1">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  placeholder="Invite by email"
                  className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
                />
                <button
                  onClick={handleInvite}
                  disabled={pending}
                  className="shrink-0 rounded bg-[#0073ea] px-2 py-1 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
                >
                  Invite
                </button>
              </div>
              {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
            </div>
          )}
        </div>
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

function BoardMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
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
    <div ref={ref} className="relative shrink-0 opacity-0 group-hover:opacity-100">
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
        </div>
      )}
    </div>
  );
}
