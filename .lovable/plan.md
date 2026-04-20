

## Plan: Show total amount in Transactions list

Add a running total of the currently visible transactions so users can verify the sum matches the PnL cell they drilled in from (and generally see "how much" any filtered view represents).

### Where it appears

A compact summary strip sits directly under the header (or under the drill banner when present), on both desktop and mobile.

**Content**
- **Доход:** sum of `income` rows — green
- **Расход:** sum of `expense` rows — red
- **Итого:** net (income − expense) — neutral, bold
- Each total is grouped by currency, so mixed-currency views show e.g. `UZS 12 760 000 · USD 1 200`
- Transfers and dividends are excluded from the net (they'd distort the number) but shown as a separate muted line if any are present: `Переводы: UZS 500 000`

**Layout**
```text
Desktop:  [Доход: +12 760 000 UZS]  [Расход: −3 400 000 UZS]  [Итого: +9 360 000 UZS]
Mobile:   stacked, smaller font, same color coding
```

### Implementation

**`src/pages/Transactions.tsx`**
- Add a `useMemo` that walks `filtered` and builds `{ income: {UZS, USD, RUB}, expense: {...}, transfer: {...}, net: {...} }`.
- Render a new `<TotalsBar>` inline component:
  - Desktop: horizontal row of pill-style badges above the table, below the drill banner.
  - Mobile: rendered inside `MobileTransactionList` via a new `totals` prop (or a header slot) so it sits just below the drill banner and above the grouped list.
- Formatting uses existing `formatAmountShort` for consistency with table cells.
- Hidden when `filtered.length === 0`.

**`src/components/MobileTransactionList.tsx`**
- Accept an optional `header?: ReactNode` prop that renders above the grouped list, so the same `<TotalsBar>` can be reused without duplicating logic.

### Out of scope
- Persisting totals across pagination (no pagination yet)
- Converting mixed currencies to the base currency in this bar (would hide the source amounts; current drill-downs are single-currency anyway)
- Adding totals to the Accounts page

