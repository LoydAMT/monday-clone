'use client';

import { useMemo, useRef, useState } from 'react';
import type { MemberProfile } from '@/types/database';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { mentionToken } from '@/lib/mentions';

export function MentionInput({
  value,
  onChange,
  members,
  placeholder,
  className,
  wrapperClassName = 'relative',
  rows = 2,
  onKeyDown,
  onBlur,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  members: MemberProfile[];
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  rows?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [queryStart, setQueryStart] = useState(0);
  const [highlighted, setHighlighted] = useState(0);

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members.filter((m) => displayName(m).toLowerCase().includes(q)).slice(0, 6);
  }, [query, members]);

  function updateMentionQuery(text: string, caret: number) {
    const upToCaret = text.slice(0, caret);
    const atIndex = upToCaret.lastIndexOf('@');
    if (atIndex === -1 || /[\s\n]/.test(upToCaret.slice(atIndex + 1))) {
      setQuery(null);
      return;
    }
    setQuery(upToCaret.slice(atIndex + 1));
    setQueryStart(atIndex);
    setHighlighted(0);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    updateMentionQuery(e.target.value, e.target.selectionStart);
  }

  function selectMember(member: MemberProfile) {
    const caret = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, queryStart);
    const after = value.slice(caret);
    const token = `${mentionToken(member)} `;
    onChange(before + token + after);
    setQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + token.length;
      ref.current?.setSelectionRange(pos, pos);
      ref.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query !== null && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMember(matches[highlighted]);
        return;
      }
      if (e.key === 'Escape') {
        setQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  }

  return (
    <div className={wrapperClassName}>
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={rows}
        className={className}
      />
      {query !== null && matches.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {matches.map((m, i) => (
            <button
              type="button"
              key={m.user_id}
              onMouseDown={(e) => {
                e.preventDefault();
                selectMember(m);
              }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs ${
                i === highlighted ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                style={{ backgroundColor: avatarColor(m.user_id) }}
              >
                {initials(m)}
              </span>
              <span className="truncate text-gray-700">{displayName(m)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
