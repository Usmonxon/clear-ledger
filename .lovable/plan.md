

## Plan: Add "is_cogs" flag to categories for Net Revenue calculation

### Overview
Add a toggle on expense categories in Settings to mark them as "cost of goods sold" (COGS / себестоимость). Then show a **NET REVENUE** row in the PnL report: `Total Income - COGS expenses`.

### Database Change
Add an `is_cogs` boolean column to the `categories` table:
```sql
ALTER TABLE public.categories ADD COLUMN is_cogs boolean NOT NULL DEFAULT false;
```

### Code Changes

1. **`src/hooks/useCategories.ts`** — Update `Category` type to include `is_cogs: boolean`. Add a `toggleCogsMutation` that updates the `is_cogs` flag for a given category ID.

2. **`src/pages/Settings.tsx`** — In the expense `CategorySection`, add a small toggle/icon button on each expense category badge to mark it as COGS (себестоимость). Visually distinguish COGS categories with a different badge style or icon.

3. **`src/pages/PnLReport.tsx`** — Fetch categories list to know which expense categories are COGS. In the `useMemo` calculation, split expenses into two groups: COGS and operating expenses. Add rows to the table:
   - ДОХОДЫ (total income)
   - income subcategories...
   - **СЕБЕСТОИМОСТЬ** (sum of COGS expense categories)
   - COGS subcategories...
   - **ВАЛОВАЯ ПРИБЫЛЬ / NET REVENUE** = income - COGS
   - РАСХОДЫ (operating expenses only, excluding COGS)
   - expense subcategories...
   - ЧИСТАЯ ПРИБЫЛЬ = income - all expenses

4. **`src/lib/exportExcel.ts`** — Update the OPU sheet export to include the COGS and Net Revenue rows in the same structure.

