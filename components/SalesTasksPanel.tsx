'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import type { MemberProfile, SalesTask } from '@/types/database';
import { formatDateTime, fromDateTimeLocalValue } from '@/lib/sales-stages';
import { createSalesTask, deleteSalesTask, setSalesTaskDone } from '@/lib/sales-mutations';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { Field, fieldInputClass } from './ui/Field';

// A task's due date is a timestamptz (a reminder has a time of day), unlike
// the deal's next_follow_up_on date column — so overdue is a plain instant
// comparison here rather than a YYYY-MM-DD string compare.
function isTaskOverdue(task: SalesTask): boolean {
  return !task.done_at && task.due_at != null && new Date(task.due_at).getTime() < Date.now();
}

export function SalesTasksPanel({
  workspaceId,
  workspaceName,
  companyId,
  dealId,
  tasks,
  members,
  canEdit,
  onChange,
}: {
  workspaceId: string;
  workspaceName: string;
  companyId: string | null;
  dealId: string | null;
  tasks: SalesTask[];
  members: MemberProfile[];
  canEdit: boolean;
  onChange: (next: SalesTask[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membersByUserId = new Map(members.map((m) => [m.user_id, m]));
  const openTasks = tasks.filter((t) => !t.done_at);

  async function handleAdd() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Task title is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createSalesTask(workspaceId, workspaceName, {
        company_id: companyId,
        deal_id: dealId,
        title: trimmed,
        details: null,
        due_at: fromDateTimeLocalValue(dueAt),
        assigned_to: assignedTo || null,
      });
      onChange([created, ...tasks]);
      setTitle('');
      setDueAt('');
      setAssignedTo('');
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add task');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(task: SalesTask) {
    const done = !task.done_at;
    const previous = tasks;
    setError(null);
    onChange(tasks.map((t) => (t.id === task.id ? { ...t, done_at: done ? new Date().toISOString() : null } : t)));
    try {
      const updated = await setSalesTaskDone(task.id, done);
      onChange(previous.map((t) => (t.id === task.id ? updated : t)));
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to update task');
    }
  }

  async function handleDelete(taskId: string) {
    const previous = tasks;
    setError(null);
    onChange(tasks.filter((t) => t.id !== taskId));
    try {
      await deleteSalesTask(taskId);
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete task');
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Tasks &amp; reminders {openTasks.length > 0 && `(${openTasks.length} open)`}
        </h3>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-medium text-[#0073ea] hover:underline">
            <Plus size={12} /> Add task
          </button>
        )}
      </div>

      {tasks.length === 0 && !adding && <p className="py-4 text-center text-xs text-gray-400">No tasks yet.</p>}

      <div className="space-y-1">
        {tasks.map((task) => {
          const assignee = task.assigned_to ? membersByUserId.get(task.assigned_to) : undefined;
          const overdue = isTaskOverdue(task);

          return (
            <div key={task.id} className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50">
              <button
                onClick={() => canEdit && handleToggle(task)}
                disabled={!canEdit}
                title={task.done_at ? 'Reopen task' : 'Mark as done'}
                className={task.done_at ? 'shrink-0 text-[#00c875]' : 'shrink-0 text-gray-300 hover:text-gray-500'}
              >
                {task.done_at ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>

              <span className={`flex-1 truncate text-sm ${task.done_at ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {task.title}
              </span>

              {task.due_at && (
                <span className={`shrink-0 text-[11px] ${overdue ? 'font-medium text-[#e2445c]' : 'text-gray-400'}`}>
                  {formatDateTime(task.due_at)}
                </span>
              )}

              {assignee && (
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                  style={{ backgroundColor: avatarColor(assignee.user_id) }}
                  title={displayName(assignee)}
                >
                  {initials(assignee)}
                </span>
              )}

              {canEdit && (
                <button
                  onClick={() => handleDelete(task.id)}
                  title="Delete task"
                  className="shrink-0 text-gray-300 opacity-100 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {adding && (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Task" className="sm:col-span-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="Call to confirm receipt of quotation"
                className={fieldInputClass}
              />
            </Field>
            <Field label="Due" className="sm:col-span-2">
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={fieldInputClass} />
            </Field>
            <Field label="Assign to">
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={fieldInputClass}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {displayName(m)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
