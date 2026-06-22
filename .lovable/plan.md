## Receptionist polish — based on real call transcripts

Plan to push the AI from "decent" to "best receptionist on the team", grounded in the actual issues from Lucy's last 6 calls.

### 1. Intent detection: check vs book vs reschedule (highest priority)
The Welsh call had the caller saying "no I don't want to move it, I just want to check when it is" three times. AI kept defaulting to create/reschedule.

**Changes (prompt + tool routing in `twilio-media-stream/index.ts`):**
- New prompt block at the top of CRITICAL RULES with an explicit decision tree:
  - "When is my booking" / "remind me" / "check my appointment" / "do I have one" → call `lookup_booking` first (tool already exists via `executeLookupBooking`). Never assume create.
  - "I want to change / move / push back / earlier / later" → `reschedule_booking`.
  - "I want to book / make an appointment / get in for" → `create_booking`.
  - "Cancel" → `cancel_booking`.
- Force the AI to **classify the intent out loud silently** before any tool call. If unsure between two intents → ask one clarifying question ("Just to be clear — are you wanting to check an existing booking, or make a new one?") instead of guessing.

### 2. Non-English date accuracy
The Welsh booking confirmation said "23 **Mawrth**" (March) when the booking was for **Mehefin** (June).

**Changes:**
- Prompt rule: when speaking in a non-English language, the AI must internally form the date in English (ISO format) before translating, and **read it back as both the localised month and the numeric date** ("23ain o Fehefin — that's June 23rd"). Re-read on confirmation.
- Server-side guard in `create_booking`: after the booking is written, append the canonical date (day-of-week + DD month YYYY in English) to the success message so the AI's read-back next turn uses the verified string, not its own translation.

### 3. Staff name pronunciation lock
"Lorena" became "Larina" mid-sentence.

**Changes:**
- New optional `staff.name_phonetic text` column (mirrors the existing business-name phonetic pattern).
- Staff form: add a "Pronunciation (optional)" field under name with helper "Type how to pronounce the name, e.g. 'Lor-ay-nuh'".
- Prompt: staff list now reads `- Lorena [SAY: Lor-ay-nuh]`; explicit rule "NEVER invent a variant of a staff name — say it exactly as written or as in the [SAY:] hint".

### 4. Conversation opening + closing flow (your "handle it like it should")
Currently the opening is fine but the close is messy ("Hello?" after transfer, no proper sign-off on hangup, sometimes asks "anything else?" twice).

**Changes (prompt):**
- **Opening rule:** Greet → state name → ask "how can I help today?". Skip recording disclosure if business has it off (already config). For returning callers: greet by first name first, *then* ask. Never start with "Just before we continue" mid-sentence.
- **During call:** one acknowledgement per caller turn, never two filler sentences in a row ("Sure, let me help you with that. Just before we...").
- **Closing rule:** after `create_booking` / `reschedule_booking` / `cancel_booking` success → exactly one wrap-up sentence ("You're all set for Thursday the 26th at 2 PM with Lorena — see you then!") → then *one* "Is there anything else I can help with?" → if no, polite sign-off + `end_call`. No repeated "anything else".
- **Transfer rule:** before transferring say "One moment, putting you through to Lorena now" → call `transfer_call`. Never say "Hello?" after transferring — the AI's side is done.
- **Silence handling:** if caller goes silent after a confirmation, AI says "Are you still there?" once, then politely ends.

### 5. Upsells = per-business toggle
Per your answer.

**Changes:**
- Migration: `business_settings.ai_can_suggest_addons boolean default false`.
- Settings UI (`AISettingsTab.tsx`): new switch "Let the AI suggest add-on services" with helper "AI offers complementary services *after* a booking is confirmed".
- Prompt: insert the rule conditionally — if off, "NEVER suggest add-on services". If on, "ONLY after create_booking returns success, you MAY mention ONE related add-on, once. Never during confirmation, never if caller said 'just the X'".

### Files to touch
- `supabase/migrations/<new>.sql` — `staff.name_phonetic`, `business_settings.ai_can_suggest_addons`
- `src/components/dashboard/settings/StaffManagement.tsx` — phonetic field
- `src/components/dashboard/settings/AISettingsTab.tsx` — addon toggle
- `supabase/functions/twilio-media-stream/index.ts` — select new columns, surface phonetic in staff list, post-booking canonical date in success message, addon flag in prompt
- `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts` — intent decision tree, date read-back rule, name pronunciation rule, opening/closing/transfer/silence rules, conditional upsell block

### Memory updates
- Update `mem://constraints/order-confirmation-guardrail` style entry: add **intent-classification-before-tool-call** as a core rule.
- Update `mem://features/multilingual-detection-persistence`: add the date-read-back-in-both-languages requirement.
- Add `mem://features/conversation-flow-discipline`: opening, closing, transfer, silence patterns.

### Out of scope
- Re-training/swapping STT for better Welsh (the model is the limit there; we mitigate by date read-back).
- Auto-detecting "the caller sounds upset → transfer to owner" — bigger feature, ask later if you want it.
