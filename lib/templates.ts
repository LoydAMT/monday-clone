import { DEFAULT_STATUS_OPTIONS } from '@/types/database';
import type { ColumnOptions, ColumnType } from '@/types/database';

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  groups: { name: string; color: string }[];
  columns: { name: string; type: ColumnType; options?: ColumnOptions }[];
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'product-launch',
    name: 'Product Launch',
    description: 'Plan and track a product release from kickoff to launch.',
    groups: [
      { name: 'Planning', color: '#579bfc' },
      { name: 'In Progress', color: '#fdab3d' },
      { name: 'Launched', color: '#00c875' },
    ],
    columns: [
      { name: 'Status', type: 'status', options: { statuses: DEFAULT_STATUS_OPTIONS } },
      { name: 'Owner', type: 'people' },
      { name: 'Due Date', type: 'date' },
      {
        name: 'Priority',
        type: 'dropdown',
        options: { tags: [{ label: 'Low', color: '#00c875' }, { label: 'Medium', color: '#fdab3d' }, { label: 'High', color: '#e2445c' }] },
      },
    ],
  },
  {
    id: 'sprint-planning',
    name: 'Sprint Planning',
    description: 'Track a sprint’s backlog, in-progress work, and completions.',
    groups: [
      { name: 'Backlog', color: '#c4c4c4' },
      { name: 'This Sprint', color: '#579bfc' },
      { name: 'Done', color: '#00c875' },
    ],
    columns: [
      { name: 'Status', type: 'status', options: { statuses: DEFAULT_STATUS_OPTIONS } },
      { name: 'Assignee', type: 'people' },
      { name: 'Story Points', type: 'numeric' },
      { name: 'Sprint Dates', type: 'timeline' },
    ],
  },
  {
    id: 'bug-tracker',
    name: 'Bug Tracker',
    description: 'Log, triage, and resolve bugs.',
    groups: [
      { name: 'Reported', color: '#e2445c' },
      { name: 'In Progress', color: '#fdab3d' },
      { name: 'Resolved', color: '#00c875' },
    ],
    columns: [
      {
        name: 'Severity',
        type: 'dropdown',
        options: { tags: [{ label: 'Critical', color: '#e2445c' }, { label: 'Major', color: '#fdab3d' }, { label: 'Minor', color: '#579bfc' }] },
      },
      { name: 'Status', type: 'status', options: { statuses: DEFAULT_STATUS_OPTIONS } },
      { name: 'Reporter', type: 'people' },
      { name: 'Link', type: 'link' },
    ],
  },
];
