# Finance Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated Finance section with four sub-modules: constant spendings, income & taxes (Ukrainian ФОП), utility meters, and multi-currency balance.

**Architecture:** New sidebar section opening a tabbed spreadsheet view. 6 new SQLite tables (spending_categories, spending_entries, income_entries, utility_addresses, meter_readings, balance_entries). One FastAPI router with 16 endpoints under `/finance/`. One Zustand store. Computations (taxes, consumption deltas, totals) are client-side.

**Tech Stack:** FastAPI + SQLModel + SQLite (backend), React 19 + TypeScript + Tailwind v4 + shadcn/ui + Zustand (frontend)

**Design Doc:** `docs/plans/2026-03-01-finance-module-design.md`

---

### Task 1: Add Finance SQLModel Models

**Files:**
- Modify: `backend/app/models.py`

**Step 1: Add the 6 new models at the end of models.py**

Add these models after the existing `NoteVersion` class (after line 116):

```python
class SpendingCategory(SQLModel, table=True):
    __tablename__ = "spending_categories"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    position: float = Field(default=0)
    created_at: str = Field(default_factory=utc_now)


class SpendingEntry(SQLModel, table=True):
    __tablename__ = "spending_entries"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    category_id: str = Field(foreign_key="spending_categories.id", index=True)
    year: int
    month: int
    amount: float = Field(default=0)


class IncomeEntry(SQLModel, table=True):
    __tablename__ = "income_entries"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    year: int
    month: int
    gross: float = Field(default=0)


class UtilityAddress(SQLModel, table=True):
    __tablename__ = "utility_addresses"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    position: float = Field(default=0)
    created_at: str = Field(default_factory=utc_now)


class MeterReading(SQLModel, table=True):
    __tablename__ = "meter_readings"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    address_id: str = Field(foreign_key="utility_addresses.id", index=True)
    utility_type: str  # 'gas' | 'water'
    year: int
    month: int
    reading: float = Field(default=0)


class BalanceEntry(SQLModel, table=True):
    __tablename__ = "balance_entries"
    id: str = Field(default_factory=generate_ulid, primary_key=True)
    name: str
    position: float = Field(default=0)
    uah: float = Field(default=0)
    usd: float = Field(default=0)
    eur: float = Field(default=0)
    created_at: str = Field(default_factory=utc_now)
```

**Step 2: Verify models compile**

Run: `cd /Users/roman/Desktop/personal/every-note/backend && uv run python -c "from app.models import SpendingCategory, SpendingEntry, IncomeEntry, UtilityAddress, MeterReading, BalanceEntry; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/models.py
git commit -m "feat: add finance module SQLModel models"
```

---

### Task 2: Add Database Schema Creation

**Files:**
- Modify: `backend/app/database.py`

