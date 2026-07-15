import type { Column, Item } from '@/types/database';
import { getCellValue } from '@/lib/cell-helpers';
import { rowGridTemplate } from '@/lib/grid';

export function GroupSummaryRow({ columns, items }: { columns: Column[]; items: Item[] }) {
  return (
    <div
      className="grid rounded-b-md border-t border-gray-200 bg-gray-50/70"
      style={{ gridTemplateColumns: rowGridTemplate(columns.length) }}
    >
      <div />
      <div className="px-2 py-1.5 text-[11px] font-medium text-gray-400">
        {items.length} item{items.length === 1 ? '' : 's'}
      </div>
      {columns.map((column) => (
        <div key={column.id} className="flex items-center justify-center px-2 py-1.5">
          {column.type === 'numeric' && <NumericSummary column={column} items={items} />}
          {column.type === 'status' && <StatusSummary column={column} items={items} />}
        </div>
      ))}
      <div />
    </div>
  );
}

function NumericSummary({ column, items }: { column: Column; items: Item[] }) {
  const sum = items.reduce((acc, item) => {
    const cell = getCellValue(column, item);
    return cell.type === 'numeric' ? acc + (cell.value ?? 0) : acc;
  }, 0);

  return <span className="text-[11px] font-semibold text-gray-600">Σ {sum.toLocaleString()}</span>;
}

function StatusSummary({ column, items }: { column: Column; items: Item[] }) {
  const options = column.options.statuses ?? [];
  const total = items.length;
  if (total === 0) return null;

  const counts = options.map((opt) => ({
    ...opt,
    count: items.filter((item) => {
      const cell = getCellValue(column, item);
      return cell.type === 'status' && cell.value === opt.label;
    }).length,
  }));

  const accountedFor = counts.reduce((acc, c) => acc + c.count, 0);
  const blank = total - accountedFor;

  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200" title={`${accountedFor}/${total} set`}>
      {counts
        .filter((c) => c.count > 0)
        .map((c) => (
          <div
            key={c.label}
            style={{ width: `${(c.count / total) * 100}%`, backgroundColor: c.color }}
            title={`${c.label}: ${c.count}`}
          />
        ))}
      {blank > 0 && <div style={{ width: `${(blank / total) * 100}%` }} className="bg-gray-200" />}
    </div>
  );
}
