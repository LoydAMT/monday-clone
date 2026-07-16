import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
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

// Interpolated into the email's HTML below — item titles and comment bodies
// are free-form user input, so without this a crafted title/comment could
// inject markup (e.g. a fake login link) into another member's inbox.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: 'RESEND_API_KEY not configured' });

  // This route runs on the service-role client below (bypasses RLS) so it
  // can look up a recipient's email — which means this auth check is the
  // only thing stopping any signed-in user from emailing an arbitrary
  // userId with an arbitrary subject/body. proxy.ts already requires a
  // session to reach this route at all, but doesn't know about workspace
  // membership, so that part still has to happen here.
  const authClient = await createServerClient();
  const {
    data: { user: caller },
  } = await authClient.auth.getUser();
  if (!caller) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { userId, type, payload } = (await request.json()) as {
    userId: string;
    type: string;
    payload: Record<string, unknown>;
  };
  if (!EMAIL_TYPES.has(type)) return NextResponse.json({ skipped: 'type not email-eligible' });

  // Every call site for these two types attaches board_id — without it there
  // is nothing to check membership against, so treat it as required rather
  // than trusting an unscoped request.
  const boardId = payload.board_id as string | undefined;
  if (!boardId) return NextResponse.json({ skipped: 'no board_id on payload' });

  const supabase = createServiceClient();
  const { data: board } = await supabase
    .from('boards')
    .select('workspace_id, email_notifications_enabled')
    .eq('id', boardId)
    .maybeSingle();
  if (!board) return NextResponse.json({ skipped: 'board not found' });
  if (!board.email_notifications_enabled) {
    return NextResponse.json({ skipped: 'email notifications disabled for this board' });
  }

  // Caller must belong to the board's workspace (otherwise they have no
  // business triggering a notification on it), and the recipient must too
  // (otherwise this becomes a way to email anyone in the profiles table).
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', board.workspace_id)
    .in('user_id', [caller.id, userId]);
  const memberIds = new Set((memberships ?? []).map((m) => m.user_id));
  if (!memberIds.has(caller.id)) return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
  if (!memberIds.has(userId)) return NextResponse.json({ skipped: 'recipient not in this workspace' });

  const { data: recipient } = await supabase.from('profiles').select('email, full_name').eq('id', userId).maybeSingle();
  if (!recipient) return NextResponse.json({ skipped: 'recipient not found' }, { status: 200 });

  const itemId = payload.item_id as string | undefined;
  let itemTitle = payload.item_title as string | undefined;
  if (!itemTitle && itemId) {
    const { data: item } = await supabase.from('items').select('title').eq('id', itemId).maybeSingle();
    itemTitle = item?.title || 'an item';
  }
  itemTitle = itemTitle || 'an item';

  const link = new URL(`/board/${boardId}${itemId ? `?item=${itemId}` : ''}`, request.nextUrl.origin).toString();

  const subject =
    type === 'assigned_to_item'
      ? `You were assigned to "${itemTitle}"`
      : `You were mentioned on "${itemTitle}"`;
  const bodyPreview = type === 'mentioned_in_comment' ? stripMentionTokens((payload.body as string) ?? '').slice(0, 200) : null;

  const html = `
    <p>${escapeHtml(subject)}.</p>
    ${bodyPreview ? `<p style="color:#666">"${escapeHtml(bodyPreview)}"</p>` : ''}
    <p><a href="${link}">Open in work-boards</a></p>
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
