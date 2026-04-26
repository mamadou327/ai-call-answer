# Simplified signup, post-approval setup checklist, improved admin approval

Three connected changes: replace the multi-step onboarding with one signup screen that captures everything (including chosen tier), add a clean dismissable setup checklist on the dashboard after approval, and upgrade the admin approval flow with full applicant info, tier override, internal note, and rejection reason.

## 1. Single-screen signup with plan selection

**New file:** `src/pages/Signup.tsx` — replaces the current multi-step `/onboarding` flow entirely.

One form, one submit. Fields:
- First Name, Last Name (required)
- Business Name (required)
- Business Type — dropdown: Restaurant — Pickup/Takeaway, Restaurant — Dine-in, Restaurant — Both, Salon/Barbershop/Spa (maps to existing values: `restaurant_pickup`, `restaurant_dine_in`, `restaurant_hybrid`, `salon`)
- Phone Number (required)
- Email, Password, Confirm Password (zod-validated; password ≥8 chars, passwords match)

Below the fields: three plan cards rendered from `src/lib/tiers.ts` (Starter, Growth, Scale only — Enterprise is not self-serve here). Cards are clickable/selectable; Growth shows "Most Popular" ribbon. **Submit button is disabled until a plan is selected.**

Note under the cards (literal copy):
> "No payment is taken today. Our team will be in touch after approval to arrange billing."

**On submit (in this order, with rollback-style error handling):**
1. `supabase.auth.signUp({ email, password, options: { emailRedirectTo: ${origin}/dashboard } })`. Reuse the same friendly error mapping already in `Auth.tsx` (duplicate / weak / invalid).
2. Insert `profiles` row (`first_name`, `last_name`, `email`).
3. Assign `business_owner` role in `user_roles`.
4. Insert `businesses` row with `owner_id`, `business_name`, `main_phone`, `business_type`, `address: ""` (will be filled from setup checklist), `status: 'pending'`.
5. Insert `business_settings` row with `business_id` and `subscription_tier` set to the selected plan (`'starter' | 'growth' | 'scale'`). The `subscription_tier` column already exists with a default of `'starter'` and the right enum.
6. Invoke existing `send-admin-notification` edge function with the same payload `OnboardingStep5` uses today.
7. Navigate to `/pending-approval`.

**Routing changes (`src/App.tsx`):**
- Replace `/onboarding` route with `/signup` pointing at the new page.
- Sign-in button on `/auth` still goes to `/auth` (login mode); the signup path on `/auth` and the "Switch to sign up" link redirect to `/signup`.
- `Auth.tsx` `checkOnboardingStatus`: when a user has no business at all, send to `/signup` (not `/onboarding`). When they have a `rejected` business, also send to `/signup` (so they can reapply by editing their existing business — see step 8 below).

**Reapply behaviour for rejected businesses:** if `/signup` loads with a logged-in user who already has a `rejected` business row, prefill the form, show their existing rejection reason at the top, and on submit `update` the existing business + settings row instead of insert (status back to `pending`).

**Files to delete (literal — verified to exist):**
- `src/pages/Onboarding.tsx`
- `src/components/onboarding/OnboardingStep1.tsx`
- `src/components/onboarding/OnboardingStep2.tsx`
- `src/components/onboarding/OnboardingStep3.tsx`
- `src/components/onboarding/OnboardingStep4.tsx`
- `src/components/onboarding/OnboardingStep5.tsx`
- `src/components/onboarding/RestaurantDetailsStep.tsx`
- `src/components/onboarding/BusinessCategorySelector.tsx`
- `src/components/onboarding/RestaurantTypeSelector.tsx`
- `src/components/onboarding/BusinessTypeSelector.tsx` (only used by the deleted steps; verified unreferenced elsewhere)

## 2. Post-approval setup checklist on the dashboard

The dashboard already has `SetupChecklist` and a `loadSetupChecklist(biz)` helper in `src/pages/Dashboard.tsx`. We update what it tracks and make it dismissable.

**`SetupChecklist.tsx` updates:**
- Add an "X" close button in the card header.
- Header copy: "Complete your setup to get the most out of Aivia".

**`Dashboard.tsx` updates to `loadSetupChecklist`:**

Common items (all business types):
- Business address — `action: "business"` (complete when `biz.address` is non-empty)
- Website (optional — shown but not blocking) — `action: "business"`
- Opening hours — `action: "hours"`
- Phone number setup — `action: "phone"` (complete when `biz.assigned_aivia_number` OR `biz.twilio_phone_number` is set, OR a `business_number_selection` row exists)

Restaurant-extra items:
- Cuisine type (`biz.cuisine_type`) — `action: "business"`
- Menu link (`biz.menu_link`) — `action: "business"`
- Average prep time (`biz.average_prep_time_minutes`) — `action: "orders"`
- Table count — dine-in / hybrid only — `action: "tables"` (complete when `restaurant_tables` count > 0)
- Payment methods accepted (`biz.payment_methods?.length > 0`) — `action: "payments"`

