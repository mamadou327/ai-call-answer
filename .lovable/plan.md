# Fix: Demos booked in the wrong year/month

## Root cause

In `supabase/functions/retell-call-webhook/index.ts`, the AI extractor (`extractWithAI`) asks Gemini to return `demo_datetime` as an ISO 8601 string, but the system prompt never tells the model what today's date is. When a caller says "next Tuesday" or "May 15th", the model falls back to its training-data sense of "now" — which is why it produced a May 2024 date even though we're in June 2026.

There is also no sanity check: any past date the model returns gets written straight into `outbound_demos.demo_datetime` and emailed out.

## Fix

Two small changes to `extractWithAI` in `supabase/functions/retell-call-webhook/index.ts`:

1. **Inject the real current date/time into the system prompt** so the model resolves relative phrases ("tomorrow", "next Friday", "the 15th") against the actual call date. Use Europe/London time since that matches the business.
   - Include full weekday, date, and timezone, e.g. `Today is Tuesday, 9 June 2026 (Europe/London).`
   - Explicit rule: "All relative dates must resolve to a date on or after today. Never output a date in the past."

2. **Post-extraction guard**: after parsing the JSON, if `demo_booked` is true and `demo_datetime` is either missing, unparseable, or in the past, treat the booking as not confirmed (`demo_booked = false`, `demo_datetime = null`) and log a warning. This prevents bad data from reaching `outbound_demos` and stops the wrong-date email going out.

No schema changes, no client changes, no changes to other functions.

## Technical details

- File: `supabase/functions/retell-call-webhook/index.ts`, function `extractWithAI` and the block that handles `analysis.demo_booked`.
- Date string built with `new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })`.
- Past-date check: `new Date(analysis.demo_datetime).getTime() < Date.now() - 5 * 60 * 1000` (5-minute grace).
- Aligns with the project rule "System prompt: always inject full calendar date and dynamic timezone".

## Out of scope

- Changing the Retell agent prompt itself (you control that in Retell).
- Backfilling the existing wrongly-dated demo row — delete it from the Demos tab once this ships.
