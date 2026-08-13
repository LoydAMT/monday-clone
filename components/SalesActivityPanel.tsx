'use client';

import { useState } from 'react';
import { Mail, Phone, StickyNote, Trash2, Users } from 'lucide-react';
import type { MemberProfile, SalesActivity, SalesActivityDirection, SalesActivityType } from '@/types/database';
import { ACTIVITY_TYPES, formatDateTime, fromDateTimeLocalValue, toDateTimeLocalValue } from '@/lib/sales-stages';
import { createSalesActivity, deleteSalesActivity } from '@/lib/sales-mutations';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { Field, fieldInputClass } from './ui/Field';

const TYPE_ICON: Record<SalesActivityType, typeof Mail> = {
  email: Mail,
  call: Phone,
  meeting: Users,
  note: StickyNote,
};

// The customer communication log. Rendered both on a company profile (all
// correspondence, deal-tagged or not) and inside a deal modal (that deal's
// thread only) — `dealId` decides which of the two, and is stamped onto
// anything logged from the deal side.
export function SalesActivityPanel({
  companyId,
  dealId,
  activities,
  membersByUserId,
  canEdit,
  onChange,
  showDealColumn = false,
  dealTitleById,
}: {
  companyId: string;
  dealId: string | null;
  activities: SalesActivity[];
  membersByUserId: Map<string, MemberProfile>;
  canEdit: boolean;
  onChange: (next: SalesActivity[]) => void;
  showDealColumn?: boolean;
  dealTitleById?: Map<string, string>;
}) {
  const [type, setType] = useState<SalesActivityType>('email');
  const [direction, setDirection] = useState<SalesActivityDirection | ''>('outbound');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeLocalValue(new Date().toISOString()));
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLog() {
    if (!subject.trim() && !body.trim()) {
      setError('Add a subject or a note');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const created = await createSalesActivity(companyId, {
        deal_id: dealId,
        type,
        // A note has no inbound/outbound sense; the DB allows null, so don't
        // invent a direction for it.
        direction: type === 'note' ? null : direction || null,
        subject: subject.trim() || null,
        body: body.trim() || null,
        occurred_at: fromDateTimeLocalValue(occurredAt) ?? new Date().toISOString(),
      });
      onChange([created, ...activities]);
      setSubject('');
      setBody('');
      setOccurredAt(toDateTimeLocalValue(new Date().toISOString()));
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log activity');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(activityId: string) {
    const previous = activities;
    setError(null);
    onChange(activities.filter((a) => a.id !== activityId));
    try {
      await deleteSalesActivity(activityId);
    } catch (e) {
      onChange(previous);
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Communications {activities.length > 0 && `(${activities.length})`}
      </h3>

      {canEdit && (
        <div className="mb-3 rounded border border-gray-200 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as SalesActivityType)}
              className="rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0073ea]"
            >
              {ACTIVITY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            {type !== 'note' && (
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as SalesActivityDirection | '')}
                className="rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0073ea]"
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
                <option value="">Unspecified</option>
              </select>
            )}

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setExpanded(true)}
              placeholder={type === 'note' ? 'Note title' : 'Subject'}
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-[#0073ea]"
            />
          </div>

          {expanded && (
            <>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="What was said…"
                className="mt-2 w-full resize-none rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-[#0073ea]"
              />
              <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                <Field label="When">
                  <input
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                    className={`${fieldInputClass} text-xs`}
                  />
                </Field>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setExpanded(false);
                      setSubject('');
                      setBody('');
                      setError(null);
                    }}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLog}
                    disabled={saving}
                    className="rounded-md bg-[#0073ea] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0060c2] disabled:opacity-50"
                  >
                    {saving ? 'Logging…' : 'Log it'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}

      {activities.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400">Nothing logged yet.</p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => {
            const Icon = TYPE_ICON[activity.type] ?? StickyNote;
            const author = activity.created_by ? membersByUserId.get(activity.created_by) : undefined;
            const dealTitle = showDealColumn && activity.deal_id ? dealTitleById?.get(activity.deal_id) : undefined;

            return (
              <div key={activity.id} className="group flex gap-2 rounded border border-gray-100 px-2 py-2">
                <Icon size={14} className="mt-0.5 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800">
                      {activity.subject || ACTIVITY_TYPES.find((t) => t.id === activity.type)?.label}
                    </span>
                    {activity.direction && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                        {activity.direction === 'inbound' ? 'From customer' : 'To customer'}
                      </span>
                    )}
                    {dealTitle && (
                      <span className="truncate rounded bg-[#e6f1fd] px-1.5 py-0.5 text-[10px] text-[#0073ea]">{dealTitle}</span>
                    )}
                  </div>
                  {activity.body && <p className="mt-0.5 whitespace-pre-wrap text-xs text-gray-600">{activity.body}</p>}
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-400">
                    {author && (
                      <span
                        className="flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-semibold text-white"
                        style={{ backgroundColor: avatarColor(author.user_id) }}
                      >
                        {initials(author)}
                      </span>
                    )}
                    {author && <span>{displayName(author)}</span>}
                    <span>· {formatDateTime(activity.occurred_at)}</span>
                  </div>
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(activity.id)}
                    title="Delete entry"
                    className="shrink-0 self-start text-gray-300 opacity-100 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
