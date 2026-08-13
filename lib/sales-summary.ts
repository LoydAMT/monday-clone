import type { SalesCompanySummary, SalesDeal, SalesStage } from '@/types/database';
import { DEFAULT_CURRENCY, isLostStage, isWonStage, SALES_STAGES } from '@/lib/sales-stages';

// Pure roll-ups over an already-loaded deal list, mirroring how
// lib/inventory-stock.ts summarizes stock rows the page already fetched —
// so the company directory and the pipeline header don't each need their own
// aggregate query.

export interface PipelineTotals {
  openCount: number;
  openValue: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  /** Value that walked out the door — the counterpart to wonValue. */
  lostValue: number;
  /** Currency the totals are labelled with — see mixedCurrency. */
  currency: string;
  /**
   * True when the deals summed here don't all share one currency. Values are
   * still added up as plain numbers (there are no FX rates in this system),
   * so the UI flags the total as approximate rather than quietly presenting a
   * cross-currency sum as exact.
   */
  mixedCurrency: boolean;
}

export function dominantCurrency(deals: SalesDeal[]): { currency: string; mixed: boolean } {
  const counts = new Map<string, number>();
  for (const deal of deals) counts.set(deal.currency, (counts.get(deal.currency) ?? 0) + 1);
  if (counts.size === 0) return { currency: DEFAULT_CURRENCY, mixed: false };

  let best = DEFAULT_CURRENCY;
  let bestCount = -1;
  for (const [currency, count] of counts) {
    if (count > bestCount) {
      best = currency;
      bestCount = count;
    }
  }
  return { currency: best, mixed: counts.size > 1 };
}

export function pipelineTotals(deals: SalesDeal[]): PipelineTotals {
  const { currency, mixed } = dominantCurrency(deals);
  const totals: PipelineTotals = {
    openCount: 0,
    openValue: 0,
    wonCount: 0,
    wonValue: 0,
    lostCount: 0,
    lostValue: 0,
    currency,
    mixedCurrency: mixed,
  };

  for (const deal of deals) {
    const value = deal.value ?? 0;
    if (isWonStage(deal.stage)) {
      totals.wonCount += 1;
      totals.wonValue += value;
    } else if (isLostStage(deal.stage)) {
      totals.lostCount += 1;
      totals.lostValue += value;
    } else {
      totals.openCount += 1;
      totals.openValue += value;
    }
  }

  return totals;
}

export function summarizeCompanyDeals(deals: SalesDeal[]): Record<string, SalesCompanySummary> {
  const byCompany: Record<string, SalesCompanySummary> = {};

  for (const deal of deals) {
    const summary = (byCompany[deal.company_id] ??= {
      dealCount: 0,
      openCount: 0,
      wonCount: 0,
      lostCount: 0,
      openValue: 0,
      wonValue: 0,
      nextFollowUpOn: null,
    });

    summary.dealCount += 1;
    const value = deal.value ?? 0;

    if (isWonStage(deal.stage)) {
      summary.wonCount += 1;
      summary.wonValue += value;
    } else if (isLostStage(deal.stage)) {
      summary.lostCount += 1;
    } else {
      summary.openCount += 1;
      summary.openValue += value;
      // Only open deals can have a live follow-up — a closed deal's stale
      // date shouldn't keep surfacing the company as needing a chase.
      if (deal.next_follow_up_on && (!summary.nextFollowUpOn || deal.next_follow_up_on < summary.nextFollowUpOn)) {
        summary.nextFollowUpOn = deal.next_follow_up_on;
      }
    }
  }

  return byCompany;
}

export function groupDealsByStage(deals: SalesDeal[]): Record<SalesStage, SalesDeal[]> {
  const grouped = {} as Record<SalesStage, SalesDeal[]>;
  for (const stage of SALES_STAGES) grouped[stage.id] = [];
  for (const deal of deals) (grouped[deal.stage] ??= []).push(deal);
  return grouped;
}

export function sumDealValues(deals: SalesDeal[]): number {
  return deals.reduce((total, deal) => total + (deal.value ?? 0), 0);
}
