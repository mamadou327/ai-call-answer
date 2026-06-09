## Problem

You just called Mo's outbound number back and Aivia answered with the generic outbound sales script, as if you were a brand new prospect. That's because there is **no inbound handler wired specifically to Mo's outbound number** — Twilio is just forwarding the inbound call straight into the same Retell sales agent with no context.

Result:
- The AI doesn't know the caller is a lead we already tried to reach.
- It greets them generically ("Hi, this is Aivia from…") instead of "Hi Sarah, thanks for calling back".
- No prior call summary is injected, so the AI re-pitches from scratch.
- `outbound_leads.status` stays as `no_answer` — the callback isn't logged against the lead.
- If they book a demo, it lands in `outbound_demos` only if the analyser still runs (it does, because the same `retell-call-webhook` fires), but with no link to the original outbound attempt.

## Fix

Add a dedicated inbound voice handler for Mo's outbound number that:
1. Looks up the caller by E.164 in `outbound_leads`.
2. Builds a personalised dynamic-variable set for Retell (name, business, prior summary, current date).
3. Logs the callback against the lead so it shows up in the admin Demos/Leads tabs.

### 1. New edge function: `twilio-inbound-sales`

Webhook configured on Mo's outbound Twilio number for **inbound** calls.

Flow:
1. Parse Twilio form params, validate signature, rate-limit (reuse the patterns from `twilio-voice-webhook`).
2. Read `From` (caller's E.164).
3. Lookup in `outbound_leads` by `phone_number`. Three cases:
   - **Match found** → returning lead. Build dynamic variables:
     - `first_name`, `business_name` from the lead row
     - `current_date` (same `toLocaleDateString` format already used in `twilio-outbound-call`)
     - `is_callback = "true"`
     - `prior_call_summary` = trimmed `lead.call_transcript` (last ~500 chars) if present, else empty
     - `prior_status` = `lead.status` (e.g. `no_answer`, `interested`)
   - **No match** → cold inbound. Set `is_callback = "false"`, generic vars, still route to the sales agent (or optionally a different greeting — see Decision 2 below).
4. Register the call with Retell (`register-phone-call`) using the same `retell_agent_id` from `outbound_settings`, passing the dynamic vars.
5. Return TwiML that `<Connect><Stream>`s to Retell's media WS, same shape as `twilio-outbound-twiml`.
6. Update the matched lead with `retell_call_id` (so `retell-call-webhook` can find it) and `status = 'called_back'` (new status value), and `last_called_at = now()`.

### 2. Retell agent prompt update (you do this in Retell, not in code)

Add a branch to the agent system prompt:

> If `{{is_callback}}` is "true", greet the caller by name: "Hi {{first_name}}, thanks for calling back — this is Mo's assistant from Aivia. I see we tried you earlier about {{business_name}}." Then ask if it's a good time and reference `{{prior_call_summary}}` only if non-empty. Do not re-introduce Aivia from scratch.

This change is out of scope for the codebase but listed here so it's not forgotten.

### 3. `retell-call-webhook` — minor update

Currently looks up the lead by `retell_call_id`. That keeps working as long as step 1.6 sets `retell_call_id` on the matched lead row. No change needed if we reuse the existing lead row.

If you'd rather treat each callback as a **new** call record (preserving the original outbound attempt's transcript), we'd add a new table `outbound_call_attempts` and migrate the webhook to write into that — bigger change, flagged as Decision 3.

### 4. Lead status enum

Add `'called_back'` to the allowed values for `outbound_leads.status` so the admin UI can filter/badge it. Surface it in `OutboundCampaignsSection.tsx` with a distinct colour.

### 5. Admin visibility

In `OutboundCampaignsSection.tsx` (or wherever leads are listed), show a "Called back" badge and the timestamp when `status = 'called_back'`. No new tab needed.

## Out of scope

- Backfilling existing `no_answer` leads.
- IVR menu ("press 1 to leave a message"). Straight to AI.
- Per-business inbound: this is only for Mo's outbound sales number.
- Retell agent prompt edits (done in Retell dashboard).

## Decisions I need from you before building

1. **Inbound number** — is the inbound webhook going on the **same** `outbound_settings.from_number`, or a separate dedicated callback number?
2. **Cold inbound** (caller not in `outbound_leads`) — what should happen? Options:
   a. Same sales agent, generic greeting (current behaviour, no change).
   b. Voicemail / "Mo will call you back" message.
   c. Forward to Mo's mobile.
3. **Re-use lead row vs new attempt row** — for a callback, overwrite the original lead's `call_transcript`/`retell_call_id`, or create a separate `outbound_call_attempts` row so the history is preserved? (Recommend the second, but it's a bigger build.)
