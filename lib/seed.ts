import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_STATUS_OPTIONS, type CellValue } from '@/types/database';

// Creates a demo workspace/board so a brand-new account has something to explore.
// Runs once per user — skipped as soon as they own at least one workspace.
export async function ensureSeedData(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (count && count > 0) return;

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({ name: 'My Workspace', user_id: userId })
    .select()
    .single();
  if (workspaceError || !workspace) return;

  const { data: board, error: boardError } = await supabase
    .from('boards')
    .insert({
      workspace_id: workspace.id,
      name: 'Product Launch',
      description: 'Track everything for the Q3 product launch.',
      position: 0,
    })
    .select()
    .single();
  if (boardError || !board) return;

  const statusOptions = DEFAULT_STATUS_OPTIONS;

  const { data: columns, error: columnsError } = await supabase
    .from('columns')
    .insert([
      { board_id: board.id, name: 'Status', type: 'status', options: { statuses: statusOptions }, position: 0 },
      { board_id: board.id, name: 'Owner', type: 'people', options: {}, position: 1 },
      { board_id: board.id, name: 'Due Date', type: 'date', options: {}, position: 2 },
      { board_id: board.id, name: 'Budget', type: 'numeric', options: {}, position: 3 },
    ])
    .select();
  if (columnsError || !columns) return;

  const statusCol = columns.find((c) => c.name === 'Status')!;
  const peopleCol = columns.find((c) => c.name === 'Owner')!;
  const dateCol = columns.find((c) => c.name === 'Due Date')!;
  const numericCol = columns.find((c) => c.name === 'Budget')!;

  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .insert([
      { board_id: board.id, name: 'This Month', color: '#00c875', position: 0 },
      { board_id: board.id, name: 'Backlog', color: '#579bfc', position: 1 },
    ])
    .select();
  if (groupsError || !groups) return;

  const thisMonth = groups.find((g) => g.name === 'This Month')!;
  const backlog = groups.find((g) => g.name === 'Backlog')!;

  const cell = (
    status: string,
    people: string[],
    date: string | null,
    numeric: number | null
  ): Record<string, CellValue> => ({
    [statusCol.id]: { type: 'status', value: status },
    [peopleCol.id]: { type: 'people', value: people },
    [dateCol.id]: { type: 'date', value: date },
    [numericCol.id]: { type: 'numeric', value: numeric },
  });

  await supabase.from('items').insert([
    {
      group_id: thisMonth.id,
      title: 'Finalize landing page copy',
      position: 0,
      cells: cell('Done', ['p1'], '2026-07-10', 1200),
    },
    {
      group_id: thisMonth.id,
      title: 'Set up analytics tracking',
      position: 1,
      cells: cell('Working on it', ['p2'], '2026-07-18', 800),
    },
    {
      group_id: thisMonth.id,
      title: 'Coordinate press release',
      position: 2,
      cells: cell('Stuck', ['p3', 'p4'], '2026-07-15', 2400),
    },
    {
      group_id: backlog.id,
      title: 'Explore paid ad channels',
      position: 0,
      cells: cell('Working on it', ['p5'], null, 5000),
    },
    {
      group_id: backlog.id,
      title: 'Redesign onboarding flow',
      position: 1,
      cells: cell('Stuck', [], null, null),
    },
  ]);
}
