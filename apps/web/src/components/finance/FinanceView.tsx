import { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useFinanceStore } from '@/stores/finance-store';
import { SpendingsTab } from './SpendingsTab';
import { IncomeTab } from './IncomeTab';
import { UtilitiesTab } from './UtilitiesTab';
import { BalanceTab } from './BalanceTab';

const TABS = [
  { key: 'spendings' as const, label: 'Spendings' },
  { key: 'income' as const, label: 'Income & Taxes' },
  { key: 'utilities' as const, label: 'Utilities' },
  { key: 'balance' as const, label: 'Balance' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function FinanceView() {
  const { year, setYear, activeTab, setActiveTab, fetchAll, loading } = useFinanceStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Finance</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {year}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {YEARS.map((y) => (
              <DropdownMenuItem key={y} onClick={() => setYear(y)} className={cn(y === year && 'font-semibold')}>
                {y}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {loading && <span className="text-xs text-muted-foreground">Loading...</span>}
      </div>

      <div className="flex gap-0 border-b px-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'spendings' && <SpendingsTab />}
        {activeTab === 'income' && <IncomeTab />}
        {activeTab === 'utilities' && <UtilitiesTab />}
        {activeTab === 'balance' && <BalanceTab />}
      </div>
    </div>
  );
}
