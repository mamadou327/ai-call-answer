## Why no SMS was sent

`supabase/functions/twilio-outbound-status/index.ts` (lines 86–101) only sends the follow-up SMS when both `from_number` AND `mo_phone_number` are present in `outbound_settings`. In the DB right now:

- `from_number` = `+442039174778` ✅
- `mo_phone_number` = `NULL` ❌

So every call hits the `"skipping SMS — missing from_number or mo_phone_number"` branch and the SMS is silently skipped. No follow-up has ever been attempted (all `sms_sent = false`, including the no-answer leads with `retry_count > 0`).

There's also a secondary issue: the SMS rule requires `retry_count > 0` (i.e. at least one prior attempt), so a brand-new lead's very first no-answer will not trigger an SMS — only the **second** no-answer onward. Worth confirming this still matches your intent.

## Fix

1. **Seed `mo_phone_number`** in `outbound_settings` to `+447491004439` (the number used in the SMS copy) so follow-ups start sending immediately, without waiting for the admin UI save.
2. **Improve logging** in `twilio-outbound-status` so future skips are obvious in edge function logs:
   - Log lead id, status, retry_count, and the exact reason on every decision (sent / skipped because already sent / skipped because missing settings / skipped because retry_count = 0).
   - Log the Twilio Message SID on success.
3. **Surface the missing-number state in the admin UI** (`OutboundCampaignsSection.tsx` Retell Settings tab): show a small amber warning next to the "Mo's callback number" field when it's empty — "SMS follow-ups are disabled until this number is set."
4. **Redeploy** `twilio-outbound-status`.

## Out of scope (ask before doing)

- Backfilling SMS to the existing eligible no-answer leads (`retry_count > 0`, `sms_sent = false`). Currently 5+ leads would qualify. Let me know if you want this.
- Changing the `retry_count > 0` rule so the SMS fires after the **first** no-answer instead of the second.

## Technical notes

- Step 1 is a single `UPDATE outbound_settings SET mo_phone_number = '+447491004439'` (data change, via insert tool — no schema migration).
- Step 2 adds `console.info`/`console.warn` lines inside the existing `if (isNoAnswer ...)` block; no behaviour change.
- Step 3 is a presentational tweak in the existing Retell Settings tab — no new state, just a conditional helper text under the input.
