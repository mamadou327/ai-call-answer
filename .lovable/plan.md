## Outbound calling fixes (Lovable side: 1–4)

Fixes 5–7 are Retell dashboard changes you'll do yourself.

### Fix 1 — Only process `call_analyzed` events
In `supabase/functions/retell-call-webhook/index.ts`, immediately after parsing the JSON body and logging the event, short-circuit any event that isn't `call_analyzed` (so `call_ended`, `call_started`, etc. all return 200 with no side effects). This is the real duplicate-processing fix. The existing `lead.call_transcript` early-return guard stays as a belt-and-braces safety.

### Fix 2 — Remove Twilio recording (kill the beep)
In `supabase/functions/twilio-outbound-call/index.ts`, drop from the Twilio call params:
- `Record: "true"`
- `RecordingStatusCallback`
- `RecordingStatusCallbackMethod`

Retell already records on its side and the URL arrives via `call.recording_url` in `call_analyzed`, which `retell-call-webhook` already reads — no changes needed there.

The `twilio-outbound-recording` edge function becomes dead code but I'll leave it in place (no harm, avoids touching `config.toml` / unrelated infra).

### Fix 3 — Calendar availability check
New edge function `supabase/functions/check-demo-availability/index.ts` (`verify_jwt = false`):
- POST body: `{ demo_datetime: string (ISO 8601) }`
- Validates input with Zod.
- Queries `outbound_demos` for rows with `status = 'scheduled'` where `demo_datetime` is within ±30 minutes of the proposed time.
- Returns `{ available: true }` or `{ available: false, conflict: "<ISO datetime of nearest existing demo>" }`.
- Full CORS headers, always returns 200 on success, 400 on bad input.

Add a `[functions.check-demo-availability]` block to `supabase/config.toml` with `verify_jwt = false`.

You'll then wire this up in the Retell agent as a custom function `check_calendar_availability` pointing at:
`https://zyqzypyncugihrawhppg.supabase.co/functions/v1/check-demo-availability`

### Fix 4 — Demo email deduplication
In `retell-call-webhook`, restructure the demo-booked branch so the confirmation emails (to Mo + prospect) only send when the `outbound_demos` insert actually succeeded with a new row. Because we already have a `UNIQUE INDEX` on `outbound_demos(lead_id)`, I'll:
- Capture the insert result; if it errored with a unique-violation (Postgres code `23505`), log "demo already exists, skipping emails" and skip both emails.
- Only on a clean insert do we build the HTML and call `sendEmail` for Mo and the prospect.
- Build the email HTML once into a single variable (no accidental duplication).

This combined with Fix 1 means: one webhook processed → one DB insert → one email pair, ever.

### Deployment
After edits, deploy: `retell-call-webhook`, `twilio-outbound-call`, `check-demo-availability`.

### What does NOT change
- `twilio-outbound-twiml` (SIP bridge to Retell)
- `twilio-outbound-status`
- Retell registration call / dynamic variables
- DB schema (no migration needed — unique index already exists)
- Admin UI (Retell Settings tab)

### Out of scope (you handle in Retell)
- Fix 5: spell numbers as words in the agent prompt
- Fix 6: mandatory email-capture rule in the BOOKING A DEMO section
- Fix 7: Interruption Sensitivity → 1.0
