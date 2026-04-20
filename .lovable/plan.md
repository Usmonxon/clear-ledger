

## Plan: Make PnL numbers clickable → drill down to filtered transactions

Click any amount cell in the PnL table and land on the Transactions page, pre-filtered to show exactly the rows that sum to that number.

### How it works

Each data cell in the PnL report corresponds to a slice of transactions defined by three dimensions:
- **Category** (e.g. "Подписка amoCRM") — or "all" for aggregate rows (ДОХОДЫ, СЕБЕСТОИМОСТЬ, ОПЕРАЦИОННЫЕ РАСХОДЫ, ЧИСТАЯ ПРИБЫЛЬ)
- **Reporting month** (e.g. `2026-04`) — or "all" for the ГОД (year) column
- **Type bucket** — income / cogs / opex / all

Clicking a cell navigates to `/transactions` with those dimensions as URL query params. The Transactions page reads the params and applies them as filters on top of the existing filter UI.

### Changes

**1. `src/pages/PnLReport.tsx`**
- Wrap every numeric `<td>` (category rows, aggregate rows ДОХОДЫ/СЕБЕСТОИМОСТЬ/ОПЕРАЦИОННЫЕ РАСХОДЫ, ВАЛОВАЯ ПРИБЫЛЬ, ЧИСТАЯ ПРИБЫЛЬ, and the ГОД column) in a clickable element that calls `navigate('/transactions?...')`.
- Skip РЕНТАБЕЛЬНОСТЬ row (percentages aren't drillable).
- Also pass `currency=<baseCurrency>` and, when unified mode is active, `unified=1` so the destination can show the same scope.
- Add subtle hover styling (underline + cursor-pointer) so users see cells are interactive.
- Propagate click handler into `ReportRow`, `CategoryRows`, `ProfitRow` via a new `onCellClick(category, monthKey)` prop.

**2. `src/pages/Transactions.tsx`**
- Read `useSearchParams` on mount and merge into existing filter state:
  - `category` → category filter
  - `month` → reporting_month filter (new — currently filter is by transaction_date range, we'll add reporting_month filter)
  - `bucket=income|cogs|opex` → type filter (expense with COGS flag subset, or income)
  - `currency` → currency filter
- When arriving via drill-down, show a small dismissible banner at the top: "Фильтр из ОПУ: Подписка amoCRM · Апрель 2026 · UZS [×]" so the user understands why the list is narrowed and can clear it in one click.
- Clearing the banner removes the URL params and resets those filters.

**3. `src/components/PnLSankeyChart.tsx`** (optional, same session)
- Make Sankey nodes clickable too, using the same URL scheme. This is a small addition since the data is already available.

### URL examples
```text
/transactions?category=Подписка amoCRM&month=2026-04&bucket=cogs&currency=UZS
/transactions?bucket=income&month=2026-04&currency=UZS          ← clicked ДОХОДЫ Apr
/transactions?bucket=cogs&currency=UZS                          ← clicked СЕБЕСТОИМОСТЬ ГОД
/transactions?month=2026-04&currency=UZS                        ← clicked ЧИСТАЯ ПРИБЫЛЬ Apr (shows all income+expense for that month)
```

### Filter semantics note
PnL groups by `reporting_month` (accrual), not `transaction_date`. The drill-down filter must use `reporting_month` so the resulting transaction list sums back to the exact number clicked. I'll add a reporting-month filter to the Transactions page (a simple equality check — no new UI needed beyond the dismissible banner, since it's driven by URL only).

### Out of scope
- Clicking the РЕНТАБЕЛЬНОСТЬ % row
- Deep-linking from the Cashflow report (can be added later with the same pattern)
- Persisting the filter across navigation (it lives only while the URL param is present)

