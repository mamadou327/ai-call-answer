# Plan: Route outbound calls through Retell

## 1. Secret

- Request `RETELL_API_KEY` via the secrets tool. You'll paste it from app.retellai.com → API Keys.

## 2. Database migration

One migration adding two columns:

- `outbound_settings.retell_agent_id text`
- `outbound_leads.retell_call_id text` (indexed for fast webhook lookup)

No new tables, no RLS/GRANT changes needed (columns inherit from existing tables).

## 3. Edge function changes

### Modify `twilio-outbound-call`

Replace current dial-then-stream logic with two steps:

1. **Register call with Retell** — POST `https://api.retellai.com/v2/register-phone-call` with:
  ```json
   {
     "agent_id": "<outbound_settings.retell_agent_id>",
     "audio_encoding": "mulaw",
     "audio_websocket_protocol": "twilio",
     "sample_rate": 8000,
     "retell_llm_dynamic_variables": { "first_name": "...", "business_name": "..." },
     "agent_config_override": {
       "llm_websocket_url": null,
       "system_prompt_injection": "<outbound_prompt with {{first_name}}/{{business_name}} replaced>"
     }
   }
  ```
   Header: `Authorization: Bearer ${RETELL_API_KEY}`. Save returned `call_id` to `outbound_leads.retell_call_id`.
2. **Dial via Twilio REST** — keep existing `calls.create()`, point `url` to `twilio-outbound-twiml?call_id={call_id}&lead_id={lead_id}`. Keep `statusCallback`, `record:true`, `recordingStatusCallback` unchanged.

### Modify `twilio-outbound-twiml`

Read `call_id` from query string and return:

```xml
<Response>
  <Dial>
    <Sip>sip:{call_id}@5t4n6j0wnrl.sip.livekit.cloud</Sip>
  </Dial>
</Response>
```

### Delete `twilio-outbound-media-stream`

Remove the function directory, its `[functions.twilio-outbound-media-stream]` block in `config.toml`, and call `delete_edge_functions`. Retell now handles the AI side.

### Create `retell-call-webhook` (verify_jwt = false)

On POST:

1. Look up lead by `retell_call_id`. If none, log + return 200.
2. Compute `call_duration_seconds` from `start_timestamp`/`end_timestamp` (ms).
3. Update lead: `transcript`, `call_recording_url`, `call_duration_seconds`, `last_called_at = now()`.
4. Call Lovable AI Gateway (`google/gemini-3-flash-preview` via `LOVABLE_API_KEY`, OpenAI-compatible) with structured output (Zod) to extract: `interest_level` (hot/warm/cold), `existing_solution`, `reason_not_interested`, `demo_booked`, `demo_datetime`, `prospect_email`.
  - Note: brief says "Anthropic Claude using LOVABLE_API_KEY" — LOVABLE_API_KEY is the Lovable AI Gateway key, not an Anthropic key. I'll use Gemini through the gateway (same key, no extra setup, follows project guidance). Tell me if you want a specific model like `google/gemini-3-pro-preview` instead.
5. Update lead `interest_level`, `existing_solution`, `reason_not_interested`, `demo_booked` and set `status`:
  - `demo_booked` → if `demo_booked === true`
  - `interested` → if `hot`/`warm` and no demo
  - `not_interested` → if `cold`
6. If `demo_booked`: insert `outbound_demos` row with lead details + `demo_datetime`.
7. Emails via Resend (`RESEND_API_KEY` already configured, sender `RESEND_FROM_EMAIL`):
  - Demo booked → email `mo@aiviaapp.co.uk` "Demo Booked — {first_name} from {business_name}" + prospect confirmation if `prospect_email` present.
  - Hot lead, no demo → email Mo "Hot Lead Needs Follow Up — {first_name} from {business_name}" with full transcript.
8. Always return 200.

## 4. Admin UI: AI Prompt tab

In `OutboundCampaignsSection.tsx` (AI Prompt tab), add **above** the prompt textarea:

- **Retell Agent ID** input bound to `outbound_settings.retell_agent_id`. Helper: "Find this in your Retell dashboard under Agents. Copy the ID that starts with agent-"
- Keep existing `from_number` field unchanged.
- Save both alongside the prompt on click.

## 5. Config + deploy

- Add `[functions.retell-call-webhook]` with `verify_jwt = false` in `supabase/config.toml`.
- Remove `[functions.twilio-outbound-media-stream]` block.
- Deploy: `twilio-outbound-call`, `twilio-outbound-twiml`, `retell-call-webhook`. Delete `twilio-outbound-media-stream`.

## 6. After deploy — what you do in Retell

Paste this webhook URL into the Outreach Dialer agent → Webhook URL:

```
https://zyqzypyncugihrawhppg.supabase.co/functions/v1/retell-call-webhook
```

## What stays the same

Inbound voice (OpenAI Realtime + `twilio-media-stream`), campaign mgmt, lead import, pg_cron scheduling, reminder emails, demo calendar, results analytics — all untouched.

## Open question

Brief mentions Claude but `LOVABLE_API_KEY` is the Lovable AI Gateway key (Gemini-first). I'll use `google/gemini-3-flash-preview` unless you say otherwise — reply with a model name if you want a different one.

Approve and I'll request the secret, then implement. - For the open question on the AI model — use `google/gemini-3-flash-preview` via the Lovable AI Gateway for the transcript extraction. That is fine for structured data extraction from call transcripts.

One additional thing: after deploying, please display the retell-call-webhook URL clearly in the AI Prompt tab of the admin dashboard so Mo can easily copy it and paste it into Retell's webhook settings without having to figure out the Supabase project URL himself.