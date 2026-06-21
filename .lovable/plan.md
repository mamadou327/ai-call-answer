## Goal
When you click **Approve & apply** on an upgrade request, the business should instantly see their new plan in their dashboard (billing page, locked features unlocked, call limits updated, etc.).

## Current behaviour
On approval, the Upgrades tab runs an `update` on `business_settings.subscription_tier`. This has the same bug we just fixed in the manual plan picker: if the business doesn't have a `business_settings` row yet (true for Lucy's demo and any business that never visited Settings), the update silently affects 0 rows and the tier never changes.

The business side reads the tier via `useTier(businessId)`, which pulls from `business_settings`. So if the row never gets created, nothing changes for them after approval.

## Fix

1. Change the approval action in `UpgradeRequestsTab` to `upsert` into `business_settings` (on conflict `business_id`) with the requested tier — same pattern as the manual picker now uses. This guarantees the change persists even with no pre-existing row.

2. Mark the request `approved` with `resolved_at` and `resolved_by = auth.uid()` (already done, just confirming).

3. After upsert, also write the change to the existing audit/log path used by the manual tier change (none today — just toast + table refresh). Nothing else required.

4. Re-confirm the business side: `useTier` already reads live from `business_settings`, so once the row is upserted the dashboard will reflect the new plan on next mount / refetch. No extra notification email is sent today; out of scope for this fix unless you want one.

## Out of scope (mention only)
- Sending the business owner a confirmation email when their upgrade is approved — easy to add later if you want.
- Stripe billing — there's no Stripe subscription tied to tiers right now; plan changes are purely an internal flag.
