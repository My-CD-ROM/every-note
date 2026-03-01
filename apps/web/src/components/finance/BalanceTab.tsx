import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinanceStore } from '@/stores/finance-store';
import { EditableCell } from './EditableCell';
import { EditableText } from './EditableText';

const CURRENCIES = ['uah', 'usd', 'eur'] as const;
const CURRENCY_LABELS: Record<string, string> = { uah: 'UAH', usd: 'USD', eur: 'EUR' };

export function BalanceTab() {
  const { balanceEntries, createBalanceEntry, updateBalanceEntry, deleteBalanceEntry } = useFinanceStore();

  const getTotal = (currency: string): number => {
    return balanceEntries.reduce((sum, e) => sum + (e[currency as keyof typeof e] as number), 0);
  };

  return (
    <div className="max-w-lg">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left px-2 py-2 font-medium text-muted-foreground min-w-[160px]">Name</th>
            {CURRENCIES.map((c) => (
              <th key={c} className="text-right px-2 py-2 font-medium text-muted-foreground min-w-[100px]">
                {CURRENCY_LABELS[c]}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {balanceEntries.map((entry) => (
            <tr key={entry.id} className="border-b group/row hover:bg-muted/30">
              <td className="px-2 py-1">
                <EditableText
                  value={entry.name}
                  onSave={(name) => updateBalanceEntry(entry.id, { name })}
                />
              </td>
              {CURRENCIES.map((c) => (
                <td key={c} className="px-0 py-0">
                  <EditableCell
                    value={entry[c]}
                    onSave={(val) => updateBalanceEntry(entry.id, { [c]: val })}
                  />
                </td>
              ))}
              <td className="px-1">
                <button
                  onClick={() => deleteBalanceEntry(entry.id)}
                  className="opacity-0 group-hover/row:opacity-100 p-1 hover:text-destructive transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="px-2 py-2 text-muted-foreground">Total</td>
            {CURRENCIES.map((c) => (
              <td key={c} className="px-2 py-2 text-right tabular-nums">
                {getTotal(c) ? getTotal(c).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) : ''}
              </td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 gap-1 text-muted-foreground"
        onClick={() => createBalanceEntry('New item')}
      >
        <Plus className="h-3.5 w-3.5" />
        Add row
      </Button>
    </div>
  );
}
