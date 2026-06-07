## Outbound Calling System (Admin Only)

Full build of an outbound calling engine accessible only to super_admin accounts. Scope matches the brief exactly.

### 1. Database (single migration)

Four new tables with RLS restricting all access to `super_admin` role:

- **outbound_campaigns** — name, status (draft/active/paused/completed), calling_days text[], calling_start_hour, calling_end_hour, calls_per_day_limit, delay_between_calls_seconds (default 30), timestamps.
- **outbound_leads** — campaign_id FK, first_name, business_name, phone_number, email, status (pending/calling/answered/no_answer/voicemail/interested/not_interested/demo_booked/do_not_call), interest_level (hot/warm/cold), existing_solution, reason_not_interested, demo_booked bool, retry_count, last_called_at, call_transcript, call_recording_url, call_duration_seconds, notes.
- **outbound_demos** — lead_id FK, demo_date, demo_time, demo_datetime, prospect_name/business/phone/email, call_summary, status, reminder_24h_sent, reminder_1h_sent.
- **outbound_settings** — single row, outbound_prompt text, updated_at. Seeded with the default Aria prompt verbatim from the brief.

GRANTs to `authenticated` + `service_role`; policies use `has_role(auth.uid(), 'super_admin')`.

### 2. Edge Functions

- **twilio-outbound-call** — POST { lead_id }. Fetches lead, marks `calling`, dials via Twilio REST `Calls` with record=true, status_callback → `twilio-outbound-status`, recordingStatusCallback → `twilio-outbound-recording`, url → `twilio-outbound-twiml?lead_id=...`. Uses existing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN.
- **twilio-outbound-twiml** — returns `<Connect><Stream>` to existing `twilio-media-stream` WSS, with `<Parameter name="call_type" value="outbound"/>` and `<Parameter name="lead_id" .../>`.
- **twilio-outbound-status** — handles no-answer/busy/failed → status=no_answer + retry_count++; completed → last_called_at=now.
- **twilio-outbound-recording** — saves recording URL to lead.
- **process-outbound-campaign** — cron worker. For each active campaign: check London-time window, day-of-week, daily call cap; pick next pending lead; invoke `twilio-outbound-call`; sleep `delay_between_calls_seconds` between leads inside the same run.
- **send-demo-reminders** — cron. 24h + 1h reminder emails to Mo via Resend, sets `reminder_*_sent` flags.

### 3. Modify `twilio-media-stream`

When stream `customParameters` include `call_type=outbound` and `lead_id`:

- Load lead + `outbound_settings.outbound_prompt`.
- Substitute `{{first_name}}` and `{{business_name}}`.
- Use as the Realtime system prompt instead of inbound receptionist prompt; skip business/customer rehydration paths.
- At call end: save full transcript to lead, use a lightweight extraction pass (existing AI gateway) to derive interest_level, existing_solution, reason_not_interested, demo agreed + datetime + email; update lead.status; if demo booked → insert `outbound_demos` row, send Mo notification + prospect confirmation via Resend.

All existing inbound behaviour, reconnect/dedupe/state persistence work from the prior fixes remains untouched.

### 4. Admin Dashboard

New sidebar entry **Outbound Campaigns** (rendered only when `has_role super_admin`) in `AdminDashboard.tsx`. Five tabs:

1. **Campaigns** — table with status badges + KPIs (leads, calls, demos, success %), Create Campaign dialog (name, calling_days checkboxes, start/end hours, daily cap, delay seconds with helper text), row actions Start/Pause/Resume/Stop.
2. **Leads** (inside a campaign) — table with colour-coded status/interest badges, recording play button, transcript dialog; side panel with all extracted fields. Import CSV (phone, first_name, business_name), Add Lead dialog, filter bar.
3. **Demos** — Calendar/List toggle, demo cards with detail panel, mark Completed/No Show/Cancelled.
4. **Results** — totals, answer/interest/demo rates, outcome distribution chart, calls/day line chart, top existing solutions, top rejection reasons (recharts).
5. **AI Prompt** — full-width textarea bound to `outbound_settings.outbound_prompt`, Save Prompt, Reset to Default (restores seeded prompt), helper note "changes take effect on the next call made".

### 5. Emails (Resend, from [info@aiviaapp.co.uk](mailto:info@aiviaapp.co.uk))

Templates implemented inside the relevant edge functions:

- Demo booked → Mo
- Hot lead, no booking → Mo
- Demo confirmation → prospect
- 24h reminder → Mo
- 1h reminder → Mo

Bodies follow the brief verbatim.

### 6. Scheduled Jobs

Via `supabase--insert` (uses CRON_SECRET + project URL/anon key, per project pattern):

```text
process-outbound-campaign  →  */1 * * * *
send-demo-reminders        →  */30 * * * *
```

### 7. Default Prompt

Seeded into `outbound_settings` exactly as supplied in the brief (Aria script, rule precedence, opening, pitch, objections, booking flow, conversation rules).

### Technical details

- **Files added**: `supabase/functions/{twilio-outbound-call,twilio-outbound-twiml,twilio-outbound-status,twilio-outbound-recording,process-outbound-campaign,send-demo-reminders}/index.ts`; admin UI under `src/components/admin/outbound/` (CampaignsTab, LeadsTab, DemosTab, ResultsTab, PromptTab, dialogs, lead side panel).
- **Files modified**: `supabase/functions/twilio-media-stream/index.ts` (outbound branch + post-call extraction/demo-booking hooks); `src/pages/AdminDashboard.tsx` (sidebar + route gating on super_admin).
- **Secrets**: reuses TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, RESEND_API_KEY, LOVABLE_API_KEY, CRON_SECRET — all already configured.
- **Twilio sender number**: uses the existing business-assigned Twilio number; if multiple exist I'll add a `from_number` column on `outbound_campaigns` defaulting to the first configured number — please confirm if you'd prefer a fixed number set in `outbound_settings` instead.
- **Deploys**: all six new functions + modified `twilio-media-stream` redeployed at the end.

### Open question

The brief says "Sets the from number to the business's assigned Twilio phone number" — there's no single "business" on an outbound campaign. I'll default to using your primary Twilio number stored in env/config; let me know if campaigns should each pick their own caller ID. The plan looks perfect, please go ahead and build everything as described.

For the open question about the from number — please add a `from_number` text field to the `outbound_settings` table alongside the prompt. All campaigns use this single number to make outbound calls. Also add a From Number input field in the AI Prompt tab of the admin dashboard so Mo can set or update the outbound caller ID from there. Default it to empty and Mo will enter the UK Twilio number manually after setup.