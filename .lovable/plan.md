## Goal

Switch outbound SMS follow-ups to use a Twilio Alphanumeric Sender ID (default "Aivia") instead of the UK landline `from_number`, and make the sender ID configurable from the admin Retell Settings tab.

## Changes

### 1. Database
Add a new column to `outbound_settings`:
- `sms_sender_id text not null default 'Aivia'`
- Backfill any existing row so it has the default.

### 2. Edge function — `supabase/functions/twilio-outbound-status/index.ts`
- Select `sms_sender_id` alongside `from_number` and `mo_phone_number` from `outbound_settings`.
- In `sendFollowUpSms`, use `sms_sender_id` (fallback to `"Aivia"`) as the SMS `From` instead of `fromNumber`.
- Drop `from_number` from the "missing settings" guard for SMS (voice calls still need it, but SMS no longer does). Keep the `mo_phone_number` guard.
- Update log messages to reflect the new field.
- Redeploy the function.

### 3. Admin UI — `src/components/admin/outbound/OutboundCampaignsSection.tsx` (Retell Settings tab)
- Add a new text input **"SMS Sender Name"** bound to `outbound_settings.sms_sender_id`.
- Helper text: *"Max 11 characters, letters and numbers only. Recipients see this instead of a phone number."*
- Client-side validation: trim, enforce `^[A-Za-z0-9]{1,11}$` on save; show inline error and block save if invalid.
- Include the field in the existing save handler / upsert payload.

## Out of scope
- Voice `from_number` is unchanged.
- No backfill of SMS to previously-failed leads (still pending your earlier go-ahead).

## Technical notes
- Alphanumeric Sender IDs work out of the box for UK numbers — one-way only (no replies), which matches the current "Call Mo on…" copy.
- Twilio rejects sender IDs >11 chars or with spaces/punctuation, hence the client-side regex.
