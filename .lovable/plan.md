# Admin Dashboard fixes

## 1. Plan tier sometimes shows "Starter" instead of what the customer chose

The data is correct in the database — the issue is admin loaded its data before the new signup existed, so the tier falls back to the default label until you refresh.

**Fix:** Add a realtime subscription so admin auto-refreshes whenever a business signs up or changes its plan.

- File: `src/pages/AdminDashboard.tsx` — add a `useEffect` that subscribes to a Supabase realtime channel listening for any change on `businesses` and `business_settings`. On any event, re-run `loadBusinesses()`. Clean up on unmount.
- Migration: enable realtime publication on both tables.

## 2. Add a Delete (trash) button next to Review in the Pending tab

Currently each row in the Pending applications table only has **Review**. Add a trash icon next to it so admins can remove a pending or rejected application (test signups, spam, etc.).

**Behaviour:**
- Trash icon shown on every row in the Pending tab (only for super admins, or sub-admins with `can_approve_businesses`).
- Click opens a confirm dialog: *"Delete '<business name>'? This will permanently remove the business application and all its settings. This cannot be undone."*
- On confirm: delete the row from `businesses`. Cascading FKs clean up `business_settings`, etc. Show a success toast.
- Realtime subscription from fix #1 makes the row disappear instantly.

**Database change required:** `businesses` currently has no DELETE policy, so deletes are blocked by RLS. Add policies for super admins and approved sub-admins to delete.

## Files touched
- `src/pages/AdminDashboard.tsx` — realtime subscription + delete button + confirmation dialog + delete handler
- New migration — enable realtime publication on `businesses` and `business_settings`, add DELETE RLS policies on `businesses`

No other pages, no UI redesign, no changes to dashboard/settings/billing/approval flow.
