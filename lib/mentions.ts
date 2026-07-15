// Mentions are stored inline in the raw text as `@[Display Name](user_id)` —
// simple enough to regex out for rendering/notifications without a separate
// join table, and the name is captured at mention-time so it still reads
// correctly even if that person later renames themselves or leaves.
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

export type MentionSegment = { type: 'text'; value: string } | { type: 'mention'; name: string; userId: string };

export function parseMentionSegments(text: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MENTION_REGEX)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ type: 'text', value: text.slice(lastIndex, index) });
    segments.push({ type: 'mention', name: match[1], userId: match[2] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) });
  return segments;
}

export function extractMentionedUserIds(text: string): string[] {
  return [...new Set([...text.matchAll(MENTION_REGEX)].map((m) => m[2]))];
}

// For plain-text previews (e.g. notification list rows) that can't render
// MentionText's styled spans — collapses `@[Name](id)` down to `@Name`.
export function stripMentionTokens(text: string): string {
  return text.replace(MENTION_REGEX, (_, name) => `@${name}`);
}

export interface DraftMention {
  name: string;
  userId: string;
}

// A plain <textarea> can't render an inline styled "chip" while still being
// edited, so the editable draft only ever holds plain `@Name` text — the
// `@[Name](id)` storage token is applied once, right before the text leaves
// the input (on comment submit / cell blur). Longest names first so e.g.
// "@Jo" doesn't get tokenized inside an already-matched "@Jo Ann".
export function applyMentionTokens(text: string, mentions: DraftMention[]): string {
  const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length);
  let result = text;
  for (const { name, userId } of sorted) {
    const plain = `@${name}`;
    if (result.includes(plain)) result = result.split(plain).join(`@[${name}](${userId})`);
  }
  return result;
}

// The inverse — used when re-opening already-saved text (e.g. a Text column
// cell) for editing, so previously-inserted mentions go back to plain `@Name`
// in the draft instead of showing raw `@[Name](id)` markup while editing.
export function stripMentionTokensForEditing(text: string): { text: string; mentions: DraftMention[] } {
  const mentions: DraftMention[] = [];
  const plain = text.replace(MENTION_REGEX, (_match, name, userId) => {
    mentions.push({ name, userId });
    return `@${name}`;
  });
  return { text: plain, mentions };
}
