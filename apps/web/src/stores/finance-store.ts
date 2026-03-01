import { create } from 'zustand';
import {
  financeApi,
  type SpendingCategoryResponse,
  type SpendingEntryResponse,
  type IncomeEntryResponse,
  type UtilityAddressResponse,
  type MeterReadingResponse,
  type BalanceEntryResponse,
} from '@/lib/api';

interface FinanceState {
  year: number;
  activeTab: 'spendings' | 'income' | 'utilities' | 'balance';

  spendingCategories: SpendingCategoryResponse[];
  spendingEntries: SpendingEntryResponse[];
  incomeEntries: IncomeEntryResponse[];
  utilityAddresses: UtilityAddressResponse[];
  meterReadings: MeterReadingResponse[];
  balanceEntries: BalanceEntryResponse[];

  loading: boolean;

  setYear: (year: number) => void;
  setActiveTab: (tab: FinanceState['activeTab']) => void;

  fetchSpendingCategories: () => Promise<void>;
  fetchSpendingEntries: () => Promise<void>;
  createSpendingCategory: (name: string) => Promise<void>;
  updateSpendingCategory: (id: string, data: { name?: string; position?: number }) => Promise<void>;
  deleteSpendingCategory: (id: string) => Promise<void>;
  upsertSpendingEntry: (categoryId: string, month: number, amount: number) => Promise<void>;

  fetchIncome: () => Promise<void>;
  upsertIncome: (month: number, gross: number) => Promise<void>;

  fetchUtilityAddresses: () => Promise<void>;
  fetchMeterReadings: () => Promise<void>;
  createUtilityAddress: (name: string) => Promise<void>;
  updateUtilityAddress: (id: string, data: { name?: string; position?: number }) => Promise<void>;
  deleteUtilityAddress: (id: string) => Promise<void>;
  upsertMeterReading: (addressId: string, utilityType: string, month: number, reading: number) => Promise<void>;

  fetchBalanceEntries: () => Promise<void>;
  createBalanceEntry: (name: string) => Promise<void>;
  updateBalanceEntry: (id: string, data: { name?: string; position?: number; uah?: number; usd?: number; eur?: number }) => Promise<void>;
  deleteBalanceEntry: (id: string) => Promise<void>;

  fetchAll: () => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  year: new Date().getFullYear(),
  activeTab: 'spendings',

  spendingCategories: [],
  spendingEntries: [],
  incomeEntries: [],
  utilityAddresses: [],
  meterReadings: [],
  balanceEntries: [],
  loading: false,

  setYear: (year) => {
    set({ year });
    get().fetchAll();
  },
  setActiveTab: (tab) => set({ activeTab: tab }),

  fetchSpendingCategories: async () => {
    const cats = await financeApi.listSpendingCategories();
    set({ spendingCategories: cats });
  },
  fetchSpendingEntries: async () => {
    const entries = await financeApi.listSpendingEntries(get().year);
    set({ spendingEntries: entries });
  },
  createSpendingCategory: async (name) => {
    await financeApi.createSpendingCategory(name);
    await get().fetchSpendingCategories();
  },
  updateSpendingCategory: async (id, data) => {
    await financeApi.updateSpendingCategory(id, data);
    await get().fetchSpendingCategories();
  },
  deleteSpendingCategory: async (id) => {
    await financeApi.deleteSpendingCategory(id);
    await get().fetchSpendingCategories();
    await get().fetchSpendingEntries();
  },
  upsertSpendingEntry: async (categoryId, month, amount) => {
    const { year } = get();
    const updated = await financeApi.upsertSpendingEntry({ category_id: categoryId, year, month, amount });
    set((s) => {
      const idx = s.spendingEntries.findIndex(
        (e) => e.category_id === categoryId && e.year === year && e.month === month
      );
      if (idx >= 0) {
        const entries = [...s.spendingEntries];
        entries[idx] = updated;
        return { spendingEntries: entries };
      }
      return { spendingEntries: [...s.spendingEntries, updated] };
    });
  },

  fetchIncome: async () => {
    const entries = await financeApi.listIncome(get().year);
    set({ incomeEntries: entries });
  },
  upsertIncome: async (month, gross) => {
    const { year } = get();
    const updated = await financeApi.upsertIncome({ year, month, gross });
    set((s) => {
      const idx = s.incomeEntries.findIndex((e) => e.year === year && e.month === month);
      if (idx >= 0) {
        const entries = [...s.incomeEntries];
        entries[idx] = updated;
        return { incomeEntries: entries };
      }
      return { incomeEntries: [...s.incomeEntries, updated] };
    });
  },

  fetchUtilityAddresses: async () => {
    const addrs = await financeApi.listUtilityAddresses();
    set({ utilityAddresses: addrs });
  },
  fetchMeterReadings: async () => {
    const readings = await financeApi.listMeterReadings(get().year);
    set({ meterReadings: readings });
  },
  createUtilityAddress: async (name) => {
    await financeApi.createUtilityAddress(name);
    await get().fetchUtilityAddresses();
  },
  updateUtilityAddress: async (id, data) => {
    await financeApi.updateUtilityAddress(id, data);
    await get().fetchUtilityAddresses();
  },
  deleteUtilityAddress: async (id) => {
    await financeApi.deleteUtilityAddress(id);
    await get().fetchUtilityAddresses();
    await get().fetchMeterReadings();
  },
  upsertMeterReading: async (addressId, utilityType, month, reading) => {
    const { year } = get();
    const updated = await financeApi.upsertMeterReading({
      address_id: addressId,
      utility_type: utilityType,
      year,
      month,
      reading,
    });
    set((s) => {
      const idx = s.meterReadings.findIndex(
        (r) => r.address_id === addressId && r.utility_type === utilityType && r.year === year && r.month === month
      );
      if (idx >= 0) {
        const readings = [...s.meterReadings];
        readings[idx] = updated;
        return { meterReadings: readings };
      }
      return { meterReadings: [...s.meterReadings, updated] };
    });
  },

  fetchBalanceEntries: async () => {
    const entries = await financeApi.listBalanceEntries();
    set({ balanceEntries: entries });
  },
  createBalanceEntry: async (name) => {
    await financeApi.createBalanceEntry(name);
    await get().fetchBalanceEntries();
  },
  updateBalanceEntry: async (id, data) => {
    await financeApi.updateBalanceEntry(id, data);
    await get().fetchBalanceEntries();
  },
  deleteBalanceEntry: async (id) => {
    await financeApi.deleteBalanceEntry(id);
    await get().fetchBalanceEntries();
  },

  fetchAll: async () => {
    set({ loading: true });
    try {
      await Promise.all([
        get().fetchSpendingCategories(),
        get().fetchSpendingEntries(),
        get().fetchIncome(),
        get().fetchUtilityAddresses(),
        get().fetchMeterReadings(),
        get().fetchBalanceEntries(),
      ]);
    } finally {
      set({ loading: false });
    }
  },
}));
