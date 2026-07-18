# Add 3 more admin push notification triggers

Extend the existing admin push fan-out so admins get alerted for three more "someone is waiting on you" events, on top of the current business signup / service request / demo request.

## New triggers

1. **Upgrade request** — a business submits a tier upgrade request.
   - Title: "New upgrade request"
   - Body: `<business> requested <tier>`
   - URL: `/admin`, tag: `admin-upgrade-request`

2. **New staff signup** — a staff member signs up (already emailed, no push today).
   - Title: "New staff signup"
   - Body: `<staff name or email> joined <business>`
   - URL: `/admin`, tag: `admin-staff-signup`

3. **New support message from a business** — a business owner sends a message via the support/contact-admin flow (`admin_conversations` / new row in `messages` addressed to admin).
   - Title: "New support message"
   - Body: `<business>: <first ~80 chars of message>`
   - URL: `/admin`, tag: `admin-support-message`

## Implementation

Reuse the existing `pushToAdmins(...)` helper in `supabase/functions/send-admin-notification/index.ts` — it already queries `user_roles` for `super_admin`/`sub_admin` and fans out via `send-push-notification`. No schema changes, no new function.

1. **`send-admin-notification`**
   - Extend `signupType` to also accept `"upgrade_request"` and `"support_message"`.
   - Extend the request body with optional fields: `tierRequested`, `messagePreview`.
   - In the staff branch (existing `signupType: "staff"`) add a `pushToAdmins(...)` call — currently it only emails.
   - Add push (and matching email) branches for `upgrade_request` and `support_message`.

2. **Call sites**
   - **Upgrade requests:** wherever a row is inserted into `upgrade_requests` (settings/billing flow) — invoke `send-admin-notification` with `signupType: "upgrade_request"`. If not already emailing admins there, this also gives them the email.
   - **Support messages:** in the client handler that creates the admin conversation / message from `ContactAdminForm` (or the corresponding edge function), invoke `send-admin-notification` with `signupType: "support_message"`.
   - **Staff signup:** no new call site — the existing staff-signup call already fires `send-admin-notification`; only the function body needs the added `pushToAdmins` call.

3. **No changes** to owner/staff push behavior, existing 3 admin triggers, or the `push_subscriptions` schema.

## Technical notes

- `send-push-notification` already targets by `user_id` and dedupes per subscription, so looping over admin `user_id`s is safe.
- All new triggers are fire-and-forget (wrapped in try/catch) so a push failure never blocks the underlying action or the admin email.
- Tags are distinct per trigger so a device shows separate notifications rather than collapsing them.
