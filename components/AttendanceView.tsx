'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Pencil, X } from 'lucide-react';
import type { AttendanceRecord, MemberProfile } from '@/types/database';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import {
  clockIn,
  clockOut,
  getAttendanceRecordsForMonth,
  updateTimeIn,
  updateTimeOut,
} from '@/lib/attendance-mutations';
import {
  formatClockTime,
  formatDuration,
  formatMonthLabel,
  formatWorkDate,
  fromDatetimeLocalValue,
  monthRange,
  shiftMonth,
  toDatetimeLocalValue,
  todayLocalDateString,
} from '@/lib/attendance-time';

type EditTarget = { recordId: string; field: 'time_in' | 'time_out' };

export function AttendanceView({
  workspaceId,
  workspaceName,
  members,
  currentUserId,
  initialRecords,
  initialMonth,
}: {
  workspaceId: string;
  workspaceName: string;
  members: MemberProfile[];
  currentUserId: string;
  initialRecords: AttendanceRecord[];
  initialMonth: string;
}) {
  const todayStr = todayLocalDateString();
  const [records, setRecords] = useState(initialRecords);
  const [month, setMonth] = useState(initialMonth);
  const [monthLoading, setMonthLoading] = useState(false);
  const [memberFilter, setMemberFilter] = useState('all');
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(
    initialRecords.find((r) => r.user_id === currentUserId && r.work_date === todayStr) ?? null
  );
  const [clockPending, setClockPending] = useState(false);
  const [clockError, setClockError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);

  const isOwner = members.find((m) => m.user_id === currentUserId)?.role === 'owner';
  const memberById = new Map(members.map((m) => [m.user_id, m]));
  const visibleRecords = isOwner && memberFilter !== 'all' ? records.filter((r) => r.user_id === memberFilter) : records;

  function applyRecordUpdate(updated: AttendanceRecord) {
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === updated.id);
      const next = exists ? prev.map((r) => (r.id === updated.id ? updated : r)) : [updated, ...prev];
      return next.sort((a, b) => b.work_date.localeCompare(a.work_date));
    });
    if (updated.user_id === currentUserId && updated.work_date === todayStr) {
      setTodayRecord(updated);
    }
  }

  async function handleClockIn() {
    setClockError(null);
    setClockPending(true);
    try {
      const record = await clockIn(workspaceId);
      setTodayRecord(record);
      if (monthRange(month).start === monthRange(todayStr).start) applyRecordUpdate(record);
    } catch (e) {
      setClockError(e instanceof Error ? e.message : 'Failed to clock in');
    } finally {
      setClockPending(false);
    }
  }

  async function handleClockOut() {
    if (!todayRecord) return;
    setClockError(null);
    setClockPending(true);
    try {
      const record = await clockOut(todayRecord.id);
      setTodayRecord(record);
      applyRecordUpdate(record);
    } catch (e) {
      setClockError(e instanceof Error ? e.message : 'Failed to clock out');
    } finally {
      setClockPending(false);
    }
  }

  async function handleMonthShift(delta: number) {
    const nextMonth = shiftMonth(month, delta);
    const { start, end } = monthRange(nextMonth);
    setMonthLoading(true);
    try {
      const data = await getAttendanceRecordsForMonth(workspaceId, start, end);
      setRecords(data);
      setMonth(nextMonth);
    } finally {
      setMonthLoading(false);
    }
  }

  function startEdit(record: AttendanceRecord, field: 'time_in' | 'time_out') {
    setEditError(null);
    setEditing({ recordId: record.id, field });
    const current = field === 'time_in' ? record.time_in : record.time_out;
    setEditValue(current ? toDatetimeLocalValue(current) : toDatetimeLocalValue(new Date().toISOString()));
  }

  function cancelEdit() {
    setEditing(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setEditPending(true);
    setEditError(null);
    try {
      const isoTime = fromDatetimeLocalValue(editValue);
      const updated =
        editing.field === 'time_in'
          ? await updateTimeIn(editing.recordId, isoTime)
          : await updateTimeOut(editing.recordId, isoTime);
      applyRecordUpdate(updated);
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setEditPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Attendance</h1>
        <p className="text-sm text-gray-400">{workspaceName}</p>
      </div>

      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
          <Clock size={16} className="shrink-0 text-gray-400" />
          {!todayRecord && (
            <>
              <span className="flex-1 text-sm text-gray-600">You haven&apos;t clocked in today.</span>
              <button
                onClick={handleClockIn}
                disabled={clockPending}
                className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
              >
                {clockPending ? 'Clocking in…' : 'Clock In'}
              </button>
            </>
          )}
          {todayRecord && !todayRecord.time_out && (
            <>
              <span className="flex-1 text-sm text-gray-600">
                Clocked in at <span className="font-medium text-gray-900">{formatClockTime(todayRecord.time_in)}</span>
              </span>
              <button
                onClick={handleClockOut}
                disabled={clockPending}
                className="rounded-md bg-[#e2445c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#c7364c] disabled:opacity-50"
              >
                {clockPending ? 'Clocking out…' : 'Clock Out'}
              </button>
            </>
          )}
          {todayRecord && todayRecord.time_out && (
            <span className="flex-1 text-sm text-gray-600">
              Today: <span className="font-medium text-gray-900">{formatClockTime(todayRecord.time_in)}</span> –{' '}
              <span className="font-medium text-gray-900">{formatClockTime(todayRecord.time_out)}</span>{' '}
              <span className="text-gray-400">({formatDuration(todayRecord.time_in, todayRecord.time_out)})</span>
            </span>
          )}
        </div>
        {clockError && <p className="mt-2 text-xs text-red-500">{clockError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-2.5">
        <button
          onClick={() => handleMonthShift(-1)}
          disabled={monthLoading}
          title="Previous month"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="min-w-[9rem] text-center text-sm font-medium text-gray-700">{formatMonthLabel(month)}</span>
        <button
          onClick={() => handleMonthShift(1)}
          disabled={monthLoading}
          title="Next month"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
        >
          <ChevronRight size={14} />
        </button>

        {isOwner && (
          <select
            value={memberFilter}
            onChange={(e) => setMemberFilter(e.target.value)}
            className="ml-auto rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
          >
            <option value="all">All members</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {displayName(m)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {visibleRecords.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-gray-400">No attendance records for this month.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <th className="px-2 py-2">Date</th>
                {isOwner && <th className="px-2 py-2">Member</th>}
                <th className="px-2 py-2">Time In</th>
                <th className="px-2 py-2">Time Out</th>
                <th className="px-2 py-2 text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => {
                const member = memberById.get(record.user_id);
                const isMine = record.user_id === currentUserId;
                return (
                  <tr key={record.id} className="border-b border-gray-100">
                    <td className="px-2 py-2 text-gray-700">{formatWorkDate(record.work_date)}</td>
                    {isOwner && (
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          {member && (
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white"
                              style={{ backgroundColor: avatarColor(member.user_id) }}
                            >
                              {initials(member)}
                            </span>
                          )}
                          <span className="truncate text-gray-700">{member ? displayName(member) : 'Unknown'}</span>
                        </div>
                      </td>
                    )}
                    <TimeCell
                      record={record}
                      field="time_in"
                      canEdit={isMine}
                      editing={editing}
                      editValue={editValue}
                      editError={editError}
                      editPending={editPending}
                      onStartEdit={() => startEdit(record, 'time_in')}
                      onChangeValue={setEditValue}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                    />
                    <TimeCell
                      record={record}
                      field="time_out"
                      canEdit={isMine}
                      editing={editing}
                      editValue={editValue}
                      editError={editError}
                      editPending={editPending}
                      onStartEdit={() => startEdit(record, 'time_out')}
                      onChangeValue={setEditValue}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                    />
                    <td className="px-2 py-2 text-right text-gray-600">{formatDuration(record.time_in, record.time_out)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TimeCell({
  record,
  field,
  canEdit,
  editing,
  editValue,
  editError,
  editPending,
  onStartEdit,
  onChangeValue,
  onSave,
  onCancel,
}: {
  record: AttendanceRecord;
  field: 'time_in' | 'time_out';
  canEdit: boolean;
  editing: EditTarget | null;
  editValue: string;
  editError: string | null;
  editPending: boolean;
  onStartEdit: () => void;
  onChangeValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const value = field === 'time_in' ? record.time_in : record.time_out;
  const manual = field === 'time_in' ? record.time_in_manual : record.time_out_manual;
  const isEditingThis = editing?.recordId === record.id && editing.field === field;

  if (isEditingThis) {
    return (
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <input
            type="datetime-local"
            value={editValue}
            onChange={(e) => onChangeValue(e.target.value)}
            className="rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
          />
          <button
            onClick={onSave}
            disabled={editPending}
            className="rounded bg-[#0073ea] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
          >
            {editPending ? '…' : 'Save'}
          </button>
          <button onClick={onCancel} className="text-gray-300 hover:text-red-500">
            <X size={13} />
          </button>
        </div>
        {editError && <p className="mt-1 text-[10px] text-red-500">{editError}</p>}
      </td>
    );
  }

  return (
    <td className="px-2 py-2">
      <div className="group flex items-center gap-1.5">
        <span className="text-gray-700">{value ? formatClockTime(value) : '—'}</span>
        {manual && <span className="text-[10px] text-gray-400">(edited)</span>}
        {canEdit && (
          <button
            onClick={onStartEdit}
            title={value ? `Edit ${field === 'time_in' ? 'clock-in' : 'clock-out'} time` : 'Set clock-out time'}
            className="text-gray-300 opacity-100 hover:text-[#0073ea] md:opacity-0 md:group-hover:opacity-100"
          >
            <Pencil size={11} />
          </button>
        )}
      </div>
    </td>
  );
}
