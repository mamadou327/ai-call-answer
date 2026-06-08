## Simplify Retell integration — drop prompt injection

### 1. `twilio-outbound-call` edge function

- Remove `agent_config_override` entirely from the Retell `register-phone-call` body. Keep only `agent_id`, `audio_encoding`, `audio_websocket_protocol`, `sample_rate`, and `retell_llm_dynamic_variables: { first_name, business_name }`.
- Stop reading `outbound_prompt` from `outbound_settings`. Select only `from_number` and `retell_agent_id`.
- Drop the `promptTemplate`/`systemPromptInjection` variables.

### 2. Admin UI — `OutboundCampaignsSection.tsx`, AI Prompt tab

Strip the tab down to two inputs:
- **Retell Agent ID** (`retell_agent_id`) — helper text pointing to Retell dashboard.
- **From Number** (`from_number`).

Remove:
- Prompt textarea and any `outbound_prompt` state, save logic, helper copy about `{{first_name}}` / `{{business_name}}`.

Keep the read-only webhook URL display for Mo to copy.

Consider renaming the tab label from "AI Prompt" to "Retell Settings" since prompts are no longer managed here (confirm in build mode if desired, otherwise leave label).

### 3. Database

Add a migration that drops `outbound_settings.outbound_prompt` (column exists — previous migration only added `retell_agent_id`, but the column was present from earlier outbound work). Final shape of `outbound_settings`: existing id/timestamps + `from_number` + `retell_agent_id`.

If for any reason dropping is risky (other code references), the fallback is to leave the column and simply stop reading/writing it. Plan A is to drop.

### 4. Deploy

Redeploy `twilio-outbound-call` only. No changes to `twilio-outbound-twiml` or `retell-call-webhook`.

### What stays the same

Retell SIP bridging, webhook processing with Gemini extraction, demo emails, all inbound voice, campaigns, scheduling, analytics.
