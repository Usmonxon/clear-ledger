

## Plan: Group desktop transactions by date

### What changes
Currently the desktop table shows a flat list with the date repeated on every row. We'll group transactions by `transaction_date` and render a date header row spanning all columns before each group — similar to how the mobile view already groups by date.

### Implementation

**File: `src/pages/Transactions.tsx`**

1. Add a `useMemo` to group `filtered` transactions by `transaction_date` into an array of `[dateStr, transactions[]]` pairs (already sorted desc from the query).

2. Replace the flat `filtered.map(...)` in `<tbody>` with the grouped iteration:
   - For each date group, render a separator `<tr>` with a single `<td colSpan={8}>` showing the formatted date (e.g. "13 АПРЕЛЯ 2026") in bold muted text with a subtle background.
   - Then render the transaction rows as before, but **remove the date from individual rows** (or keep it lighter/hidden since the group header already shows it).

3. Use `date-fns` `format` + `parseISO` with `ru` locale (already imported in the mobile component) for the date header formatting.

### Visual result
```text
┌──────────────────────────────────────────────────┐
│  13 АПРЕЛЯ 2026                                  │  ← date header row
├──────┬──────────┬────────┬─────────┬─────────────┤
│      │ amoCRM   │ Humo   │ 1 365k  │ comment...  │
│      │ МоиЗвонки│ Humo   │   222k  │ comment...  │
├──────────────────────────────────────────────────┤
│  12 АПРЕЛЯ 2026                                  │  ← next date
├──────┬──────────┬────────┬─────────┬─────────────┤
│      │ Аренда   │ Humo   │   900k  │ comment...  │
└──────┴──────────┴────────┴─────────┴─────────────┘
```

The Date column stays in the header but individual rows won't repeat it (keeping the column for alignment consistency, just leaving cells empty or showing a short time if available later).

