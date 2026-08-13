'use client';

import type { MemberProfile, SalesCompany, SalesDeal } from '@/types/database';
import { formatDateString, formatMoney, isDueToday, isOverdue } from '@/lib/sales-stages';
import { avatarColor, displayName, initials } from '@/lib/avatar-color';
import { SalesStageBadge } from './SalesStageBadge';

export function SalesDealTable({
  deals,
  companiesById,
  membersByUserId,
  onRowClick,
}: {
  deals: SalesDeal[];
  companiesById: Map<string, SalesCompany>;
  membersByUserId: Map<string, MemberProfile>;
  onRowClick: (deal: SalesDeal) => void;
}) {
  if (deals.length === 0) {
    return <p className="px-1 py-8 text-center text-sm text-gray-400">No deals match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
            <th className="px-2 py-2">Deal</th>
            <th className="px-2 py-2">Company</th>
            <th className="px-2 py-2">Stage</th>
            <th className="px-2 py-2 text-right">Value</th>
            <th className="px-2 py-2">Expected order</th>
            <th className="px-2 py-2">Follow-up</th>
            <th className="px-2 py-2">Owner</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const company = companiesById.get(deal.company_id);
            const owner = deal.owner_id ? membersByUserId.get(deal.owner_id) : undefined;
            const overdue = isOverdue(deal.next_follow_up_on);
            const today = isDueToday(deal.next_follow_up_on);

            return (
              <tr
                key={deal.id}
                onClick={() => onRowClick(deal)}
                className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-2 py-2">
                  <div className="font-medium text-gray-900">{deal.title}</div>
                  {deal.reference_no && <div className="text-xs text-gray-400">{deal.reference_no}</div>}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-gray-600">{company?.name ?? '—'}</td>
                <td className="px-2 py-2">
                  <SalesStageBadge stage={deal.stage} />
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-right font-medium text-gray-900">
                  {deal.value == null ? '—' : formatMoney(deal.value, deal.currency)}
                </td>
                <td className="whitespace-nowrap px-2 py-2 text-gray-600">
                  {formatDateString(deal.expected_order_date)}
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  {deal.next_follow_up_on ? (
                    <span
                      className={
                        overdue ? 'font-medium text-[#e2445c]' : today ? 'font-medium text-[#fdab3d]' : 'text-gray-600'
                      }
                    >
                      {formatDateString(deal.next_follow_up_on)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {owner ? (
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white"
                      style={{ backgroundColor: avatarColor(owner.user_id) }}
                      title={displayName(owner)}
                    >
                      {initials(owner)}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
