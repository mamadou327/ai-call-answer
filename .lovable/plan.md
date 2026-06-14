## Outbound Email Sequence System

Adds an automated 3-step cold email sequence on top of the existing outbound campaign infrastructure, with open tracking, reply detection, and full admin UI controls.

### 1. Database migration

Single migration that:

- Adds `email`, `email1_status/sent_at/opened_at`, `email2_*`, `email3_*`, `sequence_step`, `sequence_status` columns to `outbound_leads` (defaults: status `pending`, sequence_status `active`).
- Creates `outbound_email_templates` (campaign_id FK, step_number, subject, body_html, is_reply, delay_days).
- Creates `outbound_email_log` (lead_id FK, campaign_id FK, step_number, resend_email_id, message_id, subject, status, opened_at, replied_at, sent_at).
- Adds GRANTs (authenticated + service_role) and enables RLS with admin-only policies on both new tables (mirrors `outbound_campaigns`).
- Indexes on `outbound_email_log(lead_id)`, `(campaign_id, step_number)`, `(replied_at, sent_at)`.

### 2. Edge functions

`**send-outbound-emails**` — POST `{ campaign_id, step_number }`

- Loads active leads where current step status = `pending`, `sequence_status = 'active'`, email present, not in `responded/demo_booked/not_interested/do_not_call`.
- Loads template for step. Replaces `{{first_name}}`, `{{business_name}}`, `{{business_type}}`.
- Sends via Resend from `Mo Laye <mo@aiviaapp.co.uk>`. For steps 2/3 with `is_reply`, pulls step-1 log row to set `In-Reply-To`/`References` and prefixes subject with `Re:`.
- Inserts log row first to get id, appends tracking pixel `…/track-email-open?id={log_id}`, sends, then updates the log row with `resend_email_id` + `message_id`.
- Updates lead's `emailN_status='sent'`, `emailN_sent_at=now()`, `sequence_step=N`.
- Returns `{ sent, errors }`.

`**track-email-open**` — GET `?id={log_id}`

- Updates log `opened_at` if null. Updates lead `emailN_opened_at` (by step_number) if null. Returns 1x1 transparent PNG with no-cache headers. Verify_jwt=false.

`**check-email-replies**` — POST (cron)

- For each log row where `replied_at IS NULL AND sent_at > now() - 14 days`, calls Resend `GET /emails/{id}`. If status indicates replied, sets `replied_at`, lead `sequence_status='responded'`, lead `status='interested'`, and emails `mo@aiviaapp.co.uk`.
- Verify_jwt=false (called by cron with bearer header).

`config.toml` entries added with `verify_jwt = false` for all three.

### 3. Hook into existing call outcomes

In `supabase/functions/retell-call-webhook/index.ts`, extend the lead `update` object:

- `demo_booked` → `sequence_status='demo_booked'`
- `not_interested` → `sequence_status='not_interested'`
- (`do_not_call` mapped from explicit DNC signal in analysis if present)

### 4. Cron job

Insert via `supabase--insert` (not migration, contains anon key):

- `check-email-replies` every 2h Mon–Fri 08–20 London.

### 5. Admin dashboard UI

`**OutboundCampaignsSection.tsx**` (and any campaign edit dialog inside it):

- Add collapsible "Email Sequence" section with 3 template slots. Each: Subject (Step 1 only — Steps 2/3 show "Re: &nbsp;" preview), Body textarea, Delay days (defaults 0/3/2), "Reply to original thread" checkbox (off/on/on). Helper text lists `{{variables}}`.
- On save, upsert into `outbound_email_templates` by `(campaign_id, step_number)`. On campaign create, seed defaults from spec.
- "Send Emails" button with step dropdown → confirmation dialog showing eligible lead count → invokes `send-outbound-emails` → success toast, loading state.
- Leads tab: new Email column (truncated + tooltip) + three colored dots (grey/blue/purple/green/red) using `email{N}_status` and `email{N}_opened_at`/log `replied_at`. Hover tooltip with status + timestamp (Europe/London).
- Lead detail dialog: full email sequence timeline.
- Campaign stats bar: Emails Sent, Opened (unique leads + %), Replied (+ %).
- CSV upload accepts optional `email` column; helper note added.

### 6. Rules enforced everywhere

- Send function filters out non-`active` sequence_status and missing email.
- Status transitions only forward (pending → sent → opened → replied) via conditional updates.
- All timestamps formatted in Europe/London for display.

### Technical notes

- Resend reply detection: Resend's `GET /emails/{id}` returns `last_event` which includes `delivered`, `bounced`, etc. True inbound-reply detection requires inbound parsing (Resend doesn't expose replies via that endpoint). Implementation will treat `bounced`/`complained` as terminal and rely on manual/inbound webhook for true replies; the function still runs the spec'd check and logs gracefully when reply data isn't available. Flag this caveat to the user after build.
- Tracking pixel uses public function URL with no auth (verify_jwt=false). Some inbox providers pre-fetch images, which can cause false-positive opens — standard tradeoff, noted.
- Default-template seeding happens client-side on campaign create (simpler than a DB trigger).
  #### 7. Reply detection — Gmail inbox check
  The `check-email-replies` function should NOT rely on Resend's API for reply detection since Resend does not expose reply data through its email status endpoint.
  Instead, implement reply detection by checking Mo's Gmail inbox directly:
  **Modify** `check-email-replies` **to:**
  - Query `outbound_email_log` for all sent emails where `replied_at` is null and `sent_at` is within the last 14 days
  - Collect all lead email addresses from those log entries
  - Use the Gmail API (via Google service account or OAuth token stored in environment variables) to search Mo's inbox with the query `from:{lead_email} newer_than:1d` for each lead email address
  - If a matching email is found in the inbox that was received after the outbound email was sent, treat it as a reply
  - Set `replied_at` on the log entry, set the lead's `sequence_status` to `'responded'` and `status` to `'interested'`
  - Send a notification email to `mo@aiviaapp.co.uk` with the lead's name, business and phone number
  **If Gmail API integration is too complex for this phase**, add a fallback:
  - Add a "Mark as Replied" button next to each lead in the Leads tab that manually sets `sequence_status = 'responded'` and stops all future emails for that lead
  - This allows Mo to mark replies manually when he sees them in his inbox until the automated Gmail check is built