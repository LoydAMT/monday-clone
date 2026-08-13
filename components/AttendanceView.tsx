'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Clock, LogIn, LogOut, Pencil, Users, X } from 'lucide-react';
import type { AttendanceRecord, MemberProfile } from '@/types/database';
import { adjustTimeIn, adjustTimeOut, timeIn, timeOut } from '@/lib/attendance-mutations';
import { combineDateAndTime, formatClockTime, formatDuration, formatWorkDate, todayLocalDateString, toTimeInputValue } from '@/lib/attendance-time';

type PickerTarget = 'clockIn' | 'clockOut' | 'adjustIn' | 'adjustOut';

export function AttendanceView({
  workspaceId,
  workspaceName,
  members,
  currentUserId,
  initialToday,
  initialHistory,
}: {
  workspaceId: string;
  workspaceName: string;
  members: MemberProfile[];
  currentUserId: string;
  initialToday: AttendanceRecord | null;
  initialHistory: AttendanceRecord[];
}) {
  const [today, setToday] = useState(initialToday);
  const [history, setHistory] = useState(initialHistory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [pickerValue, setPickerValue] = useState('');

  const isOwner = members.find((m) => m.user_id === currentUserId)?.role === 'owner';

  function openPicker(target: PickerTarget, initial: Date) {
    setError(null);
    setPicker(target);
    setPickerValue(toTimeInputValue(initial));
  }

  function closePicker() {
    setPicker(null);
  }

  async function runTimeIn(time: Date, manual: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const record = await timeIn(workspaceId, currentUserId, time, manual);
      setToday(record);
      setPicker(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to time in.');
    } finally {
      setBusy(false);
    }
  }

  async function runTimeOut(time: Date, manual: boolean) {
    if (!today || busy) return;
    setBusy(true);
    setError(null);
    try {
      const record = await timeOut(today, time, manual);
      setToday(record);
      setHistory((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
      setPicker(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to time out.');
    } finally {
      setBusy(false);
    }
  }

  async function runAdjustTimeIn(time: Date) {
    if (!today || busy) return;
    setBusy(true);
    setError(null);
    try {
      const record = await adjustTimeIn(today, time);
      setToday(record);
      setPicker(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to adjust time in.');
    } finally {
      setBusy(false);
    }
  }

  async function runAdjustTimeOut(time: Date) {
    if (!today || busy) return;
    setBusy(true);
    setError(null);
    try {
      const record = await adjustTimeOut(today, time);
      setToday(record);
      setPicker(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to adjust time out.');
    } finally {
      setBusy(false);
    }
  }

  function confirmPicker() {
    const picked = combineDateAndTime(todayLocalDateString(), pickerValue);
    if (picker === 'clockIn') runTimeIn(picked, true);
    else if (picker === 'clockOut') runTimeOut(picked, true);
    else if (picker === 'adjustIn') runAdjustTimeIn(picked);
    else if (picker === 'adjustOut') runAdjustTimeOut(picked);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-400">{workspaceName}</p>
          </div>
          {isOwner && (
            <Link
              href={`/attendance/${workspaceId}/team`}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Users size={13} /> Team
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

        <div className="mb-5 max-w-md rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Today</h3>

          {!today ? (
            <div className="space-y-2">
              <button
                onClick={() => runTimeIn(new Date(), false)}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0073ea] py-2.5 text-sm font-semibold text-white hover:bg-[#0060c2] disabled:opacity-50"
              >
                <LogIn size={15} /> {busy ? 'Timing in…' : 'Time In'}
              </button>
              {picker === 'clockIn' ? (
                <InlineTimePicker value={pickerValue} onChange={setPickerValue} onConfirm={confirmPicker} onCancel={closePicker} busy={busy} />
              ) : (
                <button
                  onClick={() => openPicker('clockIn', new Date())}
                  disabled={busy}
                  className="w-full text-center text-xs text-gray-500 hover:underline"
                >
                  I actually timed in at a different time
                </button>
              )}
            </div>
          ) : !today.time_out ? (
            <div className="space-y-2">
              <TimeRow
                label={`Timed in at ${formatClockTime(today.time_in)}`}
                onEdit={() => openPicker('adjustIn', new Date(today.time_in))}
              />
              {picker === 'adjustIn' && (
                <InlineTimePicker value={pickerValue} onChange={setPickerValue} onConfirm={confirmPicker} onCancel={closePicker} busy={busy} />
              )}
              <button
                onClick={() => runTimeOut(new Date(), false)}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0073ea] py-2.5 text-sm font-semibold text-white hover:bg-[#0060c2] disabled:opacity-50"
              >
                <LogOut size={15} /> {busy ? 'Timing out…' : 'Time Out'}
              </button>
              {picker === 'clockOut' ? (
                <InlineTimePicker value={pickerValue} onChange={setPickerValue} onConfirm={confirmPicker} onCancel={closePicker} busy={busy} />
              ) : (
                <button
                  onClick={() => openPicker('clockOut', new Date())}
                  disabled={busy}
                  className="w-full text-center text-xs text-gray-500 hover:underline"
                >
                  I actually timed out at a different time
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <TimeRow label={`In: ${formatClockTime(today.time_in)}`} onEdit={() => openPicker('adjustIn', new Date(today.time_in))} />
              {picker === 'adjustIn' && (
                <InlineTimePicker value={pickerValue} onChange={setPickerValue} onConfirm={confirmPicker} onCancel={closePicker} busy={busy} />
              )}
              <TimeRow label={`Out: ${formatClockTime(today.time_out)}`} onEdit={() => openPicker('adjustOut', new Date(today.time_out!))} />
              {picker === 'adjustOut' && (
                <InlineTimePicker value={pickerValue} onChange={setPickerValue} onConfirm={confirmPicker} onCancel={closePicker} busy={busy} />
              )}
              <div className="flex items-center gap-2 rounded-md bg-[#e6f1fd] px-3 py-2">
                <Clock size={13} className="text-[#0073ea]" />
                <span className="text-xs font-medium text-[#0073ea]">{formatDuration(today.time_in, today.time_out)} today</span>
              </div>
            </div>
          )}
        </div>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No attendance recorded yet.</p>
        ) : (
          <div className="max-w-md overflow-hidden rounded-lg border border-gray-200 bg-white">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5 last:border-b-0">
                <span className="text-sm text-gray-900">{formatWorkDate(r.work_date)}</span>
                <span className="text-xs text-gray-500">
                  {formatClockTime(r.time_in)} – {formatClockTime(r.time_out)}
                </span>
                <span className="text-xs font-medium text-gray-700">{formatDuration(r.time_in, r.time_out)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimeRow({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <button onClick={onEdit} title="Edit" className="text-gray-300 hover:text-[#0073ea]">
        <Pencil size={13} />
      </button>
    </div>
  );
}

function InlineTimePicker({
  value,
  onChange,
  onConfirm,
  onCancel,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs outline-none focus:border-[#0073ea]"
      />
      <button
        onClick={onConfirm}
        disabled={busy}
        className="rounded bg-[#0073ea] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
      >
        {busy ? '…' : 'Confirm'}
      </button>
      <button onClick={onCancel} className="text-gray-400 hover:text-red-500">
        <X size={13} />
      </button>
    </div>
  );
}
