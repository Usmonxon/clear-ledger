

## Unified Multi-Currency Reports and Cross-Currency Transfers

### Problem
1. Reports (P&L, Cashflow) currently filter by a single currency and cannot show a consolidated view across all currencies.
2. Transfers between accounts in different currencies (e.g., selling USD for UZS) are not supported -- the form uses a single currency/amount field.

### Solution Overview

**Database: New `exchange_rates` table + new transaction fields**

Create an `exchange_rates` table where you manually set rates per month, and add `target_currency` + `target_amount` fields to `transactions` for cross-currency transfers.

**Reports: Add "ALL (unified)" option** that converts every transaction to a chosen base currency using rates from the exchange_rates table.

---

### 1. Database Migration

**New table: `exchange_rates`**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL) -- each user manages their own rates
- `month` (text, e.g. "2025-01") -- the month this rate applies to
- `from_currency` (text, e.g. "USD")
- `to_currency` (text, e.g. "UZS")
- `rate` (numeric, e.g. 12800) -- 1 unit of from_currency = rate units of to_currency
- `created_at`, `updated_at`
- UNIQUE constraint on (user_id, month, from_currency, to_currency)
- RLS: users can only CRUD their own rates

**Alter `transactions` table:**
- Add `target_currency` (text, nullable) -- the currency of the destination account in a cross-currency transfer
- Add `target_amount` (numeric, nullable) -- the amount received in the destination currency

### 2. Settings: Exchange Rates Management UI

Add a new tab "Курсы валют" in the Settings page:
- A simple table/form where user enters monthly rates (e.g., "Фев 2025: 1 USD = 12,800 UZS", "1 RUB = 140 UZS")
- Pre-fill with common pairs: USD->UZS, RUB->UZS
- Users can add/edit/delete rates per month

### 3. Cross-Currency Transfer in TransactionSheet

When `type === "transfer"`:
- After selecting "from" and "to" accounts, detect if their currencies differ
- If currencies differ, show two amount fields:
  - "Сумма списания" (debit amount in source currency)
  - "Сумма зачисления" (credit amount in destination currency)
- Save `amount` + `currency` as the source side, `target_amount` + `target_currency` as the destination side

### 4. Unified Report Mode in P&L and Cashflow

In both `PnLReport.tsx` and `CashflowReport.tsx`:
- Add a new option to the currency selector: "ВСЕ (в UZS)" / "ВСЕ (в USD)" -- unified view converting everything to the selected base currency
- When "unified" mode is active:
  - Fetch exchange rates from the `exchange_rates` table
  - For each transaction, convert its amount to the base currency using the rate for that transaction's month
  - If no rate exists for a specific month/pair, show a warning badge
- Keep existing per-currency filter as-is

### 5. Fix Account Balances for Cross-Currency Transfers

Update `Accounts.tsx` balance logic:
- For cross-currency transfers, deduct `amount` (in source currency) from `from_account` and add `target_amount` (in target currency) to `to_account`

### 6. Hook: `useExchangeRates`

A new reusable hook providing:
- `rates` data (fetched from DB)
- `convert(amount, fromCurrency, toCurrency, month)` helper function
- CRUD mutations for managing rates

---

### Technical Details

**Migration SQL (summary):**
```text
CREATE TABLE exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month text NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month, from_currency, to_currency)
);
-- RLS policies for exchange_rates
-- Add columns to transactions
ALTER TABLE transactions
  ADD COLUMN target_currency text,
  ADD COLUMN target_amount numeric;
```

**Files to create:**
- `src/hooks/useExchangeRates.ts` -- CRUD hook + convert helper

**Files to modify:**
- `src/pages/Settings.tsx` -- add "Курсы валют" tab
- `src/components/TransactionSheet.tsx` -- cross-currency transfer UI (detect different currencies, show two amount fields)
- `src/pages/PnLReport.tsx` -- add unified currency option
- `src/pages/CashflowReport.tsx` -- add unified currency option
- `src/pages/Accounts.tsx` -- handle target_amount for cross-currency transfers
- `src/pages/Transactions.tsx` -- display target_amount/target_currency in table
- `src/data/mockData.ts` -- update Transaction type with new optional fields
- `src/integrations/supabase/types.ts` -- auto-updated after migration

