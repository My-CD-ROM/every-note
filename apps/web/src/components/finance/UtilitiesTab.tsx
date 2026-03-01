import { useState } from 'react';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinanceStore } from '@/stores/finance-store';
import { EditableCell } from './EditableCell';
import { EditableText } from './EditableText';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmt(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

function AddressSection({ addressId, addressName }: { addressId: string; addressName: string }) {
  const [expanded, setExpanded] = useState(true);
  const { year, meterReadings, upsertMeterReading, updateUtilityAddress, deleteUtilityAddress } = useFinanceStore();

  const getReading = (type: string, month: number, yr?: number): number => {
    const y = yr ?? year;
    return (
      meterReadings.find(
        (r) => r.address_id === addressId && r.utility_type === type && r.year === y && r.month === month
      )?.reading ?? 0
    );
  };

  const getConsumption = (type: string, month: number): number => {
    const current = getReading(type, month);
    if (current === 0) return 0;
    const prevReading = month === 1 ? getReading(type, 12, year - 1) : getReading(type, month - 1);
    if (prevReading === 0) return 0;
    return current - prevReading;
  };

  type RowDef = { label: string; type: string; kind: 'reading' | 'consumption' };
  const rows: RowDef[] = [
    { label: 'Gas (reading)', type: 'gas', kind: 'reading' },
    { label: 'Gas (consumption)', type: 'gas', kind: 'consumption' },
    { label: 'Water (reading)', type: 'water', kind: 'reading' },
    { label: 'Water (consumption)', type: 'water', kind: 'consumption' },
  ];

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1 group/addr">
        <button onClick={() => setExpanded(!expanded)} className="p-0.5">
          <ChevronRight className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')} />
        </button>
        <EditableText
          value={addressName}
          onSave={(name) => updateUtilityAddress(addressId, { name })}
          className="font-medium"
        />
        <button
          onClick={() => deleteUtilityAddress(addressId)}
          className="opacity-0 group-hover/addr:opacity-100 p-1 hover:text-destructive transition-opacity ml-1"
          title="Delete address"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <table className="w-full border-collapse text-sm mt-1 ml-5">
          <thead>
            <tr className="border-b">
              <th className="text-left px-2 py-1 font-medium text-muted-foreground min-w-[140px]" />
              {MONTHS.map((m) => (
                <th key={m} className="text-right px-2 py-1 font-medium text-muted-foreground min-w-[80px]">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={cn('border-b', row.kind === 'consumption' && 'bg-muted/20')}>
                <td className="px-2 py-1 text-muted-foreground">{row.label}</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className="px-0 py-0">
                    {row.kind === 'reading' ? (
                      <EditableCell
                        value={getReading(row.type, i + 1)}
                        onSave={(reading) => upsertMeterReading(addressId, row.type, i + 1, reading)}
                      />
                    ) : (
                      <div className="text-right text-sm px-2 py-1 tabular-nums text-muted-foreground">
                        {fmt(getConsumption(row.type, i + 1))}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function UtilitiesTab() {
  const { utilityAddresses, createUtilityAddress } = useFinanceStore();

  return (
    <div>
      {utilityAddresses.map((addr) => (
        <AddressSection key={addr.id} addressId={addr.id} addressName={addr.name} />
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 gap-1 text-muted-foreground"
        onClick={() => createUtilityAddress('New address')}
      >
        <Plus className="h-3.5 w-3.5" />
        Add address
      </Button>
    </div>
  );
}
