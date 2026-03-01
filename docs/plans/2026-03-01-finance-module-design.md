# Finance Module Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated Finance section to Every Note with four sub-modules: constant spendings tracker, income & taxes calculator (Ukrainian ФОП system), utility meter tracker, and multi-currency balance sheet.

**Architecture:** New sidebar section ("Finance") that opens a tabbed spreadsheet-like view. Dedicated SQLite tables per section with tailored schemas. Computations (tax formulas, meter consumption deltas, totals) handled client-side. Year selector to navigate between years.

**Tech Stack:** FastAPI + SQLModel (backend), React + TypeScript + Tailwind + shadcn/ui (frontend), Zustand (state)

---

## Navigation

- Own sidebar section with Finance icon (Wallet/Calculator)
- Clicking opens Finance view in main content area (replaces note editor, same pattern as Trash/Graph)
- 4 tabs within Finance: **Spendings** | **Income & Taxes** | **Utilities** | **Balance**
- Year selector dropdown at top (defaults to current year)

## Data Model

### Spending Categories & Entries

```sql
CREATE TABLE spending_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position REAL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE spending_entries (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES spending_categories(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount REAL NOT NULL DEFAULT 0,
  UNIQUE(category_id, year, month)
);
```

- Rows = user-defined categories (addresses, subscriptions, ФОП, etc.)
- Columns = Jan–Dec + Total (sum, computed client-side)
- Bottom row = monthly totals across all categories

### Income Entries

```sql
CREATE TABLE income_entries (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  gross REAL NOT NULL DEFAULT 0,
  UNIQUE(year, month)
);
```

Computed fields (client-side, hardcoded ФОП rules):
- **Нетто (Net)** = gross × 0.92
- **ЄСВ** = 1910 (fixed monthly)
- **ЄП** = gross × 0.05
- **Всього податків (Total taxes)** = ЄСВ + ЄП

Display columns: Jan–Dec + Q1/Q2/Q3/Q4 sub-totals + Year total.
Fixed rows: Брутто (editable), Нетто, ЄСВ, ЄП, Всього податків.
Only Брутто is editable.

### Utility Addresses & Meter Readings

```sql
CREATE TABLE utility_addresses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position REAL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE meter_readings (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL REFERENCES utility_addresses(id) ON DELETE CASCADE,
  utility_type TEXT NOT NULL CHECK (utility_type IN ('gas', 'water')),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  reading REAL NOT NULL DEFAULT 0,
  UNIQUE(address_id, utility_type, year, month)
);
```

- Grouped by address (collapsible)
- Each address: gas reading, gas consumption, water reading, water consumption
- Reading rows editable; consumption = current - previous month (computed client-side)
- Previous month for January = December of previous year

### Balance Entries

```sql
CREATE TABLE balance_entries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position REAL DEFAULT 0,
  uah REAL NOT NULL DEFAULT 0,
  usd REAL NOT NULL DEFAULT 0,
  eur REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

- Rows = user-defined line items
- 3 currency columns: UAH, USD, EUR
- Bottom row = totals per currency (sum, computed client-side)

## API Endpoints

All under `/finance/` prefix. 14 endpoints total.

### Spending Categories
- `GET /finance/spending-categories` — list all, ordered by position
- `POST /finance/spending-categories` — create {name}
- `PATCH /finance/spending-categories/{id}` — update name or position
- `DELETE /finance/spending-categories/{id}` — delete with cascade

### Spending Entries
- `GET /finance/spending-entries?year=2026` — all entries for year
- `PUT /finance/spending-entries` — upsert {category_id, year, month, amount}

### Income
- `GET /finance/income?year=2026` — all entries for year
- `PUT /finance/income` — upsert {year, month, gross}

### Utility Addresses
- `GET /finance/utility-addresses` — list all, ordered by position
- `POST /finance/utility-addresses` — create {name}
- `PATCH /finance/utility-addresses/{id}` — update name or position
- `DELETE /finance/utility-addresses/{id}` — delete with cascade

### Meter Readings
- `GET /finance/meter-readings?year=2026` — all readings for year (includes previous December for consumption calc)
- `PUT /finance/meter-readings` — upsert {address_id, utility_type, year, month, reading}

### Balance
- `GET /finance/balance-entries` — list all, ordered by position
- `POST /finance/balance-entries` — create {name}
- `PATCH /finance/balance-entries/{id}` — update name/uah/usd/eur
- `DELETE /finance/balance-entries/{id}` — delete

## UI Components

### FinanceView (main container)
- Year selector dropdown
- Tab bar: Spendings | Income & Taxes | Utilities | Balance
- Renders active tab component

### SpendingsTab
- Editable grid: rows = categories, columns = months + total
- Inline cell editing (click to type, blur to save)
- "Add category" button at bottom
- Category name editable inline
- Delete category (with confirmation)
- Bottom totals row (sum per month)

### IncomeTab
- Grid with fixed rows: Брутто, Нетто, ЄСВ, ЄП, Всього
- Columns: Jan–Dec + Q1 + Q2 + Q3 + Q4 + Total
- Only Брутто cells editable
- All other values auto-computed from gross

### UtilitiesTab
- Sections per address (collapsible)
- Each section: 4 rows (gas reading, gas consumption, water reading, water consumption)
- Reading rows editable; consumption rows computed (delta)
- "Add address" button
- Address name editable

### BalanceTab
- Grid: rows = line items, columns = UAH, USD, EUR
- All cells editable
- "Add row" button
- Bottom totals row

### Shared: EditableCell component
- Click to edit, Enter/blur to save
- Number formatting (spaces for thousands)
- Handles empty/zero states
