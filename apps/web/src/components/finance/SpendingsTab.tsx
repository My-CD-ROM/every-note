import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinanceStore } from '@/stores/finance-store';
import { EditableCell } from './EditableCell';
import { EditableText } from './EditableText';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function SpendingsTab() {
  const {
    year,
    spendingCategories,
    spendingEntries,
    createSpendingCategory,
    updateSpendingCategory,
    deleteSpendingCategory,
    upsertSpendingEntry,
  } = useFinanceStore();

  const getAmount = (categoryId: string, month: number): number => {
    const entry = spendingEntries.find(
      (e) => e.category_id === categoryId && e.year === year && e.month === month
    );
    return entry?.amount ?? 0;
  };

  const getCategoryTotal = (categoryId: string): number => {
    return Array.from({ length: 12 }, (_, i) => getAmount(categoryId, i + 1)).reduce((a, b) => a + b, 0);
  };

  const getMonthTotal = (month: number): number => {
    return spendingCategories.reduce((sum, cat) => sum + getAmount(cat.id, month), 0);
  };

  const getGrandTotal = (): number => {
    return spendingCategories.reduce((sum, cat) => sum + getCategoryTotal(cat.id), 0);
  };

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left px-2 py-2 font-medium text-muted-foreground min-w-[160px] sticky left-0 bg-background z-10">
              Category
            </th>
            {MONTHS.map((m) => (
              <th key={m} className="text-right px-2 py-2 font-medium text-muted-foreground min-w-[90px]">
                {m}
              </th>
            ))}
            <th className="text-right px-2 py-2 font-semibold text-muted-foreground min-w-[100px]">Total</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {spendingCategories.map((cat) => (
            <tr key={cat.id} className="border-b group/row hover:bg-muted/30">
              <td className="px-2 py-1 sticky left-0 bg-background z-10">
                <EditableText
                  value={cat.name}
                  onSave={(name) => updateSpendingCategory(cat.id, { name })}
                />
              </td>
              {MONTHS.map((_, i) => (
                <td key={i} className="px-0 py-0">
                  <EditableCell
                    value={getAmount(cat.id, i + 1)}
                    onSave={(amount) => upsertSpendingEntry(cat.id, i + 1, amount)}
                  />
                </td>
              ))}
              <td className="px-2 py-1 text-right font-medium tabular-nums">
                {getCategoryTotal(cat.id) ? getCategoryTotal(cat.id).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) : ''}
              </td>
              <td className="px-1">
                <button
                  onClick={() => deleteSpendingCategory(cat.id)}
                  className="opacity-0 group-hover/row:opacity-100 p-1 hover:text-destructive transition-opacity"
                  title="Delete category"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="px-2 py-2 sticky left-0 bg-background z-10 text-muted-foreground">Total</td>
            {MONTHS.map((_, i) => (
              <td key={i} className="px-2 py-2 text-right tabular-nums">
                {getMonthTotal(i + 1) ? getMonthTotal(i + 1).toLocaleString('uk-UA', { maximumFractionDigits: 2 }) : ''}
              </td>
            ))}
            <td className="px-2 py-2 text-right tabular-nums">
              {getGrandTotal() ? getGrandTotal().toLocaleString('uk-UA', { maximumFractionDigits: 2 }) : ''}
            </td>
            <td />
          </tr>
        </tbody>
      </table>
      <Button variant="ghost" size="sm" className="mt-2 gap-1 text-muted-foreground" onClick={() => createSpendingCategory('New category')}>
        <Plus className="h-3.5 w-3.5" />
        Add category
      </Button>
    </div>
  );
}
