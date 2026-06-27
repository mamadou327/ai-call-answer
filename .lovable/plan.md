## Why the call history is empty

Two separate problems were found:

1. **The admin UI can't read the history table.** `public.outbound_lead_calls` has RLS scoped to super_admin, but it has **zero Data‑API GRANTs** — no role (anon, authenticated, service_role) can `SELECT` it through the client. So when the "Call history" panel queries it, PostgREST returns an empty list for every lead, even though the table actually contains 48 rows.

2. **History rows are missing for older calls.** 83 leads have been dialled (`twilio_call_sid IS NOT NULL`) but only 48 have a row in `outbound_lead_calls`. The earlier campaign calls happened before the webhook started writing history rows, so 35 dialled leads have transcript/recording on the lead row itself but no entry in the history table.

## Fix

### 1. Grant Data‑API access to `outbound_lead_calls` (migration)

RLS already locks the table to `super_admin` via `has_role(...)`. Add the missing grants so the policy is actually reachable:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbound_lead_calls TO authenticated;
GRANT ALL ON public.outbound_lead_calls TO service_role;
```

### 2. Backfill missing history rows from the leads table (one-off insert)

For every lead with a `twilio_call_sid` or `retell_call_id` that does **not** already have a row in `outbound_lead_calls`, insert one row using the data already stored on the lead:

```sql
INSERT INTO public.outbound_lead_calls
  (lead_id, campaign_id, retell_call_id, twilio_call_sid,
   recording_url, transcript, duration_seconds, outcome, called_at)
SELECT
  l.id, l.campaign_id, l.retell_call_id, l.twilio_call_sid,
  l.call_recording_url, l.call_transcript, l.call_duration_seconds,
  l.status, COALESCE(l.last_called_at, l.updated_at, now())
FROM public.outbound_leads l
WHERE (l.twilio_call_sid IS NOT NULL OR l.retell_call_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.outbound_lead_calls c WHERE c.lead_id = l.id
  );
```

This recovers history for the ~35 leads currently missing one and preserves what's on the lead row (recording, transcript, duration, outcome, time).

### 3. No code changes needed

`retell-call-webhook` already upserts into `outbound_lead_calls` on every `call_analyzed` event (keyed on `retell_call_id`), so once grants exist and the backfill runs, the admin UI's existing query in `OutboundCampaignsSection.tsx` will start returning history immediately and will keep growing on each new call attempt (multiple attempts per lead are preserved because each gets a unique `retell_call_id`).

## Verification

- After the migration: re-query `information_schema.role_table_grants` to confirm `authenticated` has SELECT and `service_role` has ALL on `outbound_lead_calls`.
- After backfill: `SELECT count(*) FROM outbound_lead_calls` should jump from 48 to ~83, and every lead with `twilio_call_sid` should have at least one history row.
- In the admin app, open any previously-dialled lead → "Call history" should now show the attempt with recording + transcript.
