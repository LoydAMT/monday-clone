import type { QuotationStatus, SalesActivityType, SalesStage } from '@/types/database';

// The pipeline, in order. Must stay in sync with sales_deals.stage's check
// constraint in supabase/migrations/0019_sales.sql — that constraint is the
// enforcement, this array is the ordering and presentation.
//
// `kind` splits the stages into the three buckets every roll-up cares about:
// still in play, won (a PO is in hand, everything after it is delivery), and
// the single lost off-ramp.
export interface SalesStageMeta {
  id: SalesStage;
  label: string;
  color: string;
  kind: 'open' | 'won' | 'lost';
  description: string;
}

export const SALES_STAGES: readonly SalesStageMeta[] = [
  { id: 'lead', label: 'Lead', color: '#c4c4c4', kind: 'open', description: 'New inquiry, not yet assessed' },
  { id: 'qualified', label: 'Qualified', color: '#66ccff', kind: 'open', description: 'Real budget and requirement confirmed' },
  { id: 'site_inspection', label: 'Site Inspection', color: '#579bfc', kind: 'open', description: 'Site visit scheduled or done' },
  { id: 'quotation_preparation', label: 'Quotation Preparation', color: '#a25ddc', kind: 'open', description: 'Costing and quote being prepared' },
  { id: 'quotation_submitted', label: 'Quotation Submitted', color: '#0073ea', kind: 'open', description: 'Quote sent to the customer' },
  { id: 'follow_up', label: 'Follow-up', color: '#fdab3d', kind: 'open', description: 'Chasing a decision on the quote' },
  { id: 'negotiation', label: 'Negotiation', color: '#ffcb00', kind: 'open', description: 'Price and terms being agreed' },
  { id: 'po_received', label: 'PO Received', color: '#9cd326', kind: 'won', description: 'Purchase order in hand' },
  { id: 'project_awarded', label: 'Project Awarded', color: '#00c875', kind: 'won', description: 'Awarded and handed to delivery' },
  { id: 'completed', label: 'Completed', color: '#037f4c', kind: 'won', description: 'Project delivered and closed out' },
  { id: 'lost', label: 'Lost', color: '#e2445c', kind: 'lost', description: 'Lost to a competitor, cancelled, or no decision' },
] as const;

const STAGE_META = new Map(SALES_STAGES.map((s) => [s.id, s]));

export function stageMeta(stage: SalesStage): SalesStageMeta {
  // Falls back to Lead rather than throwing — a row written by a future
  // migration that adds a stage should still render in an older client.
  return STAGE_META.get(stage) ?? SALES_STAGES[0];
}

export function isWonStage(stage: SalesStage): boolean {
  return stageMeta(stage).kind === 'won';
}

export function isLostStage(stage: SalesStage): boolean {
  return stageMeta(stage).kind === 'lost';
}

export function isClosedStage(stage: SalesStage): boolean {
  return stageMeta(stage).kind !== 'open';
}

// ============================================================================
// Quotation status — smaller lifecycle, same treatment as stages above.
// ============================================================================

export const QUOTATION_STATUSES: readonly { id: QuotationStatus; label: string; color: string }[] = [
  { id: 'draft', label: 'Draft', color: '#c4c4c4' },
  { id: 'submitted', label: 'Submitted', color: '#0073ea' },
  { id: 'accepted', label: 'Accepted', color: '#00c875' },
  { id: 'rejected', label: 'Rejected', color: '#e2445c' },
  { id: 'expired', label: 'Expired', color: '#808080' },
] as const;

export function quotationStatusColor(status: QuotationStatus): string {
  return QUOTATION_STATUSES.find((s) => s.id === status)?.color ?? '#c4c4c4';
}

export const ACTIVITY_TYPES: readonly { id: SalesActivityType; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'call', label: 'Call' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'note', label: 'Note' },
] as const;

// ============================================================================
// Money
// ============================================================================

export const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'JPY'] as const;

export const DEFAULT_CURRENCY = 'PHP';

export function formatMoney(value: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // An unrecognised currency code (hand-edited row, or one added to the
    // column without being added to CURRENCIES) would otherwise throw inside
    // a render — fall back to a plain number rather than blanking the view.
    return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}

// Column headers and stat tiles show a total that can run to eight digits —
// full precision there just pushes the stage label out of the column.
export function formatCompactMoney(value: number, currency = DEFAULT_CURRENCY): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}

// ============================================================================
// Dates — deals use plain `date` columns (expected_order_date,
// next_follow_up_on) and everything else uses timestamptz. The date columns
// are compared as YYYY-MM-DD strings against the *local* today, never parsed
// through `new Date('2026-01-01')` (which reads as UTC midnight and lands on
// the previous day west of Greenwich).
// ============================================================================

export function todayDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false;
  return dateString < todayDateString();
}

export function isDueToday(dateString: string | null): boolean {
  if (!dateString) return false;
  return dateString === todayDateString();
}

// Formats a YYYY-MM-DD column for display without going through the Date
// constructor's UTC parsing, for the reason in the block comment above.
export function formatDateString(dateString: string | null): string {
  if (!dateString) return '—';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// timestamptz columns (activities, site visits, task due dates) — these are
// real instants, so the Date constructor is correct here.
export function formatDateTime(timestamp: string | null): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Converts a timestamptz to the value shape <input type="datetime-local">
// expects (local time, no zone suffix), and back.
export function toDateTimeLocalValue(timestamp: string | null): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
