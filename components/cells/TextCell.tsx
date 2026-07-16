'use client';

import { useState } from 'react';
import type { MemberProfile } from '@/types/database';
import { MentionInput } from '../MentionInput';
import { MentionText } from '../MentionText';
import { displayName } from '@/lib/avatar-color';
import { applyMentionTokens, stripMentionTokensForEditing, type DraftMention } from '@/lib/mentions';

export function TextCell({
  value,
  onChange,
  members = [],
}: {
  value: string;
  onChange: (value: string) => void;
  members?: MemberProfile[];
}) {
  const [draft, setDraft] = useState(value);
  const [draftMentions, setDraftMentions] = useState<DraftMention[]>([]);
  const [editing, setEditing] = useState(false);

  function startEditing() {
    const stripped = stripMentionTokensForEditing(value);
    setDraft(stripped.text);
    setDraftMentions(stripped.mentions);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const tokenized = applyMentionTokens(draft, draftMentions);
    if (tokenized !== value) onChange(tokenized);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        title={value || undefined}
        className="h-full w-full truncate px-2 text-left text-xs text-gray-700 max-sm:text-[10px] hover:bg-gray-50"
      >
        {value ? <MentionText text={value} /> : <span className="text-gray-300">Empty</span>}
      </button>
    );
  }

  return (
    <MentionInput
      autoFocus
      value={draft}
      onChange={setDraft}
      onMention={(m) => setDraftMentions((prev) => [...prev, { name: displayName(m), userId: m.user_id }])}
      members={members}
      rows={1}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      }}
      wrapperClassName="relative h-full w-full"
      className="h-full w-full resize-none overflow-hidden border-2 border-[#0073ea] px-2 py-1 text-xs outline-none"
    />
  );
}
