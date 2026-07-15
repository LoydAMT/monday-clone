import type { MemberProfile } from '@/types/database';
import { displayName } from './avatar-color';

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

export function mentionToken(member: MemberProfile): string {
  return `@[${displayName(member)}](${member.user_id})`;
}

// For plain-text previews (e.g. notification list rows) that can't render
// MentionText's styled spans — collapses `@[Name](id)` down to `@Name`.
export function stripMentionTokens(text: string): string {
  return text.replace(MENTION_REGEX, (_, name) => `@${name}`);
}
