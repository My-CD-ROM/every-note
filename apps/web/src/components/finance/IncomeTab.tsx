import { useFinanceStore } from '@/stores/finance-store';
import { EditableCell } from './EditableCell';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Year-based tax config for Ukrainian ФОП (3rd group)
// When rates change, add a new year entry here
interface TaxRates {
  epRate: number;   // Єдиний податок rate (fraction)
  vzRate: number;   // Військовий збір rate (fraction)
  esv: number;      // ЄСВ fixed monthly amount (UAH)
}

const TAX_RATES: Record<number, TaxRates> = {
  2024: { epRate: 0.05, vzRate: 0.01, esv: 1760 },
  2025: { epRate: 0.05, vzRate: 0.01, esv: 1760 },
  2026: { epRate: 0.05, vzRate: 0.01, esv: 1910 },
};

function getRates(year: number): TaxRates {
  // Use exact year match, or fall back to the latest available year
  if (TAX_RATES[year]) return TAX_RATES[year];
  const years = Object.keys(TAX_RATES).map(Number).sort((a, b) => b - a);
  return TAX_RATES[years[0]];
}

function fmt(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

export function IncomeTab() {
  const { year, incomeEntries, upsertIncome } = useFinanceStore();
  const rates = getRates(year);

  const getGross = (month: number): number => {
    return incomeEntries.find((e) => e.year === year && e.month === month)?.gross ?? 0;
  };

  const getEP = (month: number) => getGross(month) * rates.epRate;
  const getVZ = (month: number) => getGross(month) * rates.vzRate;
  const getESV = (month: number) => (getGross(month) > 0 ? rates.esv : 0);
  const getTotalTax = (month: number) => getESV(month) + getEP(month) + getVZ(month);
  const getNet = (month: number) => getGross(month) - getTotalTax(month);

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
    { label: `ЄП (${rates.epRate * 100}%)`, getValue: getEP, editable: false },
    { label: `ВЗ (${rates.vzRate * 100}%)`, getValue: getVZ, editable: false },
    { label: `ЄСВ (${rates.esv})`, getValue: getESV, editable: false },
    { label: 'Всього податків', getValue: getTotalTax, editable: false },
    { label: 'Нетто', getValue: getNet, editable: false },
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
