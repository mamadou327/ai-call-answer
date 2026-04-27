## Goal
Two small infra tweaks: harden `.gitignore` and configure the React Query client with sensible defaults plus a dev-only error logger.

## Changes

### 1. `.gitignore`
Append explicit entries (currently only `*.local` covers `.env.local` indirectly, and `.env` is not ignored at all):
```
.env
.env.local
```

### 2. `src/App.tsx` — QueryClient configuration
Replace the bare `new QueryClient()` with explicit defaults applied to both queries and mutations, plus a global `QueryCache` / `MutationCache` error handler that logs only when `import.meta.env.DEV` is true.

```ts
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";

const logError = (error: unknown) => {
  if (import.meta.env.DEV) {
    console.error("[QueryClient]", error);
  }
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
    mutations: {
      retry: 1,
    },
  },
  queryCache: new QueryCache({ onError: logError }),
  mutationCache: new MutationCache({ onError: logError }),
});
```

Notes:
- `onError` on `defaultOptions.queries` is deprecated in React Query v5 — the correct place for a global handler is on `QueryCache`/`MutationCache`, which is what's used above.
- `staleTime: 30000` (30s) applies to queries only, as intended.
- Dev gate uses Vite's `import.meta.env.DEV` (no leakage in production builds).

## Files touched
- `.gitignore` (append 2 lines)
- `src/App.tsx` (QueryClient setup only; routes untouched)

No other files, no DB changes, no dependency changes.