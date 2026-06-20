# Bulk "Call again" for selected leads

Yes — a retry control is a good idea. No-answers today are stuck at `status = no_answer` and the campaign processor only picks up `status = pending`, so without this they never get tried again. You said you want a bulk action where you pick the leads, so here's the plan.

## What you'll see in the UI

In the campaign's Leads table (`OutboundCampaignsSection.tsx`, LeadsTab):

1. A new checkbox column at the start of each row, plus a "select all (filtered)" checkbox in the header.
2. When 1+ leads are selected, a sticky action bar appears above the table showing:
   - "X selected"
   - **Call again** button (primary)
   - **Clear selection** button
3. Tip: combine with the existing **Status = no answer** filter to quickly select everyone who didn't pick up, then hit Call again.

## What "Call again" does

For each selected lead:
1. Update the row: `status = 'pending'`, `sms_sent = false` (so the no-answer SMS follow-up can fire again if it no-answers again), clear `twilio_call_sid` and `retell_call_id`. Keep `retry_count`, transcript, recording, notes, interest_level untouched.
2. After the DB update, call the existing `process-outbound-campaign` edge function with `{ campaign_id, force: true }` so it bypasses the calling-days/hours window and immediately starts dialing the now-pending leads (respecting `calls_per_day_limit` and `delay_between_calls_seconds`, which is what we want).
3. Toast the result: "Retrying N leads — M calls started" or the appropriate skipped reason (daily cap, etc.) using the same result-handling pattern as the existing `activateCampaign`.

## Guardrails

- Confirm dialog: "Call N selected leads again?" before firing.
- Disable the button and show a spinner while the request is in flight.
- If a lead's current status is `do_not_call` or `demo_booked`, exclude it from the retry with a warning toast (those shouldn't be re-dialed accidentally even if selected).
- Selection state clears after a successful retry and after changing filters.

## Files touched

- `src/components/admin/outbound/OutboundCampaignsSection.tsx` — LeadsTab only: add `selectedIds` state, checkbox column, bulk action bar, `retrySelected()` handler. No changes elsewhere.

## Not in scope

- No edge function changes (the existing `process-outbound-campaign` with `force: true` already does what we need).
- No DB schema or migration changes.
- No per-lead "Call again" button (you asked for bulk-with-selection only).
