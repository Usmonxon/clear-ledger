

# Mobile-Native PWA Experience

Redesign the mobile view to match the reference app screenshots -- a native-feeling finance tracker with grouped transaction lists and a full-screen edit drawer.

## What Changes

### 1. Mobile Transaction List (Records View)
- Group transactions by date with bold date headers (e.g., "2 MARCH", "28 FEBRUARY")
- Each row shows: category icon (colored circle), category name, account name below it, amount in red/green on the right, time on the right
- Search bar at the top
- Period filter tabs at the bottom (7 days, 30 days, 12 weeks, 6 months, 1 year)
- Floating "+" button to add new transaction
- This replaces the current table layout on mobile only; desktop keeps the existing table

### 2. Mobile Transaction Edit/Add (Full-Screen Drawer)
- Use a bottom drawer (vaul) on mobile instead of the side sheet
- Type selector as segmented tabs: Expense | Income | Transfer
- Large colored amount display (red for expense, green for income, blue for transfer)
- Currency badge next to amount
- Form fields as list rows with icons: Account, Category, Date & Time, Note
- Full-width "Save" button at the bottom

### 3. Bottom Navigation Bar (Mobile Only)
- Fixed bottom nav with icons for: Dashboard, Records, Accounts, Reports, Settings
- Replaces the sidebar on mobile for more native feel
- Active tab highlighted

## Technical Details

### Files to Create
- `src/components/MobileTransactionList.tsx` -- grouped-by-date transaction list with search, period filter, and FAB
- `src/components/MobileTransactionDrawer.tsx` -- full-screen drawer for add/edit using vaul Drawer component
- `src/components/MobileBottomNav.tsx` -- fixed bottom navigation bar

### Files to Modify
- `src/pages/Transactions.tsx` -- detect mobile via `useIsMobile()`, render `MobileTransactionList` on small screens, keep existing table on desktop
- `src/components/TransactionSheet.tsx` -- on mobile, delegate to `MobileTransactionDrawer` instead of the Sheet
- `src/components/AppLayout.tsx` -- on mobile, hide sidebar header trigger, add `MobileBottomNav` at the bottom, use safe-area insets for PWA
- `src/index.css` -- add safe-area padding utilities and bottom-nav spacing
- `src/components/AppSidebar.tsx` -- hide sidebar entirely on mobile (bottom nav replaces it)

### Key Implementation Notes
- Use `useIsMobile()` hook to conditionally render mobile vs desktop layouts
- Use `date-fns` `format` for date grouping and time display
- Category icons mapped from a simple icon map (using lucide icons)
- Amount formatting with currency prefix, colored by type
- Drawer uses vaul's `Drawer` component already in the project
- Bottom nav uses `NavLink` for active state, with `pb-safe` for iOS home indicator
- Add `env(safe-area-inset-bottom)` padding for notched devices

