import { createClient } from '@/utils/supabase/client';
import type { ReverseLinkedItem } from '@/types/database';
import { logActivity } from '@/lib/mutations';

const supabase = createClient();

// Search/add/remove/reverse-lookup are all per-item-open, incremental
// operations — not part of the initial board load, same split as
// lib/attachments.ts (getAttachments is client-only, fetched when
// AttachmentsList mounts) vs. the server-batched attachmentCounts summary in
// lib/queries.ts. The forward summary (linkedRecordsByCell, needed for
// closed-cell chips at initial load) lives in lib/queries.ts instead.

export async function searchBoardItems(
  boardId: string,
  query: string,
  excludeItemIds: string[]
): Promise<{ id: string; title: string }[]> {
  let q = supabase
    .from('items')
    .select('id, title, groups!inner(board_id)')
    .eq('groups.board_id', boardId)
    .is('parent_item_id', null)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .limit(20);
  if (query.trim()) q = q.ilike('title', `%${query.trim()}%`);
  // PostgREST errors on an empty in() list, so this filter is only added
  // when there's actually something to exclude.
  if (excludeItemIds.length) q = q.not('id', 'in', `(${excludeItemIds.join(',')})`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(({ id, title }) => ({ id, title }));
}

export async function addLinkedItem(
  columnId: string,
  columnName: string,
  sourceItemId: string,
  targetItemId: string,
  targetTitle: string
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('linked_items')
    .insert({ column_id: columnId, source_item_id: sourceItemId, target_item_id: targetItemId })
    .select('id')
    .single();
  if (error || !data) throw error;

  logActivity(sourceItemId, 'linked_item_added', { column_name: columnName, target_title: targetTitle });

  return data;
}

export async function removeLinkedItem(linkId: string, sourceItemId: string, columnName: string, targetTitle: string) {
  const { error } = await supabase.from('linked_items').delete().eq('id', linkId);
  if (error) throw error;

  logActivity(sourceItemId, 'linked_item_removed', { column_name: columnName, target_title: targetTitle });
}

// Items elsewhere (any board, any linked_record column) that link INTO this
// item — powers ItemDetailModal's "Linked from" section. Computed live
// rather than requiring a matching column configured on both boards.
export async function getLinkedFrom(itemId: string): Promise<ReverseLinkedItem[]> {
  const { data, error } = await supabase
    .from('linked_items')
    .select(
      `id,
       column:columns(name),
       source:items!linked_items_source_item_id_fkey(id, title, deleted_at, groups(board_id, boards(id, name)))`
    )
    .eq('target_item_id', itemId);
  if (error) throw error;

  // Untyped Supabase client infers every to-one embed as an array — each of
  // these (linked_items -> columns, linked_items -> items, items -> groups,
  // groups -> boards) is actually a single row or null at runtime via its FK.
  type Row = {
    id: string;
    column: { name: string } | null;
    source: {
      id: string;
      title: string;
      deleted_at: string | null;
      groups: { board_id: string; boards: { id: string; name: string } } | null;
    } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  return rows
    .filter((row) => row.source && !row.source.deleted_at && row.source.groups)
    .map((row) => ({
      linkId: row.id,
      itemId: row.source!.id,
      title: row.source!.title,
      boardId: row.source!.groups!.boards.id,
      boardName: row.source!.groups!.boards.name,
      columnName: row.column?.name ?? 'Linked record',
    }));
}
