# Store VAPID keys and activate push

You've pasted the values in chat, so I'll store them directly with no secure form.

## Steps

1. Store three backend secrets via `set_secret` (values you provided):
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_EMAIL`

2. Add `VITE_VAPID_PUBLIC_KEY` to the project `.env`. `VITE_*` values are inlined into the browser bundle at build time — they must live in `.env`, not backend secrets.

3. Redeploy `send-push-notification` so it picks up the new VAPID config.

4. Restart the dev server so the preview build inlines `VITE_VAPID_PUBLIC_KEY`.

## After this

Open the dashboard on your phone → tap **Enable** on the notifications card → grant permission. New bookings, cancellations, reschedules, messages, and missed calls will push to your device.

Note: `set_secret` only creates new secrets — if any of these three names already exist, I'll flag it and you can rotate them in Project Settings → Secrets.
