# Security Audit & Hardening Plan

## Answers to your questions

**1. RLS on every table** — Mostly yes. Every business-scoped table has RLS enabled with policies that scope by `business_id` → `owner_id = auth.uid()` (or staff membership). **However**, the `businesses` and `staff` tables have public-read policies (for the online booking widget) that leak sensitive columns. Needs fixing.

**2. Client data exposure** — **Not safe right now.** The public booking policy on `businesses` returns *every column* including `twilio_webhook_token`, `messagebird_token`, `stripe_account_id`, `staff_join_code`, and assigned phone numbers to anonymous users. The `staff` public policy leaks staff `phone` and `email`. Confirmed by the scanner with live sample data.

**3. Authentication** — Properly set up. Dashboard routes require auth, RLS blocks cross-tenant access, role checks use the `has_role()` security-definer pattern (no recursion). Good.

**4. HTTPS** — Yes. Lovable + custom domain (`aiviaapp.co.uk`) serve over HTTPS only.

**5. Other issues found** — See fixes below.

---

## Critical fixes (must do before paying clients)

### 1. Stop leaking business credentials to the public
The `Public can view limited business info` policy on `businesses` exposes tokens, Stripe IDs, and staff join codes to anonymous users.
- Create a `public_businesses` view containing only: `id, business_name, address, booking_slug, online_booking_enabled, online_booking_message, logo_url, business_type, cuisine_type, social_*, website, custom_booking_domain`.
- Drop the anonymous branch from the existing policy (keep owner/staff/admin branches).
- Point the public booking page (`EmbedBookingPage`, public booking lookup) at `public_businesses`.

### 2. Stop leaking staff phone/email to the public
- Create a `public_staff` view with only `id, business_id, name, role, color, avatar_url`.
- Replace the anonymous-read policy on `staff` so anon can only read via the view.

### 3. Lock down Realtime channel authorization
No RLS on `realtime.messages` means any authenticated user can subscribe to any channel and receive row-change broadcasts for `bookings`, `customers`, `calls_log`, `messages`, `orders`.
- Add an RLS policy on `realtime.messages` that only allows subscriptions where the topic encodes a `business_id` the user owns or is staff of.

### 4. Fix menu-images storage policies
Current policies let any authenticated user delete/overwrite any business's menu images.
- Rewrite UPDATE/DELETE policies to require `(storage.foldername(name))[1] = business_id::text` and verify ownership, matching the `business-logos` / `business-gallery` pattern.

### 5. Sanitize ILIKE inputs in edge functions
`twilio-media-stream` and `twilio-voice-continue` interpolate `customer_name`, `recipient_staff_name`, and `booking_code` into ILIKE patterns without escaping `%` / `_`.
- Add an `escapeLikePattern()` helper and wrap every user-supplied ILIKE value. Prefer `.eq()` for booking codes when possible.

---

## Medium-priority fixes

### 6. Restrict `demo-audio` bucket writes
Currently any authenticated user can upload/overwrite/delete. Restrict INSERT/UPDATE/DELETE to `super_admin` only (reads can remain public since the bucket is intentionally public).

### 7. Scope `menu_item_option_sizes` public read
Current policy is `USING (true)`. Replace with the same guard used on `menu_items` (only when parent business has `online_booking_enabled=true` and `status='approved'`).

### 8. Lock down SECURITY DEFINER functions
Revoke `EXECUTE` from `anon`/`authenticated` on internal helpers that should not be callable directly from the client (e.g. `ensure_super_admin`, `generate_*`, `protect_*`, `assign_staff_role_on_membership`). Keep execute on functions the client legitimately calls (`refresh_staff_join_code_if_expired`, `validate_staff_join_code`, `create_staff_membership_with_code`, `has_role`, `get_pending_invite_for_email`, `get_invite_by_token`, `get_current_month_call_count`).

### 9. Public storage buckets allow listing
`business-logos`, `business-gallery`, `menu-images`, `demo-audio` have broad SELECT policies that allow listing all files. Replace `SELECT` policies with ones that allow direct object access (`bucket_id = '…'`) but block listing via `name IS NOT NULL AND auth.role() = ...` — or accept the risk for non-sensitive public assets and document it.

---

## Also worth enabling

- **Leaked-password protection (HIBP)** on Supabase Auth — one-line config change.
- **Update security memory** to record what's intentionally public (booking widget data) so future scans don't re-flag it.

---

## What I will NOT change

- Existing owner/staff/admin RLS policies — they're correctly written using `has_role()` and `is_staff_member_of_business()` security-definer functions, no recursion.
- Auth flow — already correct.
- Dashboard routes — already protected.

---

## Order of execution

1. Migration: create `public_businesses` + `public_staff` views, rewrite public-read policies, fix `menu-images` and `demo-audio` storage policies, scope `menu_item_option_sizes`, revoke EXECUTE on internal SECURITY DEFINER functions, add Realtime authorization policy.
2. Update frontend code that reads public business/staff data to use the new views.
3. Add `escapeLikePattern()` helper and apply in `twilio-media-stream` and `twilio-voice-continue` edge functions.
4. Enable HIBP password protection.
5. Update security memory.
6. Re-run security scan and confirm clean.

This is ~1 migration + ~4 file edits + 2 edge function edits. Safe to ship before onboarding.