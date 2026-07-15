import { parseMentionSegments } from '@/lib/mentions';

export function MentionText({ text, className }: { text: string; className?: string }) {
  const segments = parseMentionSegments(text);
  return (
    <span className={className}>
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
