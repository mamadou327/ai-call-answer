# PWA + Push Notifications — status check

Good news: this feature was already built in the previous turns of this project. Every piece from your three-part request is in place:

## What already exists

**1. PWA setup**
- `public/manifest.json` — name "Aivia", short_name "Aivia", `display: standalone`, brand `theme_color #8b5cf6`, icons 192/512 present in `public/icons/`
- `public/sw.js` — caches only static shell + hashed assets, network-only for `*.supabase.co` and `/functions/v1/*` (never caches API)
- `src/lib/pwa/register-sw.ts` — guarded registration (skips dev / iframe / Lovable preview)
- `src/main.tsx` — registers the SW on load
- `index.html` — Apple meta tags (`apple-mobile-web-app-capable`, status bar, `apple-touch-icon`, theme-color) already set

**2. Push notifications**
- `push_subscriptions` table exists with RLS scoped to `auth.uid()`
- `src/lib/push/subscribe.ts` — PushManager subscribe / unsubscribe / state helpers
- `supabase/functions/send-push-notification/index.ts` — VAPID web-push sender, prunes 404/410 endpoints, guarded by `x-internal-secret: CRON_SECRET`
- Triggers wired: new booking / cancel / reschedule / message (in `twilio-media-stream`) and missed call (in `notify-missed-call`)

**3. Install banner + push prompt**
- `PwaInstallBanner.tsx` — dismissable, uses `beforeinstallprompt`, iOS Safari share-sheet instructions dialog, persists dismissal in localStorage
- `PushEnableCard.tsx` — dashboard prompt to enable notifications, persists dismissal
- Both mounted at the top of `src/pages/Dashboard.tsx` for business owners

## The only remaining step: VAPID keys

Push cannot actually deliver until VAPID keys are configured. They aren't in the secret list yet.

Generate a keypair locally:

```bash
npx web-push generate-vapid-keys
```

Then add these to **Project Settings → Secrets**:

- `VAPID_PUBLIC_KEY` — the public key
- `VAPID_PRIVATE_KEY` — the private key
- `VAPID_EMAIL` — `mailto:support@aiviaapp.co.uk` (optional; already defaults to this)
- `VITE_VAPID_PUBLIC_KEY` — same value as `VAPID_PUBLIC_KEY` (the browser needs it to subscribe)

Once those four are in place, on next deploy:
1. Sign into the dashboard on a phone (Android Chrome, or iOS 16.4+ after "Add to Home Screen").
2. Tap **Enable** on the notifications card.
3. I can then invoke `send-push-notification` with a test payload to confirm end-to-end delivery.

## Plan for this turn

Because everything requested is already implemented, no code changes are needed. After you generate and add the VAPID secrets, tell me and I'll run a delivery test and confirm the push lands on your device. If you'd rather I re-verify or tweak anything specific (e.g. adjust the banner copy, change caching behaviour, add more trigger events), say which part and I'll adjust.
