'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { MemberProfile } from '@/types/database';
import { MentionInput } from '../MentionInput';
import { MentionText } from '../MentionText';
import { displayName } from '@/lib/avatar-color';
import { applyMentionTokens, stripMentionTokensForEditing, type DraftMention } from '@/lib/mentions';

const MAX_LINES = 3;
const MIN_FONT_PX = 8;
// Tailwind's text-xs sets a fixed rem line-height (1rem), which does not
// scale down as font-size shrinks — measuring against it would make the
// loop below think shrinking barely helps, since the line box stays ~16px
// tall regardless of font-size. A unitless line-height scales with
// font-size instead, so it's applied only while a title is actually being
// shrunk (the common short-title case is left with Tailwind's own default).
const SHRUNK_LINE_HEIGHT_RATIO = 1.3;

// Never truncates — instead of an ellipsis, a title that would wrap past
// MAX_LINES at its normal size shrinks (in 1px steps) until it fits, so the
// full name stays visible instead of being cut off. Re-measures whenever the
// text or the cell's own width changes (column resize, mobile narrow-on-
// scroll, window resize all change the latter). Disabled on mobile (see
// `compact` below) — screen space is tight enough there that a shrinking
// title would quickly become unreadably small, so mobile just clamps to two
// lines and truncates the rest instead.
function useShrinkToFit(text: string, enabled: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (!enabled) {
      el.style.fontSize = '';
      el.style.lineHeight = '';
      setStyle({});
      return;
    }

    function measure() {
      if (!el) return;
      el.style.fontSize = '';
      el.style.lineHeight = '';
      const baseSize = parseFloat(getComputedStyle(el).fontSize);
      let size = baseSize;

      el.style.lineHeight = String(SHRUNK_LINE_HEIGHT_RATIO);
      while (size > MIN_FONT_PX) {
        const lines = Math.round(el.scrollHeight / (size * SHRUNK_LINE_HEIGHT_RATIO));
        if (lines <= MAX_LINES) break;
        size -= 1;
        el.style.fontSize = `${size}px`;
      }

      if (size === baseSize) {
        el.style.lineHeight = '';
        setStyle({});
      } else {
        setStyle({ fontSize: size, lineHeight: SHRUNK_LINE_HEIGHT_RATIO });
      }
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, enabled]);

  return { ref, style };
}

export function TextCell({
  value,
  onChange,
  members = [],
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  members?: MemberProfile[];
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [draftMentions, setDraftMentions] = useState<DraftMention[]>([]);
  const [editing, setEditing] = useState(false);
  const { ref: fitRef, style: fitStyle } = useShrinkToFit(value, !compact);

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
        className="w-full whitespace-normal break-words px-2 py-1 text-left text-gray-700 hover:bg-gray-50"
      >
        {value ? (
          <MentionText
            ref={fitRef}
            text={value}
            className={`text-xs max-sm:text-[10px] ${compact ? 'line-clamp-2' : ''}`}
            style={fitStyle}
          />
        ) : (
          <span className="text-xs text-gray-300 max-sm:text-[10px]">Empty</span>
        )}
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
