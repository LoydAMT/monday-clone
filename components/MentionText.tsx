import { forwardRef } from 'react';
import { parseMentionSegments } from '@/lib/mentions';

export const MentionText = forwardRef<HTMLSpanElement, { text: string; className?: string; style?: React.CSSProperties }>(
  function MentionText({ text, className, style }, ref) {
    const segments = parseMentionSegments(text);
    return (
      <span ref={ref} className={className} style={style}>
        {segments.map((seg, i) =>
          seg.type === 'mention' ? (
            <span key={i} className="rounded bg-blue-50 px-1 font-medium text-[#0073ea]">
              @{seg.name}
            </span>
          ) : (
            <span key={i}>{seg.value}</span>
          )
        )}
      </span>
    );
  }
);