Salon-extra items:
- Services offered — `action: "services"` (complete when `services` count > 0)
- Staff count — `action: "staff"` (complete when `staff` count > 0)
- Booking preferences — `action: "booking"` (complete when `customer_settings` row exists for this business)

**Dismissal:** persist per-business in `localStorage` under key `aivia_setup_checklist_dismissed_${businessId}`. Hide whenever every item is complete OR the user dismissed it. The current `isSetupComplete` check in `Dashboard.tsx` becomes `isSetupComplete || dismissed`.

## 3. Improved admin pending-business view & approval dialog

All edits in `src/pages/AdminDashboard.tsx`.

**Pending businesses table — add/expose columns:**
| Owner | Business | Type | Phone | Email | Plan | Applied | Waiting |
- Owner = `${profile.first_name} ${profile.last_name}`
- Email = `profile.email`
- Type = humanized `business_type`
- Plan = read from `business_settings.subscription_tier` (TIERS[…].name); load alongside businesses in `loadBusinesses` via a single join-shaped query, or a follow-up `business_settings` fetch keyed by `business_id`.
- Applied = `created_at` (date)
- Waiting = relative time, e.g. "2 days ago" — use `date-fns` `formatDistanceToNow` (already a transitive dep via shadcn calendar; verify and import).

**Approval dialog (`Dialog` already used in this page):**
When admin clicks View/Approve on a pending business, show a focused approval dialog (separate from the existing multi-step number-assignment flow, which is kept for post-approval edits):
- Read-only summary: business name, owner name, contact email, contact phone, applied date.
- "Selected tier" `Select` prefilled from `business_settings.subscription_tier` with options Starter/Growth/Scale/Enterprise (so admin can override).
- Optional `Textarea` "Internal note" (saved to a new `businesses.admin_note` column).
- Two primary buttons: **Approve** and **Reject**.

**Approve action:**
1. `update business_settings.subscription_tier` to the (possibly overridden) tier.
2. `update businesses` set `status='approved'`, `admin_note=…`.
3. Invoke existing `send-business-approval-email` (no signature change needed — it already takes business name, owner email, dashboard URL).
4. Reload list, close dialog.

**Reject action (replaces today's instant reject):**
- Show inline `Textarea` for "Reason for rejection" (required, ≤1000 chars).
- On confirm: `update businesses` set `status='rejected'`, `rejection_reason=…`, `admin_note=…`.
- Invoke a small new edge function **`send-business-rejection-email`** that emails the owner (uses `RESEND_API_KEY` + `RESEND_FROM_EMAIL` like the approval one) saying "Unfortunately your application wasn't approved", includes the reason, and tells them they can reapply by signing back in. Modeled directly on `send-business-approval-email/index.ts`.

**Database migration (one migration):**
- `ALTER TABLE businesses ADD COLUMN admin_note text` (nullable).
- `ALTER TABLE businesses ADD COLUMN rejection_reason text` (nullable).
- No RLS changes needed — existing admin policies already cover `UPDATE` and `SELECT`.

## Out of scope (explicitly preserved as-is)

- The existing dashboard tabs, settings tabs, billing/`BillingSettings`, tier gating (`LockedFeatureCard`, `useTier`), call handling, voice selector, public booking pages, staff flows, admin tabs other than the pending businesses table, and `AccountMenu`.
- The existing post-approval "edit approved business" multi-step dialog stays intact for assigning Twilio numbers etc.

## Files that will change

**Created:**
- `src/pages/Signup.tsx`
- `supabase/functions/send-business-rejection-email/index.ts`
- A migration adding `admin_note` and `rejection_reason` to `businesses`.

**Modified:**
- `src/App.tsx` (route swap `/onboarding` → `/signup`)
- `src/pages/Auth.tsx` (route signups + new users to `/signup`; rejected users to `/signup` for reapply)
- `src/pages/Dashboard.tsx` (updated checklist contents per business type, dismissal handling)
- `src/components/SetupChecklist.tsx` (header copy + dismiss button)
- `src/pages/AdminDashboard.tsx` (richer pending table, new approval dialog, reject-with-reason)
- `supabase/config.toml` (register `send-business-rejection-email`)

**Deleted:**
- `src/pages/Onboarding.tsx`
- `src/components/onboarding/OnboardingStep1.tsx`
- `src/components/onboarding/OnboardingStep2.tsx`
- `src/components/onboarding/OnboardingStep3.tsx`
- `src/components/onboarding/OnboardingStep4.tsx`
- `src/components/onboarding/OnboardingStep5.tsx`
- `src/components/onboarding/RestaurantDetailsStep.tsx`
- `src/components/onboarding/BusinessCategorySelector.tsx`
- `src/components/onboarding/RestaurantTypeSelector.tsx`
- `src/components/onboarding/BusinessTypeSelector.tsx`

After approval, the user lands on the dashboard, sees the new setup checklist, fills in address / hours / type-specific items via the existing settings tabs, and the checklist disappears once all required items are done.
