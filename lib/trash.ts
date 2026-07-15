import { createClient } from '@/utils/supabase/client';
import type { Item } from '@/types/database';

const supabase = createClient();

export async function getTrashedItems(groupIds: string[]): Promise<Item[]> {
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from('items')
    .select('*')
    .in('group_id', groupIds)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
