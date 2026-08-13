import type { BoardAccess, MemberProfile, WorkspaceFeature, WorkspaceRole } from '@/types/database';

// The modules a workspace member can be granted or denied. Must stay in sync
// with workspace_members.features' check constraint in
// supabase/migrations/0020_granular_access.sql — that constraint is the
// enforcement, this list is the presentation.
export const WORKSPACE_FEATURES: readonly WorkspaceFeature[] = [
  'boards',
  'inventory',
  'attendance',
  'sales',
] as const;

export const FEATURE_LABELS: Record<WorkspaceFeature, string> = {
  boards: 'Boards',
  inventory: 'Inventory',
  attendance: 'Attendance',
  sales: 'Sales',
};

export const FEATURE_DESCRIPTIONS: Record<WorkspaceFeature, string> = {
  boards: 'Work boards, items and everything on them',
  inventory: 'Stock levels, locations and adjustments',
  attendance: 'Clock in/out records',
  sales: 'Customers, deals, quotations and the pipeline',
};

/**
 * Whether a member may reach a module.
 *
 * This mirrors the can_view_module() SQL helper exactly, including the
 * "owners are never restricted" rule. It exists to decide what to *show* —
 * RLS is what actually protects the data, so a mismatch here is a cosmetic
 * bug, never a security hole.
 */
export function hasFeature(
  member: Pick<MemberProfile, 'role' | 'features'> | undefined,
  feature: WorkspaceFeature
): boolean {
  if (!member) return false;
  if (member.role === 'owner') return true;
  return member.features.includes(feature);
}

export function isOwner(member: Pick<MemberProfile, 'role'> | undefined): boolean {
  return member?.role === 'owner';
}

export function canEdit(member: Pick<MemberProfile, 'role'> | undefined): boolean {
  return member?.role === 'owner' || member?.role === 'member';
}

export function roleLabel(role: WorkspaceRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function boardAccessLabel(access: BoardAccess, grantedCount: number): string {
  return access === 'all' ? 'All boards' : `${grantedCount} board${grantedCount === 1 ? '' : 's'}`;
}
