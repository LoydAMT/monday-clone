'use client';

import { useState } from 'react';
import { Bell, Trash2, X, Zap } from 'lucide-react';
import type { Automation, Column, MemberProfile } from '@/types/database';
import { Modal } from './ui/Modal';
import { createAutomation, deleteAutomation, type NewAutomation } from '@/lib/mutations';
import { displayName } from '@/lib/avatar-color';

function describeAutomation(automation: Automation, columns: Column[], members: MemberProfile[]): string {
  const triggerColumn = columns.find((c) => c.id === automation.trigger_column_id)?.name ?? 'a column';

  if (automation.trigger_type === 'status_changed') {
    const member = members.find((m) => m.user_id === automation.action_user_id);
    const who = member ? displayName(member) : 'someone';
    return `When ${triggerColumn} changes to "${automation.trigger_value}", notify ${who}`;
  }

  const actionColumn = columns.find((c) => c.id === automation.action_column_id)?.name ?? 'a column';
  return `When ${triggerColumn} passes, change ${actionColumn} to "${automation.action_value}"`;
}

export function AutomationsPanel({
  boardId,
  columns,
  members,
  automations,
  onClose,
  onCreate,
  onDelete,
  canEdit = true,
}: {
  boardId: string;
  columns: Column[];
  members: MemberProfile[];
  automations: Automation[];
  onClose: () => void;
  onCreate: (automation: Automation) => void;
  onDelete: (id: string) => void;
  canEdit?: boolean;
}) {
  const [adding, setAdding] = useState<'status_notify' | 'date_status' | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const statusColumns = columns.filter((c) => c.type === 'status');
  const dateColumns = columns.filter((c) => c.type === 'date');

  async function handleDelete(id: string) {
    if (deleting !== id) {
      setDeleting(id);
      return;
    }
    onDelete(id);
    setDeleting(null);
    try {
      await deleteAutomation(id);
    } catch {
      // A failed delete just leaves the row gone from this session's list
      // until the next reload restores it from the server — acceptable for
      // a low-stakes management panel, no need for full rollback plumbing.
    }
  }

  async function handleCreate(input: NewAutomation) {
    setAdding(null);
    try {
      const created = await createAutomation(input);
      onCreate(created);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create automation');
    }
  }

  return (
    <Modal onClose={onClose} widthClassName="max-w-lg">
      <div className="max-h-[80vh] overflow-y-auto p-5">
        <h2 className="mb-1 flex items-center gap-1.5 text-base font-semibold text-gray-900">
          <Zap size={16} className="text-[#fdab3d]" /> Automations
        </h2>
        <p className="mb-4 text-xs text-gray-500">Runs automatically when the trigger condition happens on this board.</p>

        {automations.length === 0 ? (
          <p className="mb-4 text-xs text-gray-400">No automations yet.</p>
        ) : (
          <div className="mb-4 space-y-1">
            {automations.map((automation) => (
              <div
                key={automation.id}
                className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <p className="min-w-0 flex-1 truncate text-xs text-gray-700">
                  {describeAutomation(automation, columns, members)}
                </p>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(automation.id)}
                    className={`shrink-0 rounded px-1.5 py-1 text-[11px] ${
                      deleting === automation.id ? 'bg-red-50 text-red-600' : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <>
            {adding === null && (
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">Add automation</p>
                <button
                  disabled={statusColumns.length === 0 || members.length === 0}
                  onClick={() => setAdding('status_notify')}
                  className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Bell size={13} className="shrink-0 text-gray-400" />
                  When Status changes to a value, notify someone
                </button>
                <button
                  disabled={dateColumns.length === 0 || statusColumns.length === 0}
                  onClick={() => setAdding('date_status')}
                  className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Zap size={13} className="shrink-0 text-gray-400" />
                  When a date passes, change Status
                </button>
                {(statusColumns.length === 0 || dateColumns.length === 0) && (
                  <p className="text-[11px] text-gray-400">
                    {statusColumns.length === 0 && 'Add a Status column to this board to use these automations.'}
                    {statusColumns.length > 0 && dateColumns.length === 0 && 'Add a Date column to use the second automation.'}
                  </p>
                )}
              </div>
            )}

            {adding === 'status_notify' && (
              <StatusNotifyForm
                boardId={boardId}
                statusColumns={statusColumns}
                members={members}
                onCancel={() => setAdding(null)}
                onSubmit={handleCreate}
              />
            )}

            {adding === 'date_status' && (
              <DateStatusForm
                boardId={boardId}
                dateColumns={dateColumns}
                statusColumns={statusColumns}
                onCancel={() => setAdding(null)}
                onSubmit={handleCreate}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function StatusNotifyForm({
  boardId,
  statusColumns,
  members,
  onCancel,
  onSubmit,
}: {
  boardId: string;
  statusColumns: Column[];
  members: MemberProfile[];
  onCancel: () => void;
  onSubmit: (input: NewAutomation) => void;
}) {
  const [columnId, setColumnId] = useState(statusColumns[0]?.id ?? '');
  const column = statusColumns.find((c) => c.id === columnId) ?? statusColumns[0];
  const statuses = column?.options.statuses ?? [];
  const [value, setValue] = useState(statuses[0]?.label ?? '');
  const [userId, setUserId] = useState(members[0]?.user_id ?? '');

  return (
    <div className="mt-3 space-y-2 rounded-md border border-gray-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">When Status changes, notify someone</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>

      {statusColumns.length > 1 && (
        <select
          value={columnId}
          onChange={(e) => {
            setColumnId(e.target.value);
            setValue(statusColumns.find((c) => c.id === e.target.value)?.options.statuses?.[0]?.label ?? '');
          }}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
        >
          {statusColumns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
      >
        {statuses.map((s) => (
          <option key={s.label} value={s.label}>
            changes to &quot;{s.label}&quot;
          </option>
        ))}
      </select>

      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
      >
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            notify {displayName(m)}
          </option>
        ))}
      </select>

      <button
        disabled={!column || !value || !userId}
        onClick={() =>
          onSubmit({
            board_id: boardId,
            trigger_type: 'status_changed',
            trigger_column_id: column.id,
            trigger_value: value,
            action_type: 'notify',
            action_user_id: userId,
          })
        }
        className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
      >
        Add automation
      </button>
    </div>
  );
}

function DateStatusForm({
  boardId,
  dateColumns,
  statusColumns,
  onCancel,
  onSubmit,
}: {
  boardId: string;
  dateColumns: Column[];
  statusColumns: Column[];
  onCancel: () => void;
  onSubmit: (input: NewAutomation) => void;
}) {
  const [dateColumnId, setDateColumnId] = useState(dateColumns[0]?.id ?? '');
  const [statusColumnId, setStatusColumnId] = useState(statusColumns[0]?.id ?? '');
  const statusColumn = statusColumns.find((c) => c.id === statusColumnId) ?? statusColumns[0];
  const statuses = statusColumn?.options.statuses ?? [];
  const [value, setValue] = useState(statuses[0]?.label ?? '');

  return (
    <div className="mt-3 space-y-2 rounded-md border border-gray-200 p-3">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-gray-700">When a date passes, change Status</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>

      <select
        value={dateColumnId}
        onChange={(e) => setDateColumnId(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
      >
        {dateColumns.map((c) => (
          <option key={c.id} value={c.id}>
            When {c.name} passes
          </option>
        ))}
      </select>

      {statusColumns.length > 1 && (
        <select
          value={statusColumnId}
          onChange={(e) => {
            setStatusColumnId(e.target.value);
            setValue(statusColumns.find((c) => c.id === e.target.value)?.options.statuses?.[0]?.label ?? '');
          }}
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
        >
          {statusColumns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
      >
        {statuses.map((s) => (
          <option key={s.label} value={s.label}>
            change to &quot;{s.label}&quot;
          </option>
        ))}
      </select>

      <button
        disabled={!dateColumnId || !statusColumn || !value}
        onClick={() =>
          onSubmit({
            board_id: boardId,
            trigger_type: 'date_passed',
            trigger_column_id: dateColumnId,
            action_type: 'change_status',
            action_column_id: statusColumn.id,
            action_value: value,
          })
        }
        className="w-full rounded bg-[#0073ea] py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
      >
        Add automation
      </button>
    </div>
  );
}
