import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import {
  getInventoryCoverPhotoUrls,
  getInventoryItems,
  getInventoryLocations,
  getInventoryStock,
  getInventoryWorkspace,
  getInventoryWorkspaceMembers,
} from '@/lib/inventory-queries';
import { InventoryView } from '@/components/InventoryView';
import { hasFeature } from '@/lib/permissions';

export default async function InventoryPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  const supabase = await createClient();
  // None of these five depend on each other's results — same reasoning as
  // the board page's batched Promise.all.
  const [{ data: { session } }, workspace, members, locations, items] = await Promise.all([
    supabase.auth.getSession(),
    getInventoryWorkspace(supabase, workspaceId),
    getInventoryWorkspaceMembers(supabase, workspaceId),
    getInventoryLocations(supabase, workspaceId),
    getInventoryItems(supabase, workspaceId),
  ]);
  if (!session) redirect('/login');
  if (!workspace) notFound();
  // RLS already returns nothing to a member without the inventory feature, so
  // this is about showing a 404 instead of a convincingly empty module.
  if (!hasFeature(members.find((m) => m.user_id === session.user.id), 'inventory')) notFound();

  // Needs the item ids resolved above, so it can't join the batch.
  const [stock, coverPhotoUrls] = await Promise.all([
    getInventoryStock(supabase, workspaceId),
    getInventoryCoverPhotoUrls(supabase, items.map((i) => i.id)),
  ]);

  return (
    <InventoryView
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      initialLocations={locations}
      initialItems={items}
      initialStock={stock}
      initialCoverPhotoUrls={coverPhotoUrls}
      members={members}
      currentUserId={session.user.id}
    />
  );
}
