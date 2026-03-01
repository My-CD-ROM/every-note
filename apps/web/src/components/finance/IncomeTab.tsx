import { useFinanceStore } from '@/stores/finance-store';
import { EditableCell } from './EditableCell';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ESV_MONTHLY = 1910;

function fmt(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

export function IncomeTab() {
  const { year, incomeEntries, upsertIncome } = useFinanceStore();

  const getGross = (month: number): number => {
    return incomeEntries.find((e) => e.year === year && e.month === month)?.gross ?? 0;
  };

  const getNet = (month: number) => getGross(month) * 0.92;
  const getEP = (month: number) => getGross(month) * 0.05;
  const getESV = (month: number) => (getGross(month) > 0 ? ESV_MONTHLY : 0);
  const getTotalTax = (month: number) => getESV(month) + getEP(month);

  const sumRange = (fn: (m: number) => number, from: number, to: number) => {
    let s = 0;
    for (let m = from; m <= to; m++) s += fn(m);
    return s;
  };

  const quarters = [
    { label: 'Q1', from: 1, to: 3 },
    { label: 'Q2', from: 4, to: 6 },
    { label: 'Q3', from: 7, to: 9 },
    { label: 'Q4', from: 10, to: 12 },
  ];

  type Row = { label: string; getValue: (month: number) => number; editable: boolean };

  const rows: Row[] = [
    { label: 'Брутто', getValue: getGross, editable: true },
    { label: 'Нетто', getValue: getNet, editable: false },
    { label: 'ЄСВ', getValue: getESV, editable: false },
    { label: 'ЄП (5%)', getValue: getEP, editable: false },
    { label: 'Всього податків', getValue: getTotalTax, editable: false },
  ];

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left px-2 py-2 font-medium text-muted-foreground min-w-[140px] sticky left-0 bg-background z-10" />
            {MONTHS.map((m) => (
              <th key={m} className="text-right px-2 py-2 font-medium text-muted-foreground min-w-[90px]">
                {m}
              </th>
            ))}
            {quarters.map((q) => (
              <th key={q.label} className="text-right px-2 py-2 font-medium text-muted-foreground/80 min-w-[100px] bg-muted/30">
                {q.label}
              </th>
            ))}
            <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[100px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b hover:bg-muted/30">
              <td className="px-2 py-1 font-medium sticky left-0 bg-background z-10">{row.label}</td>
              {MONTHS.map((_, i) => (
                <td key={i} className="px-0 py-0">
                  {row.editable ? (
                    <EditableCell
                      value={row.getValue(i + 1)}
                      onSave={(gross) => upsertIncome(i + 1, gross)}
                    />
                  ) : (
                    <div className="text-right text-sm px-2 py-1 tabular-nums text-muted-foreground">
                      {fmt(row.getValue(i + 1))}
                    </div>
                  )}
                </td>
              ))}
              {quarters.map((q) => (
                <td key={q.label} className="px-2 py-1 text-right tabular-nums bg-muted/30 font-medium">
                  {fmt(sumRange(row.getValue, q.from, q.to))}
                </td>
              ))}
              <td className="px-2 py-1 text-right font-semibold tabular-nums">
                {fmt(sumRange(row.getValue, 1, 12))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
