## Fix: Normalise caller phone number before lead lookup

In `supabase/functions/twilio-inbound-sales/index.ts`:

1. After reading `fromNumber` from Twilio params, add a `normalisePhone` helper that:
   - Strips whitespace and non-digit/`+` characters
   - Converts `00…` international prefix to `+…`
   - Converts UK national format (`07…`, `01…`, `02…`) to `+44…`
   - Ensures a leading `+`
2. Compute `normalisedFrom` and use it in the primary `outbound_leads` lookup (replacing the current `.eq("phone_number", fromNumber)`).
3. If no lead matches and `normalisedFrom !== fromNumber`, run a fallback lookup against the raw `fromNumber` to cover rows stored in a different format.
4. Log both `fromNumber` and `normalisedFrom` so future mismatches are diagnosable.
5. Redeploy `twilio-inbound-sales`.

No schema or UI changes. No other functions touched.