## Goal

Slim the salon prompt, simplify the inner `buildAdvancedRules` block, and nudge VAD slightly more responsive — without breaking restaurants, exported helpers, the multilingual lock, or the existing call sites.

## Files to change (exactly 3)

### 1. `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts`

- **Keep** existing export name and signature: `export function buildSalonSystemPrompt(data: SalonPromptData): string` and the `SalonPromptData` interface unchanged (so `prompts/index.ts` keeps compiling at both call sites).
- **Keep** the `import { formatPriceForSpeech } from "./advanced-rules.ts"` and continue formatting services with it (the AI relies on `£` → "pounds" speech conversion).
- **Replace the prompt body** with a trimmed ~3.5k-char version that:
  - Drops the "call may be recorded" disclosure line.
  - Drops the "Sorry about that brief interruption" / apology scaffolding.
  - Drops the long intent table and the giant "SERVICE DISAMBIGUATION" block (collapses to a single short rule: "If the request matches more than one service, ask one short clarifying question before booking").
  - Removes the "offer 10/10:30/11am first" pattern — replaces with explicit rule: *"If the caller named a time and `check_availability` returns it available, confirm that exact time. Do NOT offer alternative times when the requested time is free. Do NOT list morning slots when they asked for afternoon."*
  - Keeps: tone/speed, business info, returning-caller block, upcoming-booking block, opening-context, booking rules (min notice / max advance / cancellation), staff [TRANSFER ONLY] handling, time-off block, add-on suggestion toggle, "read date/time back before create_booking" guardrail, "use canonical_date_en/canonical_time_en after success" guardrail.
  - Does **not** add "Always respond in English" — language behaviour stays governed by `buildLanguageRuleBlock` in `index.ts`.
- Appends `buildAdvancedRules(...)` at the end as it does today (call signature unchanged).

### 2. `supabase/functions/twilio-media-stream/prompts/advanced-rules.ts`

- **Keep all existing exports intact**: `formatPriceForSpeech`, `getGreetingPeriod`, `getOpenStatus`, `buildAdvancedReceptionistRules`, and `buildAdvancedRules`. Do not touch the first four — `index.ts` and the restaurant prompts import them.
- **Only swap the body of `buildAdvancedRules**` to a ~1.2k-char version covering:
  - "Use tools, never invent services/prices/staff/availability."
  - "Don't ask for the same info twice."
  - "Keep responses to 1–2 sentences."
  - "Read service + date + time + staff back before `create_booking`; wait for clear yes."
  - "Collect name + phone for new callers; only ask for email if they mention email confirmation."
  - Human-handoff line, with optional owner transfer line when `ownerStaff` exists.
  - **Omit** any "respond in English" instruction (multilingual lock preserved).
- Signature stays whatever it is today — do not change callers.

### 3. `supabase/functions/twilio-media-stream/index.ts` (turn_detection, ~line 2029)

Current:

```ts
type: "server_vad",
threshold: 0.68,
prefix_padding_ms: 200,
silence_duration_ms: 350,
```

Change to:

```ts
type: "server_vad",
threshold: 0.70,
prefix_padding_ms: 200,
silence_duration_ms: 600,
```

Note: `silence_duration_ms` goes **up** from 350 → 600 per your instruction (compromise to avoid cutting people off). This is slightly *less* responsive than today on turn-end, not faster — confirming you want that tradeoff. Threshold tightens 0.68 → 0.70.

Update the comment above the block to reflect the new values.

## Explicitly NOT changing

- `restaurant-pickup-prompt.ts`, `restaurant-hybrid-prompt.ts`, any other prompt file.
- `prompts/index.ts` (call sites untouched).
- `formatPriceForSpeech`, `getGreetingPeriod`, `getOpenStatus`, `buildAdvancedReceptionistRules`.
- Language lock (`buildLanguageRuleBlock`), reconnect logic, ElevenLabs, barge-in guard, recording pipeline.
- All memory rules: multilingual, address exactness, customer-name-mandatory, multi-tenant isolation, order-confirmation guardrail.

## Deployment

Redeploy `twilio-media-stream` after the edits, then make one English test call to confirm: (a) no recording disclosure, (b) requested time is confirmed directly when available, (c) AI speaks in short turns, (d) no compile errors in logs.

## Risk

The silence-duration increase (350 → 600 ms) will make turn-end detection ~250 ms slower than today. If callers report dead air after they finish speaking, the fallback is to drop it back toward 400–450 ms. - 

This looks good. Go ahead with everything EXCEPT the silence_duration change.

Keep `silence_duration_ms` at 350. Do not increase it. The current 350ms is already responsive. Going to 600 would add 250ms of dead air after every sentence which is the opposite of what we want.

Only change in turn_detection: `threshold` from 0.68 to 0.70. Leave everything else as is.

Everything else in the plan is correct. Proceed.