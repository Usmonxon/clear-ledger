# Sankey Cash Flow Chart for P&L Page

Add a Sankey diagram below the existing pivot table on the P&L page, visualizing income categories flowing into a central "Revenue" node, then branching out to expense categories, with a surplus/deficit node at the bottom — matching the reference screenshot.

## Approach

Recharts (already installed) includes a built-in `Sankey` component. No new dependencies needed.

## What to Build

### New Component: `src/components/PnLSankeyChart.tsx`

- Accepts the already-computed `incomeCategories` and `expenseCategories` Maps from the P&L page
- Transforms them into Sankey `nodes` and `links` format:
  - **Left nodes**: Each income category (e.g., "CRM", "amoCRM подписка") with its yearly total
  - **Center node**: "Выручка" (Revenue) — total income
  - **Right nodes**: Each expense category with its yearly total
  - **Bottom-right node**: "Прибыль" (Profit) or "Убыток" (Loss) — the net result
- Links flow: `[income cat] → [Revenue] → [expense cat]` and `[Revenue] → [Profit/Loss]`
- Green color for income flows, red/gray gradient for expense flows, green for surplus
- Custom node renderer showing category name + formatted amount (like the reference image)
- Custom link renderer with gradient fills
- Wrapped in a card with a collapsible toggle so users can show/hide it

### Modify: `src/pages/PnLReport.tsx`

- Import and render `PnLSankeyChart` between the header/currency selector and the pivot table
- Pass `incomeCategories`, `expenseCategories`, `totalIncome`, `totalExpense`, `netProfit`, and `baseCurrency` as props
- Only render when data exists (`monthKeys.length > 0`)

## Technical Notes

- Use `import { Sankey, Tooltip } from "recharts"` — the Sankey component expects `{ nodes: [{name}], links: [{source, target, value}] }` where source/target are numeric indices
- Custom `node` prop for rendering labeled rectangles with amounts
- Custom `link` prop for gradient-colored flows (green for income side, red for expense side)
- Chart height ~400px, responsive width via the existing `ChartContainer` or a simple div
- On mobile, the chart scrolls horizontally or stacks vertically with smaller font

&nbsp;

Period is selected separately for sankey chart. 