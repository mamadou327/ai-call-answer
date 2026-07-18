# Wire up the landing Contact Us form

Right now `src/components/landing/ContactDialog.tsx` just shows a success toast and discards the submission. If a prospect contacts you from the landing page, you never see it. This plan matches the same shape as demo requests and support messages: store it, email admins, push admins.

## What to build

1. **New edge function `send-contact-inquiry`** (public, no JWT)
   - Accepts: `name`, `email`, `phone?`, `inquiryType`, `message`
   - Basic validation (lengths, email format, required fields)
   - Inserts a row into `demo_requests` (reuse existing table — it already has name/email/phone/message and shows in the admin Demo Requests tab) with a marker in the message like `[Contact — {inquiryType}]` so you can tell them apart. Avoids a new table + new admin tab.
   - Sends email to admins via Resend (same pattern as `public-send-inquiry`), subject: `New contact inquiry from {name} — {inquiryType}`
   - Fans out push to all `super_admin`/`sub_admin` devices via `send-push-notification`, title `New contact inquiry`, body `{name} — {inquiryType}`, url `/admin`

2. **Update `src/components/landing/ContactDialog.tsx`**
   - Add zod validation (name ≤100, email valid ≤255, phone ≤30 optional, inquiryType required, message 10–1000)
   - Call `supabase.functions.invoke("send-contact-inquiry", { body: {...} })`
   - Keep the existing success toast + reset + close behavior
   - Show field errors inline on validation failure
   - Show destructive toast on network/function error

3. **Register the function** in `supabase/config.toml` with `verify_jwt = false` so anonymous landing visitors can submit.

## Why reuse `demo_requests`

- Already surfaced in the admin dashboard (`AdminDemoRequestsTab`), so contact inquiries show up immediately without new UI.
- Same shape (name/email/phone/message/status), and the "inquiry type" fits naturally in the message prefix.
- One less table, one less RLS/grant surface to maintain.

If you'd rather have a dedicated tab/table for contact inquiries separate from demo requests, say the word and I'll adjust — but reusing is faster and keeps the admin surface tidy.

## Files touched

- `supabase/functions/send-contact-inquiry/index.ts` (new)
- `supabase/config.toml` (register function, `verify_jwt = false`)
- `src/components/landing/ContactDialog.tsx` (validation + real submit)

No DB migration needed.
