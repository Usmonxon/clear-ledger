

## Plan: Switch table font to Fira Sans

Replace the current Inter (body) + JetBrains Mono (numbers) combination with **Fira Sans** across the transaction table and app body text.

### Changes

1. **`src/index.css`** — Add Google Fonts import for Fira Sans (weights 400, 500, 600, 700). Update `body` font-family to use `'Fira Sans'` instead of `'Inter'`.

2. **`tailwind.config.ts`** — Update the `fontFamily.sans` array to lead with `'Fira Sans'`.

3. **`src/pages/Transactions.tsx`** — Remove `font-mono` classes from table cells (date, amount, reporting_month) so they use Fira Sans instead of JetBrains Mono. Add `tabular-nums` where needed for aligned numbers.

4. **`src/index.css`** — Update `.font-mono` usage in `.matrix-cell` and amount classes to use Fira Sans with `font-variant-numeric: tabular-nums` instead of JetBrains Mono.

This gives the table a cohesive, modern look with one font throughout while keeping numbers properly aligned via OpenType tabular figures.

