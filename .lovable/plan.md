# Admin PWA push notifications

Currently admins only get email alerts. Add PWA push for three admin events, on top of the existing emails.

## Events to push
1. **New business signup** — awaiting approval
2. **New service request** — e.g. SMS enablement request
3. **New demo request** — landing page submissions

## Approach

Reuse the existing `send-push-notification` edge function, which already supports targeting by `user_id`. No schema changes needed.

1. **Resolve admin recipients**
   - Query `user_roles` for users with role `super_admin` (and `sub_admin` if present in the enum).
   - Send push to each of those `user_id`s.

2. **Wire push into existing admin flows**
   Alongside the current `send-admin-notification` email call, invoke `send-push-notification` once per admin user with:
   - Business signup → title "New business signup", body `<business name> is awaiting approval`, url `/admin`, tag `admin-signup`.
   - Service request → title "New service request", body `<business> requested <type>`, url `/admin`, tag `admin-service-request`.
   - Demo request → title "New demo request", body `<name> requested a demo`, url `/admin`, tag `admin-demo`.

   Call sites to update:
   - Business signup path (wherever `send-admin-notification` is invoked with `signupType: "business"` — typically `Signup.tsx` / signup edge function).
   - Service request path (`signupType: "sms_request"` caller).
   - Demo request path (demo request submission handler).

3. **Admin push subscription**
   Admins subscribe to push the same way owners do — via the existing `PushEnableCard` when they're signed in. The card is currently rendered on the business dashboard. Add it to `AdminDashboard.tsx` (without the `businessId` requirement — pass `null`/omit, since admin subscriptions are user-scoped) so admins can enable push on their device.
   - Minor tweak to `PushEnableCard` and `subscribeToPush` to allow a missing `businessId` (admins have no business).

4. **No changes** to owner/staff push behavior. Emails to `mlaye915@gmail.com` continue as-is.

## Technical notes
- `send-push-notification` already accepts `{ user_id, title, body, url, tag }` — no function changes required beyond calling it in a loop over admin user IDs.
- Auth header: internal `x-internal-secret: CRON_SECRET` (already used by other callers).
- `push_subscriptions` table already stores per-user endpoints, so admin devices work with the existing schema.
