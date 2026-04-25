## Goal
Prevent white-screen crashes by catching render errors at the app root and showing a branded fallback with reload / go-home actions.

## Changes

**1. New file: `src/components/ErrorBoundary.tsx`**
- React class component (hooks can't catch render errors)
- `getDerivedStateFromError` to flip into error state
- `componentDidCatch` to `console.error` the error + stack
- Fallback UI built with existing shadcn `Card` + `Button`:
  - Centered, full-screen, matches Aivia brand
  - Title: "Something went wrong"
  - Short friendly message
  - Collapsible `<details>` showing the error message (helps you debug if a customer screenshots it)
  - Two buttons: **Reload page** (`window.location.reload()`) and **Go home** (`window.location.href = "/"`)

**2. Edit: `src/App.tsx`**
- Import `ErrorBoundary`
- Wrap the outermost provider tree (around `<BrowserRouter>` / `QueryClientProvider`) so any route or provider crash is caught

## Out of scope
- Per-tab boundaries (decided against — global is enough for now)
- Error telemetry to a DB table (can add later if you want crash analytics)
- Touching `.env` (false alarm — it only contains publishable keys, managed by Lovable)
