import { useState } from 'react';
import { ChevronRight, Plus, Trash2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFinanceStore } from '@/stores/finance-store';
import { EditableCell } from './EditableCell';
import { EditableText } from './EditableText';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CHART_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#e11d48', '#65a30d'];

function fmt(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

function AddressSection({ addressId, addressName }: { addressId: string; addressName: string }) {
  const [expanded, setExpanded] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const [addingMeter, setAddingMeter] = useState(false);
  const [newMeterName, setNewMeterName] = useState('');
  const { year, meterReadings, upsertMeterReading, updateUtilityAddress, deleteUtilityAddress, deleteMeterType } =
    useFinanceStore();

  // Derive meter types from existing readings for this address
  const meterTypes = [
    ...new Set(
      meterReadings
        .filter((r) => r.address_id === addressId)
        .map((r) => r.utility_type)
    ),
  ].sort();

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

  const handleAddMeter = () => {
    const name = newMeterName.trim().toLowerCase();
    if (!name || meterTypes.includes(name)) {
      setAddingMeter(false);
      setNewMeterName('');
      return;
    }
    // Create a dummy reading for month 1 with value 0 to register the type
    upsertMeterReading(addressId, name, 1, 0);
    setAddingMeter(false);
    setNewMeterName('');
  };

  // Build chart data: one object per month with consumption for each meter type
  const chartData = MONTHS.map((m, i) => {
    const point: Record<string, string | number> = { month: m };
    for (const type of meterTypes) {
      point[type] = getConsumption(type, i + 1);
    }
    return point;
  });

  // Build rows: for each meter type, a reading row + consumption row
  type RowDef = { label: string; type: string; kind: 'reading' | 'consumption' };
  const rows: RowDef[] = meterTypes.flatMap((type) => [
    { label: `${type} (reading)`, type, kind: 'reading' as const },
    { label: `${type} (consumption)`, type, kind: 'consumption' as const },
  ]);

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
          onClick={() => setShowChart(!showChart)}
          className={cn(
            'p-1 transition-opacity ml-1',
            showChart ? 'text-primary opacity-100' : 'opacity-0 group-hover/addr:opacity-100 text-muted-foreground hover:text-primary'
          )}
          title="Toggle chart"
        >
          <BarChart3 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => deleteUtilityAddress(addressId)}
          className="opacity-0 group-hover/addr:opacity-100 p-1 hover:text-destructive transition-opacity ml-1"
          title="Delete address"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="ml-5">
          {showChart && meterTypes.length > 0 && (
            <div className="h-48 mb-3 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  {meterTypes.map((type, i) => (
                    <Line
                      key={type}
                      type="monotone"
                      dataKey={type}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <table className="w-full border-collapse text-sm mt-1">
            <thead>
              <tr className="border-b">
                <th className="text-left px-2 py-1 font-medium text-muted-foreground min-w-[160px]" />
                {MONTHS.map((m) => (
                  <th key={m} className="text-right px-2 py-1 font-medium text-muted-foreground min-w-[80px]">
                    {m}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={cn('border-b', row.kind === 'consumption' && 'bg-muted/20')}>
                  <td className="px-2 py-1 text-muted-foreground capitalize">{row.label}</td>
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
                  <td className="px-0 py-0">
                    {row.kind === 'reading' && (
                      <button
                        onClick={() => deleteMeterType(addressId, row.type)}
                        className="opacity-0 hover:opacity-100 p-1 hover:text-destructive transition-opacity"
                        title={`Remove ${row.type}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-1">
            {addingMeter ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newMeterName}
                  onChange={(e) => setNewMeterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMeter();
                    if (e.key === 'Escape') { setAddingMeter(false); setNewMeterName(''); }
                  }}
                  onBlur={handleAddMeter}
                  placeholder="gas, water, electricity..."
                  className="text-sm px-2 py-1 border rounded bg-transparent outline-none w-48"
                />
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground h-7 text-xs"
                onClick={() => setAddingMeter(true)}
              >
                <Plus className="h-3 w-3" />
                Add meter
              </Button>
            )}
          </div>
        </div>
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
