## Plan

Fix the admin application review so it shows the tier the customer actually selected at signup.

### What I’ll change
1. Add backend read access for admin users to the business settings records they need during application review.
   - Super admins will be able to read `business_settings`.
   - Sub-admins with business-approval permission will also be able to read it.
   - Write access will stay restricted; this only fixes visibility.

2. Tighten the admin dashboard tier display logic.
   - Keep loading the chosen tier from `business_settings`.
   - Stop masking missing/inaccessible data with misleading fallbacks where needed.
   - Ensure both the table and the “Review Application” dialog show the same tier consistently.

3. Verify the latest pending signup path.
   - The latest test application already has a saved tier in the database.
   - After the policy fix, the pending/recent applications list and review modal should show that saved value instead of “Not selected”.

### Why this is happening
The signup flow is already saving the chosen tier correctly. The issue is that the admin dashboard reads the tier from `business_settings`, but current backend access rules only allow business owners/staff to read that table. Admins are blocked, so the UI ends up showing a fallback instead of the real selection.

### Technical details
- Files involved:
  - `src/pages/AdminDashboard.tsx`
  - new backend migration for `business_settings` RLS policies
- No new tables are needed.
- No public data exposure is needed.
- Expected result for your latest test signup: the admin should see the selected tier (for the newest record, it is already stored in the backend).