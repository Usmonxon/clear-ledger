

# Add Dark Mode

The dark mode CSS variables are already defined in `index.css`. Just need to wire up `next-themes` (already installed) and add a toggle.

## Changes

### 1. `src/App.tsx`
- Wrap the app with `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>` from `next-themes`

### 2. `src/pages/Settings.tsx`
- Add a theme toggle (Light / Dark / System) using the existing `Select` component and `useTheme()` from `next-themes`, placed at the top of the Settings page or as a new "Внешний вид" (Appearance) section

### 3. `src/components/AppSidebar.tsx`
- Add a small theme toggle button (Sun/Moon icon) in the sidebar footer for quick access

That's it — all dark mode styles are already defined via CSS variables, so the entire UI will switch automatically.

