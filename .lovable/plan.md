
# PWA + Push Notifications

Two things: make Aivia installable, and send Web Push alerts to business owners when the AI books, cancels, reschedules, leaves a message, or misses a call.

## Assumptions

- Push targets **business owners only** (users linked to a business via `businesses.owner_id`). Staff push is out of scope unless you ask.
- Icons: I'll generate `icon-192.png` and `icon-512.png` from the existing Aivia logo in `public/`. If you want different artwork, say so.
- `theme_color`: I'll pull the brand purple from `index.css` (matches the spinner `#8b5cf6` already used). Confirm if you want a different value.
- VAPID keys: I cannot generate them for you (they must be identical in server + client). You'll run `npx web-push generate-vapid-keys` locally and paste `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` into Project Settings → Secrets. I'll also expose the public key to the frontend as `VITE_VAPID_PUBLIC_KEY` in `.env` (public by design).
- Service worker is **manually authored** (no `vite-plugin-pwa`) because we also need `push` + `notificationclick` handlers, and the PWA skill's guard rules must apply (never register in Lovable preview/iframe/dev).

## 1. PWA shell

**`public/manifest.json`** — name, short_name, start_url `/`, display `standalone`, background `#ffffff`, theme_color brand purple, icons 192 + 512.

**`public/icons/icon-192.png` + `icon-512.png`** — generated from the Aivia logo.

**`public/sw.js`** — hand-written service worker with:
- `install`: precache app shell (`/`, `/index.html`, built CSS/JS via runtime, favicon, logo, icons) — skipWaiting.
- `activate`: cleanup old caches, `clients.claim()`.
- `fetch`: `NetworkFirst` for navigations, `CacheFirst` for same-origin hashed static assets, **network-only** for anything hitting `*.supabase.co` or `/functions/v1/` (no API caching).
- `push`: parse JSON `{ title, body, url, tag }`, `self.registration.showNotification(...)`.
- `notificationclick`: focus existing client or open `url`.

**`src/lib/pwa/register-sw.ts`** — registration wrapper that refuses to register in dev, iframes, and any Lovable preview host (`id-preview--*`, `preview--*`, `*.lovableproject.com`, `*.lovableproject-dev.com`, `*.beta.lovable.dev`) or when `?sw=off`. Called from `src/main.tsx`.

**`index.html`** — add `<link rel="manifest">`, `apple-mobile-web-app-*` meta tags, `apple-touch-icon`, `theme-color`.

## 2. Push subscriptions

**Migration** — new `public.push_subscriptions`:
- `id`, `user_id` (FK `auth.users`), `business_id` (FK `businesses`), `subscription jsonb`, `endpoint text unique`, `created_at`, `updated_at`.
- GRANT SELECT/INSERT/UPDATE/DELETE to `authenticated`; GRANT ALL to `service_role`.
- RLS: users can select/insert/update/delete rows where `auth.uid() = user_id`.
- Unique on `endpoint` so re-subscribing upserts.

**`src/lib/push/subscribe.ts`** — helpers:
- `subscribeToPush(businessId)`: requests permission, `sw.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, upserts row.
- `unsubscribeFromPush()`.
- `getPushState()`: returns `{ supported, permission, subscribed }`.

## 3. Dashboard install + notification prompts

**`src/components/dashboard/PwaInstallBanner.tsx`** — dismissable banner at top of `Dashboard.tsx`:
- Captures `beforeinstallprompt` (Android/desktop Chrome). On tap, calls `prompt()`.
- On iOS (no event available), opens a small dialog with the Share → Add to Home Screen instructions.
- Hidden when `display-mode: standalone`, or when localStorage `aivia_pwa_banner_dismissed=1`, or after successful install.

**`src/components/dashboard/PushEnableCard.tsx`** — small card shown after first login for business owners with `Notification.permission === 'default'`. On accept, calls `subscribeToPush`. Dismissible via localStorage flag.

Both mount inside the existing owner `Dashboard.tsx` only (not `StaffDashboard`).

## 4. Edge function `send-push-notification`

`supabase/functions/send-push-notification/index.ts`:
- Auth: internal only, verify_jwt disabled but require `x-internal-secret` header matching `CRON_SECRET` (already in secrets) — safer than a public function.
- Body: `{ business_id, title, body, url?, tag? }` validated with Zod.
- Loads all `push_subscriptions` for `business_id`.
- Sends via `npm:web-push@3` using VAPID env vars.
- On 404/410 responses, deletes the dead subscription row.
- CORS headers on all responses.
- Adds to `supabase/config.toml`: `[functions.send-push-notification] verify_jwt = false`.

## 5. Trigger points

In `supabase/functions/twilio-media-stream/index.ts`, after each of these AI tool executions resolves successfully, call `send-push-notification` (fire-and-forget, wrapped in try/catch so it never blocks the call):

| Tool | Title | Body |
|---|---|---|
| `executeCreateBooking` | "New booking" | "{customer} booked {service} with {staff} on {date} at {time}" |
| `executeCancelBooking` | "Booking cancelled" | "{customer} cancelled their {service} on {date}" |
| `executeRescheduleBooking` | "Booking moved" | "{customer} rescheduled to {date} at {time}" |
| `executeLeaveMessage` | "New message from {caller}" | "Tap to view" |

Missed-call notification: hook into the existing missed-call insert path (I'll locate — likely `twilio-voice-webhook*` or the call-end handler in `twilio-media-stream`). Only fires when the call ended with no booking created and no message left in this session.

All URLs point to `/dashboard` with a relevant tab query param.

## 6. Verification

- Build check.
- Confirm SW registers in a published/production build only (not in the Lovable preview iframe).
- Once VAPID secrets are set, I'll call `send-push-notification` with a test payload via `supabase--curl_edge_functions` and confirm delivery in the browser.

## What you need to do

1. Run `npx web-push generate-vapid-keys` locally.
2. In Project Settings → Secrets, add: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` (e.g. `mailto:support@aiviaapp.co.uk`).
3. I'll also add `VITE_VAPID_PUBLIC_KEY` to `.env` (same public key value) so the frontend can subscribe. Tell me the public key when you paste it, or confirm I should read it back from the secret at build time via a small helper.

## Technical notes

- iOS Safari 16.4+ requires the app to be installed to home screen **before** push works. The banner + push prompt order in the UI already handles this: install first, then permit notifications.
- No `vite-plugin-pwa` — the PWA skill's guarded registration wrapper covers all Lovable preview hosts.
- Service worker is served from `/sw.js` at the origin root so its scope covers the whole app.
- The kill-switch cleanup path from the PWA skill isn't needed since no prior app SW exists (`public/widget.js` is a plain JS widget, unrelated).