**Context:** The `init_db()` function in `database.py` uses raw `sqlite3` to create tables (because SQLModel can't handle all DDL). Tables are created with `CREATE TABLE IF NOT EXISTS`. Look at existing patterns around line 20-80.

**Step 1: Add 6 new CREATE TABLE statements inside `init_db()`**

Add these after the existing `CREATE TABLE` statements (after `note_versions`, before the FTS5 section):

```python
    # -- Finance: Spending --
    cur.execute("""
        CREATE TABLE IF NOT EXISTS spending_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position REAL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS spending_entries (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL REFERENCES spending_categories(id) ON DELETE CASCADE,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
            amount REAL NOT NULL DEFAULT 0,
            UNIQUE(category_id, year, month)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_spending_entries_cat ON spending_entries(category_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_spending_entries_year ON spending_entries(year)")

    # -- Finance: Income --
    cur.execute("""
        CREATE TABLE IF NOT EXISTS income_entries (
            id TEXT PRIMARY KEY,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
            gross REAL NOT NULL DEFAULT 0,
            UNIQUE(year, month)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_income_entries_year ON income_entries(year)")

    # -- Finance: Utilities --
    cur.execute("""
        CREATE TABLE IF NOT EXISTS utility_addresses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position REAL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS meter_readings (
            id TEXT PRIMARY KEY,
            address_id TEXT NOT NULL REFERENCES utility_addresses(id) ON DELETE CASCADE,
            utility_type TEXT NOT NULL CHECK (utility_type IN ('gas', 'water')),
            year INTEGER NOT NULL,
            month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
            reading REAL NOT NULL DEFAULT 0,
            UNIQUE(address_id, utility_type, year, month)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_meter_readings_addr ON meter_readings(address_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_meter_readings_year ON meter_readings(year)")

    # -- Finance: Balance --
    cur.execute("""
        CREATE TABLE IF NOT EXISTS balance_entries (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position REAL DEFAULT 0,
            uah REAL NOT NULL DEFAULT 0,
            usd REAL NOT NULL DEFAULT 0,
            eur REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
```

**Step 2: Verify database initializes**

Run: `cd /Users/roman/Desktop/personal/every-note/backend && uv run python -c "from app.database import init_db; init_db(); print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/database.py
git commit -m "feat: add finance tables to database schema"
```

---

### Task 3: Add Finance Pydantic Schemas

**Files:**
- Modify: `backend/app/schemas.py`

**Step 1: Add finance schemas at the end of schemas.py**

Add after the `ReorderRequest` class (after line 242):

```python

# --- Finance: Spending ---
class SpendingCategoryCreate(BaseModel):
    name: str


class SpendingCategoryUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[float] = None


class SpendingCategoryResponse(BaseModel):
    id: str
    name: str
    position: float
    created_at: str


class SpendingEntryUpsert(BaseModel):
    category_id: str
    year: int
    month: int
    amount: float


class SpendingEntryResponse(BaseModel):
    id: str
    category_id: str
    year: int
    month: int
    amount: float


# --- Finance: Income ---
class IncomeEntryUpsert(BaseModel):
    year: int
    month: int
    gross: float


class IncomeEntryResponse(BaseModel):
    id: str
    year: int
    month: int
    gross: float


# --- Finance: Utilities ---
class UtilityAddressCreate(BaseModel):
    name: str


class UtilityAddressUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[float] = None


class UtilityAddressResponse(BaseModel):
    id: str
    name: str
    position: float
    created_at: str


class MeterReadingUpsert(BaseModel):
    address_id: str
    utility_type: str  # 'gas' | 'water'
    year: int
    month: int
    reading: float


class MeterReadingResponse(BaseModel):
    id: str
    address_id: str
    utility_type: str
    year: int
    month: int
    reading: float


# --- Finance: Balance ---
class BalanceEntryCreate(BaseModel):
    name: str


class BalanceEntryUpdate(BaseModel):
    name: Optional[str] = None
    position: Optional[float] = None
    uah: Optional[float] = None
    usd: Optional[float] = None
    eur: Optional[float] = None


class BalanceEntryResponse(BaseModel):
    id: str
    name: str
    position: float
    uah: float
    usd: float
    eur: float
    created_at: str
```

**Step 2: Verify schemas compile**

Run: `cd /Users/roman/Desktop/personal/every-note/backend && uv run python -c "from app.schemas import SpendingCategoryResponse, IncomeEntryResponse, MeterReadingResponse, BalanceEntryResponse; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/app/schemas.py
git commit -m "feat: add finance Pydantic schemas"
```

---

### Task 4: Create Finance Router

**Files:**
- Create: `backend/app/routers/finance.py`

**Step 1: Create the router file with all 16 endpoints**

```python
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import (
    BalanceEntry,
    IncomeEntry,
    MeterReading,
    SpendingCategory,
    SpendingEntry,
    UtilityAddress,
    generate_ulid,
    utc_now,
)
from app.schemas import (
    BalanceEntryCreate,
    BalanceEntryResponse,
    BalanceEntryUpdate,
    IncomeEntryResponse,
    IncomeEntryUpsert,
    MeterReadingResponse,
    MeterReadingUpsert,
    SpendingCategoryCreate,
    SpendingCategoryResponse,
    SpendingCategoryUpdate,
    SpendingEntryResponse,
    SpendingEntryUpsert,
    UtilityAddressCreate,
    UtilityAddressResponse,
    UtilityAddressUpdate,
)

router = APIRouter(prefix="/finance", tags=["finance"])
S = Annotated[Session, Depends(get_session)]


# -- Spending Categories --


@router.get("/spending-categories", response_model=list[SpendingCategoryResponse])
def list_spending_categories(session: S):
    cats = session.exec(
        select(SpendingCategory).order_by(SpendingCategory.position)
    ).all()
    return cats


@router.post("/spending-categories", response_model=SpendingCategoryResponse, status_code=201)
def create_spending_category(data: SpendingCategoryCreate, session: S):
    cat = SpendingCategory(
        id=generate_ulid(),
        name=data.name,
        created_at=utc_now(),
    )
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.patch("/spending-categories/{cat_id}", response_model=SpendingCategoryResponse)
def update_spending_category(cat_id: str, data: SpendingCategoryUpdate, session: S):
    cat = session.get(SpendingCategory, cat_id)
    if not cat:
        raise HTTPException(404, "Spending category not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(cat, k, v)
    session.add(cat)
    session.commit()
    session.refresh(cat)
    return cat


@router.delete("/spending-categories/{cat_id}")
def delete_spending_category(cat_id: str, session: S):
    cat = session.get(SpendingCategory, cat_id)
    if not cat:
        raise HTTPException(404, "Spending category not found")
    entries = session.exec(
        select(SpendingEntry).where(SpendingEntry.category_id == cat_id)
    ).all()
    for e in entries:
        session.delete(e)
    session.delete(cat)
    session.commit()
    return {"ok": True}


# -- Spending Entries --


@router.get("/spending-entries", response_model=list[SpendingEntryResponse])
def list_spending_entries(session: S, year: int = Query(...)):
    entries = session.exec(
        select(SpendingEntry).where(SpendingEntry.year == year)
    ).all()
    return entries


@router.put("/spending-entries", response_model=SpendingEntryResponse)
def upsert_spending_entry(data: SpendingEntryUpsert, session: S):
    existing = session.exec(
        select(SpendingEntry).where(
            SpendingEntry.category_id == data.category_id,
            SpendingEntry.year == data.year,
            SpendingEntry.month == data.month,
        )
    ).first()
    if existing:
        existing.amount = data.amount
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    entry = SpendingEntry(
        id=generate_ulid(),
        category_id=data.category_id,
        year=data.year,
        month=data.month,
        amount=data.amount,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


# -- Income --


@router.get("/income", response_model=list[IncomeEntryResponse])
def list_income(session: S, year: int = Query(...)):
    entries = session.exec(
        select(IncomeEntry).where(IncomeEntry.year == year)
    ).all()
    return entries


@router.put("/income", response_model=IncomeEntryResponse)
def upsert_income(data: IncomeEntryUpsert, session: S):
    existing = session.exec(
        select(IncomeEntry).where(
            IncomeEntry.year == data.year,
            IncomeEntry.month == data.month,
        )
    ).first()
    if existing:
        existing.gross = data.gross
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    entry = IncomeEntry(
        id=generate_ulid(),
        year=data.year,
        month=data.month,
        gross=data.gross,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


# -- Utility Addresses --


@router.get("/utility-addresses", response_model=list[UtilityAddressResponse])
def list_utility_addresses(session: S):
    addrs = session.exec(
        select(UtilityAddress).order_by(UtilityAddress.position)
    ).all()
    return addrs


@router.post("/utility-addresses", response_model=UtilityAddressResponse, status_code=201)
def create_utility_address(data: UtilityAddressCreate, session: S):
    addr = UtilityAddress(
        id=generate_ulid(),
        name=data.name,
        created_at=utc_now(),
    )
    session.add(addr)
    session.commit()
    session.refresh(addr)
    return addr


@router.patch("/utility-addresses/{addr_id}", response_model=UtilityAddressResponse)
def update_utility_address(addr_id: str, data: UtilityAddressUpdate, session: S):
    addr = session.get(UtilityAddress, addr_id)
    if not addr:
        raise HTTPException(404, "Utility address not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(addr, k, v)
    session.add(addr)
    session.commit()
    session.refresh(addr)
    return addr


@router.delete("/utility-addresses/{addr_id}")
def delete_utility_address(addr_id: str, session: S):
    addr = session.get(UtilityAddress, addr_id)
    if not addr:
        raise HTTPException(404, "Utility address not found")
    readings = session.exec(
        select(MeterReading).where(MeterReading.address_id == addr_id)
    ).all()
    for r in readings:
        session.delete(r)
    session.delete(addr)
    session.commit()
    return {"ok": True}


# -- Meter Readings --


@router.get("/meter-readings", response_model=list[MeterReadingResponse])
def list_meter_readings(session: S, year: int = Query(...)):
    """Returns readings for the given year AND December of the previous year
    (needed to compute January consumption delta)."""
    readings = session.exec(
        select(MeterReading).where(
            ((MeterReading.year == year))
            | ((MeterReading.year == year - 1) & (MeterReading.month == 12))
        )
    ).all()
    return readings


@router.put("/meter-readings", response_model=MeterReadingResponse)
def upsert_meter_reading(data: MeterReadingUpsert, session: S):
    existing = session.exec(
        select(MeterReading).where(
            MeterReading.address_id == data.address_id,
            MeterReading.utility_type == data.utility_type,
            MeterReading.year == data.year,
            MeterReading.month == data.month,
        )
    ).first()
    if existing:
        existing.reading = data.reading
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    reading = MeterReading(
        id=generate_ulid(),
        address_id=data.address_id,
        utility_type=data.utility_type,
        year=data.year,
        month=data.month,
        reading=data.reading,
    )
    session.add(reading)
    session.commit()
    session.refresh(reading)
    return reading


# -- Balance --


@router.get("/balance-entries", response_model=list[BalanceEntryResponse])
def list_balance_entries(session: S):
    entries = session.exec(
        select(BalanceEntry).order_by(BalanceEntry.position)
    ).all()
    return entries


@router.post("/balance-entries", response_model=BalanceEntryResponse, status_code=201)
def create_balance_entry(data: BalanceEntryCreate, session: S):
    entry = BalanceEntry(
        id=generate_ulid(),
        name=data.name,
        created_at=utc_now(),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.patch("/balance-entries/{entry_id}", response_model=BalanceEntryResponse)
def update_balance_entry(entry_id: str, data: BalanceEntryUpdate, session: S):
    entry = session.get(BalanceEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Balance entry not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/balance-entries/{entry_id}")
def delete_balance_entry(entry_id: str, session: S):
    entry = session.get(BalanceEntry, entry_id)
    if not entry:
        raise HTTPException(404, "Balance entry not found")
    session.delete(entry)
    session.commit()
    return {"ok": True}
```

**Step 2: Verify router compiles**

Run: `cd /Users/roman/Desktop/personal/every-note/backend && uv run python -c "from app.routers.finance import router; print(f'{len(router.routes)} routes OK')"`
Expected: `16 routes OK`

**Step 3: Commit**

```bash
git add backend/app/routers/finance.py
git commit -m "feat: add finance API router"
```

---

### Task 5: Register Finance Router in Main App

**Files:**
- Modify: `backend/app/main.py`

**Step 1: Add finance import**

In the import block where other routers are imported (around line 6), add `finance` to the import:

```python
from app.routers import notes, folders, tags, projects, search, daily, export, graph, attachments, reminders, finance
```

**Step 2: Register the router**

After the last `app.include_router(...)` call, add:

```python
app.include_router(finance.router)
```

**Step 3: Verify app starts**

Run: `cd /Users/roman/Desktop/personal/every-note/backend && uv run python -c "from app.main import app; print(f'{len(app.routes)} routes total')"`
Expected: prints route count without errors

**Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register finance router in app"
```

---

### Task 6: Add Finance TypeScript Types to Shared Package

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: Add finance interfaces at the end of types.ts**

Add after the `AttachmentResponse` interface (after line 147):

```typescript

// --- Finance ---

export interface SpendingCategoryResponse {
  id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface SpendingEntryResponse {
  id: string;
  category_id: string;
  year: number;
  month: number;
  amount: number;
}

export interface IncomeEntryResponse {
  id: string;
  year: number;
  month: number;
  gross: number;
}

export interface UtilityAddressResponse {
  id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface MeterReadingResponse {
  id: string;
  address_id: string;
  utility_type: 'gas' | 'water';
  year: number;
  month: number;
  reading: number;
}

export interface BalanceEntryResponse {
  id: string;
  name: string;
  position: number;
  uah: number;
  usd: number;
  eur: number;
  created_at: string;
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add finance types to shared package"
```

---

### Task 7: Add Finance API Client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

**Context:** The API client file has a `request<T>()` helper and exports API objects per resource. Types are re-exported from `@every-note/shared`.

**Step 1: Add finance type re-exports**

In the type re-export block, add the finance types:

```typescript
export type {
  // ... existing exports ...
  SpendingCategoryResponse,
  SpendingEntryResponse,
  IncomeEntryResponse,
  UtilityAddressResponse,
  MeterReadingResponse,
  BalanceEntryResponse,
} from '@every-note/shared';
```

**Step 2: Add the financeApi object**

Add after the last API object (e.g., after `remindersApi`):

```typescript
export const financeApi = {
  // Spending Categories
  listSpendingCategories() {
    return request<SpendingCategoryResponse[]>('/finance/spending-categories');
  },
  createSpendingCategory(name: string) {
    return request<SpendingCategoryResponse>('/finance/spending-categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  updateSpendingCategory(id: string, data: { name?: string; position?: number }) {
    return request<SpendingCategoryResponse>(`/finance/spending-categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteSpendingCategory(id: string) {
    return request<{ ok: boolean }>(`/finance/spending-categories/${id}`, { method: 'DELETE' });
  },

  // Spending Entries
  listSpendingEntries(year: number) {
    return request<SpendingEntryResponse[]>(`/finance/spending-entries?year=${year}`);
  },
  upsertSpendingEntry(data: { category_id: string; year: number; month: number; amount: number }) {
    return request<SpendingEntryResponse>('/finance/spending-entries', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Income
  listIncome(year: number) {
    return request<IncomeEntryResponse[]>(`/finance/income?year=${year}`);
  },
  upsertIncome(data: { year: number; month: number; gross: number }) {
    return request<IncomeEntryResponse>('/finance/income', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Utility Addresses
  listUtilityAddresses() {
    return request<UtilityAddressResponse[]>('/finance/utility-addresses');
  },
  createUtilityAddress(name: string) {
    return request<UtilityAddressResponse>('/finance/utility-addresses', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  updateUtilityAddress(id: string, data: { name?: string; position?: number }) {
    return request<UtilityAddressResponse>(`/finance/utility-addresses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteUtilityAddress(id: string) {
    return request<{ ok: boolean }>(`/finance/utility-addresses/${id}`, { method: 'DELETE' });
  },

  // Meter Readings
  listMeterReadings(year: number) {
    return request<MeterReadingResponse[]>(`/finance/meter-readings?year=${year}`);
  },
  upsertMeterReading(data: { address_id: string; utility_type: string; year: number; month: number; reading: number }) {
    return request<MeterReadingResponse>('/finance/meter-readings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Balance
  listBalanceEntries() {
    return request<BalanceEntryResponse[]>('/finance/balance-entries');
  },
  createBalanceEntry(name: string) {
    return request<BalanceEntryResponse>('/finance/balance-entries', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  updateBalanceEntry(id: string, data: { name?: string; position?: number; uah?: number; usd?: number; eur?: number }) {
    return request<BalanceEntryResponse>(`/finance/balance-entries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
  deleteBalanceEntry(id: string) {
    return request<{ ok: boolean }>(`/finance/balance-entries/${id}`, { method: 'DELETE' });
  },
};
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts packages/shared/src/types.ts
git commit -m "feat: add finance API client"
```

---

### Task 8: Create Finance Zustand Store

**Files:**
- Create: `apps/web/src/stores/finance-store.ts`

**Context:** Zustand stores follow the pattern in `notes-store.ts`: interface with state + methods, `create<State>((set, get) => ...)`, async methods with try/finally for loading. Use `financeApi` from `@/lib/api`.

**Step 1: Create the store file**

```typescript
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
```

**Step 2: Commit**

```bash
git add apps/web/src/stores/finance-store.ts
git commit -m "feat: add finance Zustand store"
```

---

### Task 9: Add 'finance' View to UI Store

**Files:**
- Modify: `apps/web/src/stores/ui-store.ts`

**Step 1: Add 'finance' to the View type union**

Change line 4 from:
```typescript
type View = 'all' | 'folder' | 'tag' | 'trash' | 'favorites' | 'daily' | 'graph' | 'completed' | 'board';
```
to:
```typescript
type View = 'all' | 'folder' | 'tag' | 'trash' | 'favorites' | 'daily' | 'graph' | 'completed' | 'board' | 'finance';
```

**Step 2: Commit**

```bash
git add apps/web/src/stores/ui-store.ts
git commit -m "feat: add finance view to UI store"
```

---

### Task 10: Add Finance NavItem to Sidebar

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

**Step 1: Add Wallet import**

Add `Wallet` to the lucide-react import block (lines 2-18).

**Step 2: Add Finance NavItem in the JSX**

Add a Finance section before the Completed/Trash items (around line 424, before `{/* Completed */}`):

```tsx
        <Separator className="my-3" />

        {/* Finance */}
        <NavItem
          icon={Wallet}
          label="Finance"
          active={view === 'finance'}
          iconColor="#059669"
          onClick={() => {
            setActiveFolder(null);
            setActiveTag(null);
            setActiveNote(null);
            setView('finance');
          }}
        />

        <Separator className="my-3" />
```

**Step 3: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat: add finance nav item to sidebar"
```

---

### Task 11: Create EditableCell Component

**Files:**
- Create: `apps/web/src/components/finance/EditableCell.tsx`

**Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: number;
  onSave: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

function formatNumber(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

export function EditableCell({ value, onSave, disabled, className }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (disabled) return;
    setText(value === 0 ? '' : String(value));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const parsed = parseFloat(text.replace(/\s/g, '').replace(',', '.'));
    const newValue = isNaN(parsed) ? 0 : parsed;
    if (newValue !== value) {
      onSave(newValue);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className={cn(
          'w-full h-full bg-transparent text-right text-sm px-2 py-1 outline-none border border-primary/30 rounded',
          className
        )}
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className={cn(
        'w-full h-full text-right text-sm px-2 py-1 tabular-nums',
        !disabled && 'cursor-pointer hover:bg-muted/50',
        disabled && 'text-muted-foreground',
        className
      )}
    >
      {formatNumber(value)}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/finance/EditableCell.tsx
git commit -m "feat: add EditableCell component"
```

---

### Task 12: Create EditableText Component

**Files:**
- Create: `apps/web/src/components/finance/EditableText.tsx`

**Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function EditableText({ value, onSave, className, placeholder }: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setText(value);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setText(value); setEditing(false); }
        }}
        className={cn(
          'bg-transparent text-sm px-1 py-0.5 outline-none border border-primary/30 rounded w-full',
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={cn(
        'text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 truncate',
        className
      )}
    >
      {value || <span className="text-muted-foreground">{placeholder || 'Click to edit'}</span>}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/finance/EditableText.tsx
git commit -m "feat: add EditableText component"
```

---

### Task 13: Create SpendingsTab Component

**Files:**
- Create: `apps/web/src/components/finance/SpendingsTab.tsx`

**Step 1: Create the component**

```tsx
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

          {/* Totals row */}
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
```

**Step 2: Commit**

```bash
git add apps/web/src/components/finance/SpendingsTab.tsx
git commit -m "feat: add SpendingsTab component"
```

---

### Task 14: Create IncomeTab Component

**Files:**
- Create: `apps/web/src/components/finance/IncomeTab.tsx`

**Step 1: Create the component**

```tsx
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
```

**Step 2: Commit**

```bash
git add apps/web/src/components/finance/IncomeTab.tsx
git commit -m "feat: add IncomeTab component"
```

---

### Task 15: Create UtilitiesTab Component

**Files:**
- Create: `apps/web/src/components/finance/UtilitiesTab.tsx`

**Step 1: Create the component**

```tsx
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
```

**Step 2: Commit**

```bash
git add apps/web/src/components/finance/UtilitiesTab.tsx
git commit -m "feat: add UtilitiesTab component"
```

---

### Task 16: Create BalanceTab Component

**Files:**
- Create: `apps/web/src/components/finance/BalanceTab.tsx`

**Step 1: Create the component**

```tsx
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

          {/* Totals row */}
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
```

**Step 2: Commit**

```bash
git add apps/web/src/components/finance/BalanceTab.tsx
git commit -m "feat: add BalanceTab component"
```

---

### Task 17: Create FinanceView Container

**Files:**
- Create: `apps/web/src/components/finance/FinanceView.tsx`

**Step 1: Create the component**

```tsx
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
      {/* Header */}
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

      {/* Tabs */}
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'spendings' && <SpendingsTab />}
        {activeTab === 'income' && <IncomeTab />}
        {activeTab === 'utilities' && <UtilitiesTab />}
        {activeTab === 'balance' && <BalanceTab />}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/finance/FinanceView.tsx
git commit -m "feat: add FinanceView container"
```

---

### Task 18: Integrate FinanceView into App.tsx

**Files:**
- Modify: `apps/web/src/App.tsx`

**Step 1: Import FinanceView**

Add at the top with other component imports:

```typescript
import { FinanceView } from '@/components/finance/FinanceView';
```

**Step 2: Add 'Finance' to VIEW_TITLES**

Find the `VIEW_TITLES` constant and add:

```typescript
finance: 'Finance',
```

**Step 3: Add FinanceView rendering**

In the `NotesPage` component, find where full-page views are rendered (look for `view === 'graph'` or `view === 'daily'` checks). Add a similar block for finance:

```tsx
if (view === 'finance') {
  return <FinanceView />;
}
```

Place this near the other full-page view checks (before the list+editor layout).

**Step 4: Commit**

```bash
git add apps/web/src/App.tsx
git commit -m "feat: integrate FinanceView into app"
```

---

### Task 19: Manual End-to-End Testing

**No files to modify. Testing only.**

**Step 1: Start the backend**

Run: `cd /Users/roman/Desktop/personal/every-note/backend && uv run uvicorn app.main:app --reload --port 8000`

Verify: Server starts without errors. Check http://localhost:8000/docs for finance endpoints.

**Step 2: Start the frontend**

Run: `cd /Users/roman/Desktop/personal/every-note/apps/web && npm run dev`

**Step 3: Test in browser**

1. Click "Finance" in sidebar - Finance view appears with year selector + 4 tabs
2. **Spendings tab**: Add category, edit name, enter amounts for several months, verify totals, delete category
3. **Income tab**: Enter gross amounts, verify computed fields (Нетто, ЄСВ, ЄП, totals), verify quarterly sums
4. **Utilities tab**: Add address, edit name, enter gas/water readings, verify consumption deltas, delete address
5. **Balance tab**: Add row, edit name, enter UAH/USD/EUR amounts, verify totals, delete row
6. **Year selector**: Switch years, verify data persists per year

**Step 4: Fix any issues found during testing**

**Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address finance module issues"
```
