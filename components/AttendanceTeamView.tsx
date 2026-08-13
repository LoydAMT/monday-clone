'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Download } from 'lucide-react';
import type { AttendanceRecord, MemberProfile } from '@/types/database';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { buildAttendanceWorkbook } from '@/lib/attendance-excel';
import { downloadWorkbook } from '@/lib/excel';
import { getAttendanceRecordsForDate, getAttendanceRecordsForRange } from '@/lib/attendance-mutations';
import { endOfMonthString, formatClockTime, startOfMonthString, todayLocalDateString } from '@/lib/attendance-time';

// Owner-only "monitoring" view — mirrors instrubyte-crm-mobile's team.tsx:
// one day at a time, every member listed (including anyone who hasn't timed
// in at all, shown as Absent) rather than only members with a punch.
export function AttendanceTeamView({
  workspaceId,
  workspaceName,
  members,
  initialWorkDate,
  initialRecords,
}: {
  workspaceId: string;
  workspaceName: string;
  members: MemberProfile[];
  initialWorkDate: string;
  initialRecords: AttendanceRecord[];
}) {
  const [workDate, setWorkDate] = useState(initialWorkDate);
  const [records, setRecords] = useState(initialRecords);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const [exportStart, setExportStart] = useState(startOfMonthString(today));
  const [exportEnd, setExportEnd] = useState(endOfMonthString(today));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const recordByUser = new Map(records.map((r) => [r.user_id, r]));

  async function handleDateChange(value: string) {
    if (!value) return;
    setWorkDate(value);
    setLoading(true);
    try {
      const data = await getAttendanceRecordsForDate(workspaceId, value);
      setRecords(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (exporting) return;
    if (!exportStart || !exportEnd || exportStart > exportEnd) {
      setExportError('Start date must be on or before the end date.');
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const rangeRecords = await getAttendanceRecordsForRange(workspaceId, exportStart, exportEnd);
      const workbook = await buildAttendanceWorkbook({
        workspaceName,
        startDate: exportStart,
        endDate: exportEnd,
        members,
        records: rangeRecords,
      });
      const safeName = (workspaceName || 'workspace').replace(/[\\/:*?"<>|]/g, '-');
      await downloadWorkbook(workbook, `attendance-${safeName}-${exportStart}-to-${exportEnd}.xlsx`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Failed to export attendance.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <Link
          href={`/attendance/${workspaceId}`}
          className="mb-1 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={12} /> Back to my attendance
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">Team Attendance</h1>
        <p className="text-sm text-gray-400">{workspaceName}</p>
      </div>

      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <input
          type="date"
          value={workDate}
          max={todayLocalDateString()}
          onChange={(e) => handleDateChange(e.target.value)}
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
        />
      </div>

      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="max-w-lg rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Export to Excel</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-500">From</span>
              <input
                type="date"
                value={exportStart}
                max={exportEnd || undefined}
                onChange={(e) => setExportStart(e.target.value)}
                className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-gray-500">To</span>
              <input
                type="date"
                value={exportEnd}
                min={exportStart || undefined}
                max={todayLocalDateString()}
                onChange={(e) => setExportEnd(e.target.value)}
                className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#0073ea]"
              />
            </label>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
            >
              <Download size={13} /> {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
          {exportError && <p className="mt-2 text-xs text-red-500">{exportError}</p>}
        </div>
      </div>

      <div className={`flex-1 overflow-auto px-6 py-4 ${loading ? 'opacity-50' : ''}`}>
        {members.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-gray-400">No members in this workspace.</p>
        ) : (
          <div className="max-w-lg space-y-2">
            {members.map((member) => {
              const record = recordByUser.get(member.user_id);
              const status = !record ? 'absent' : record.time_out ? 'complete' : 'in_progress';
              return (
                <div key={member.user_id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: avatarColor(member.user_id) }}
                  >
                    {initials(member)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{displayName(member)}</p>
                    {record ? (
                      <p className="text-xs text-gray-500">
                        {formatClockTime(record.time_in)} – {formatClockTime(record.time_out)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">No record</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      status === 'absent'
                        ? 'bg-red-50 text-red-600'
                        : status === 'in_progress'
                          ? 'bg-[#e6f1fd] text-[#0073ea]'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {status === 'absent' ? 'Absent' : status === 'in_progress' ? 'In progress' : 'Complete'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
