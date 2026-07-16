import { createServiceClient } from '@/utils/supabase/service';
import { getBoardContents } from '@/lib/queries';
import { GuestBoardView } from '@/components/GuestBoardView';

function InvalidLink() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 bg-[#f6f7fb] px-6 text-center">
      <p className="text-base font-semibold text-gray-900">This link is no longer valid</p>
      <p className="text-sm text-gray-500">Ask whoever shared it with you for a new one.</p>
    </div>
  );
}

export default async function SharedBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Service-role client: this route runs with no Supabase session at all
  // (guests aren't signed in), so RLS can't grant access — the unguessable
  // token is the authorization check, verified here before any board data
  // is read.
  const supabase = createServiceClient();

  const { data: link } = await supabase
    .from('board_share_links')
    .select('board_id, revoked_at')
    .eq('token', token)
    .maybeSingle();
  if (!link || link.revoked_at) return <InvalidLink />;

  const { data: board } = await supabase.from('boards').select('*').eq('id', link.board_id).maybeSingle();
  if (!board) return <InvalidLink />;

  const contents = await getBoardContents(supabase, link.board_id);

  return <GuestBoardView board={board} columns={contents.columns} groups={contents.groups} items={contents.items} />;
}
