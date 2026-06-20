# Campaign History (audit log)

Add a per-campaign **History** button that opens a timestamped activity feed of everything that happened in that campaign: calls placed, emails sent (with recipient), lead edits, lead status changes, archives/restores, campaign status changes, etc.

## What gets logged

For each campaign, a row per event with: timestamp, actor (user or "system"), event type, target lead (if any), and a short human-readable message + structured details.

Event types covered:
- `call_placed` — outbound call started (to whom, phone)
- `call_completed` — outcome (answered / no_answer / interested / demo_booked / not_interested), duration
- `email_sent` — template, recipient email, subject
- `email_failed` — recipient + error
- `lead_created`, `lead_updated` (which fields), `lead_status_changed` (from → to)
- `lead_archived`, `lead_restored`, `lead_deleted`
- `campaign_created`, `campaign_status_changed`, `campaign_archived`, `campaign_restored`

## Data model

New table `public.outbound_campaign_events`:
- `campaign_id` (fk, indexed)
- `lead_id` (nullable, fk, indexed)
- `actor_user_id` (nullable — null = system/automation)
- `event_type` (text)
- `message` (short human string, e.g. "Email sent to john@acme.com")
- `details` (jsonb — free-form payload: from/to status, fields changed, durations, error, etc.)
- `created_at` (timestamptz default now())

RLS: super_admin can read/insert (matches existing outbound tables). Service role full access for edge functions.

Index on `(campaign_id, created_at desc)` for fast feed loads.

## Where events get written

Centralized helper `logCampaignEvent(supabase, {...})` used by:
- `twilio-outbound-call` — `call_placed` on dial
- `twilio-outbound-status` — `call_completed` with AnsweredBy / CallStatus / duration
- `retell-call-webhook` — `lead_status_changed` after analysis (interested/demo_booked/not_interested)
- `send-outbound-email` (or wherever campaign emails go out) — `email_sent` / `email_failed`
- `process-outbound-campaign` — `campaign_status_changed` when auto-completing
- Frontend (`OutboundCampaignsSection.tsx`) — lead/campaign archives, restores, deletes, status changes, lead inline edits, and bulk actions. Frontend calls a small RPC `log_campaign_event(...)` so we don't repeat insert logic everywhere.

For lead edits, capture the diff (only changed fields → details.changed = {field: {from, to}}).

## UI

In `OutboundCampaignsSection.tsx`:
- Add a **History** button (clock icon) next to each campaign row's existing action buttons.
- Clicking opens a side `Sheet` titled "Campaign history — {campaign name}".
- Inside: vertical timeline grouped by day, newest first. Each item: time (HH:mm), icon by event type, one-line message, optional lead name link, expandable "Details" showing the jsonb pretty-printed.
- Filter chips at top: All / Calls / Emails / Edits / Status. Search box for lead name/email.
- Lazy-load 100 most recent, "Load more" pagination.

## Not in scope (to keep it small)
- No CSV export of history (can add later).
- No per-lead history view — for now everything rolls up under the campaign sheet (lead name shown per row).
- No backfill of past activity — history starts from when this ships.

## Files

- Migration: new `outbound_campaign_events` table + RLS + `log_campaign_event` SQL function.
- `supabase/functions/twilio-outbound-call/index.ts` — emit `call_placed`.
- `supabase/functions/twilio-outbound-status/index.ts` — emit `call_completed`.
- `supabase/functions/retell-call-webhook/index.ts` — emit `lead_status_changed`.
- `supabase/functions/process-outbound-campaign/index.ts` — emit `campaign_status_changed` on auto-complete.
- Any existing campaign-email edge function (locate during impl) — emit `email_sent`/`email_failed`.
- `src/components/admin/outbound/OutboundCampaignsSection.tsx` — History button + Sheet + log calls on UI actions.
- New `src/components/admin/outbound/CampaignHistorySheet.tsx` — the timeline UI.
