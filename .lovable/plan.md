

# Dividends Logic

Dividends are cash withdrawals by owners that reduce cash (appear in Cashflow/DDS) but do NOT affect profit (excluded from PnL), similar to how transfers are already handled.

## Approach

Add `dividend` as a new transaction type. In reports, treat it like an expense in Cashflow but exclude it from PnL (same as transfers).

## Changes

### 1. Database Migration
- Add `'dividend'` to the `transaction_type` enum: `ALTER TYPE transaction_type ADD VALUE 'dividend'`

### 2. Type Definitions (`src/data/mockData.ts`)
- Add `"dividend"` to `TransactionType` union

### 3. Categories (`src/hooks/useCategories.ts` + `src/data/mockData.ts`)
- Add default dividend categories (e.g., "Дивиденды") to `CASHFLOW_CATEGORIES`
- Support `"dividend"` type in `getCategoryNames`

### 4. Transaction Form (`src/components/TransactionSheet.tsx` + `MobileTransactionDrawer.tsx`)
- Add "Дивиденды" as a 4th type option in the type selector
- Dividend form behaves like expense: account selector, amount, currency, date, category, description
- No "Месяц ОПУ" needed (or auto-filled but irrelevant since PnL ignores it)

### 5. Cashflow Report (`src/pages/CashflowReport.tsx`)
- Show dividends as a separate section row (like transfers), or group under expenses -- separate "ДИВИДЕНДЫ" section below profit makes more sense
- Dividends reduce net cash flow but appear after the profit line

### 6. PnL Report (`src/pages/PnLReport.tsx`)
- Already filters `t.type !== "transfer"` -- add `&& t.type !== "dividend"` to exclude dividends from PnL

### 7. Transaction List & Mobile List
- Show dividend transactions with a distinct color (e.g., orange/purple)
- Display in lists like any other transaction

### 8. Account Balances (`src/hooks/useAccounts.ts`)
- Dividends reduce the account balance (treat as outflow, like expense)

## Report Layout (Cashflow)

```text
ДОХОДЫ          ...
  CRM           ...
  ...
РАСХОДЫ         ...
  oylik         ...
  ...
ПРИБЫЛЬ (по кассе)  Income - Expense
ДИВИДЕНДЫ       ...        ← new section
ПЕРЕВОДЫ        ...
```

Profit line stays as Income minus Expense. Dividends shown separately below, not affecting profit calculation.

