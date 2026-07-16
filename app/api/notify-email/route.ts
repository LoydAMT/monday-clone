import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/utils/supabase/service';
import { stripMentionTokens } from '@/lib/mentions';

// Sends an email for the two notification types you're not otherwise likely
// to see soon (assigned to an item, mentioned in a comment) — everything
// else stays in-app only. Called fire-and-forget from
// lib/notifications.ts's createNotification, which is the single funnel
// every notification already goes through, so no other call site needs to
// know this exists.
//
// Requires a RESEND_API_KEY in .env.local (sign up at resend.com — the
// sandbox sender only delivers to your own account email until you verify a
// sending domain). Until that's set, this silently no-ops so the rest of
// the app is unaffected. RESEND_FROM_EMAIL sets the sender; when it's a
// dedicated sending subdomain (recommended, isolates reputation) with no
// real inbox behind it, RESEND_REPLY_TO routes replies to a real mailbox
// instead — optional, omit it to leave replies going nowhere.

const EMAIL_TYPES = new Set(['assigned_to_item', 'mentioned_in_comment']);

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: 'RESEND_API_KEY not configured' });

  const { userId, type, payload } = (await request.json()) as {
    userId: string;
    type: string;
    payload: Record<string, unknown>;
  };
  if (!EMAIL_TYPES.has(type)) return NextResponse.json({ skipped: 'type not email-eligible' });

  const supabase = createServiceClient();
  const { data: recipient } = await supabase.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
  if (!recipient) return NextResponse.json({ skipped: 'recipient not found' }, { status: 200 });

  const boardId = payload.board_id as string | undefined;
  const itemId = payload.item_id as string | undefined;
  let itemTitle = payload.item_title as string | undefined;
  if (!itemTitle && itemId) {
    const { data: item } = await supabase.from('items').select('title').eq('id', itemId).maybeSingle();
    itemTitle = item?.title || 'an item';
  }

  const link = boardId ? new URL(`/board/${boardId}${itemId ? `?item=${itemId}` : ''}`, request.nextUrl.origin).toString() : null;

  const subject =
    type === 'assigned_to_item'
      ? `You were assigned to "${itemTitle}"`
      : `You were mentioned on "${itemTitle}"`;
  const bodyPreview = type === 'mentioned_in_comment' ? stripMentionTokens((payload.body as string) ?? '').slice(0, 200) : null;

  const html = `
    <p>${subject}.</p>
    ${bodyPreview ? `<p style="color:#666">"${bodyPreview}"</p>` : ''}
    ${link ? `<p><a href="${link}">Open in work-boards</a></p>` : ''}
  `.trim();

  const replyTo = process.env.RESEND_REPLY_TO;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: recipient.email,
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 502 });
  return NextResponse.json({ sent: true });
}
