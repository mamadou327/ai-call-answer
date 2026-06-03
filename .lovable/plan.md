## Four targeted fixes to `twilio-media-stream` and prompt rules

### Fix 1 — Greeting uses the correct assistant name
Problem: line 1923 reads `(session.businessSettings as any)?.assistant_name || "Aivia"`, a second resolution path that falls back to "Aivia" when `businessSettings` is incomplete, even though `assistantName` was already correctly resolved at line 519 from the same DB row.

Change:
- Add `assistantName: string` to the `StreamSession` interface (line 139 block) and initialise it in the `session` literal at line 569 using the already-resolved `assistantName` variable.
- In the forced-greeting block (around line 1923–1927), replace the `assistantNameForGreeting` lookup with `session.assistantName`. Use the same value anywhere the greeting line is composed.

### Fix 2 — Returning caller: answer the question first
Problem: when a returning caller asks a direct question in their very first utterance, the model uses the "welcome back" branch and skips answering.

Change (prompt-only, in `prompts/advanced-rules.ts`):
- Add a new high-priority rule under the existing "RETURNING CALLER" / first-turn handling:
  > If a returning caller asks a direct question in their first turn, ANSWER THE QUESTION FIRST in the same response, then add a brief warm acknowledgement (e.g. "— and lovely to hear from you again, <FirstName>."). Never delay or replace answering a question with a returning-caller greeting.
- Keep the existing "welcome back" greeting for first turns that contain no question.

Note: the forced initial greeting at index.ts:1925 fires before the caller has spoken, so it stays as-is. This rule governs the model's first *response* after the caller speaks.

### Fix 3 — Mandatory pre-booking confirmation summary
Problem: the model is skipping the read-back summary before `create_booking`.

Change (prompt-only, in `prompts/advanced-rules.ts`, BOOKING WORKFLOW / confirmation section):
- Promote the existing summary rule to a HARD, NON-SKIPPABLE rule with explicit language:
  > BEFORE calling `create_booking` you MUST read back the full summary line (service, staff, date, time, customer name) and WAIT for an explicit "yes" (or equivalent confirmation) from the caller. No exceptions under any circumstances. If you call `create_booking` without an explicit yes after the summary, that is a critical failure.
- Apply the same hardening to `create_reservation` and `create_pickup_order` confirmation lines for consistency (these were already in the brevity-exempt list).

### Fix 4 — "Sorry about that brief interruption" only once per call
Problem: the reconnect-greeting instruction is reused on every reconnect, so the phrase can be spoken twice in one call.

Change (`index.ts`):
- Add `interruptionAcknowledged: boolean` to `StreamSession` (default `false` in the session literal).
- In the reconnect branch (line 1909–1911), only include the "Sorry about that brief interruption…" wording when `session.interruptionAcknowledged === false`. After sending that instruction set `session.interruptionAcknowledged = true`.
- On subsequent reconnects, use a silent continuation instruction instead, e.g. *"Continue the conversation naturally from where you left off. Do NOT apologise for any interruption — that has already been acknowledged earlier in this call."*

### Deployment
- After edits, deploy `twilio-media-stream` via `supabase--deploy_edge_functions`.
- No DB migration, no UI changes.

### Validation (next test call)
- (a) Greeting uses the business's configured assistant name, not "Aivia".
- (b) If caller is returning and opens with a question, the question is answered first and the welcome-back line follows in the same turn.
- (c) Before any `create_booking` log entry, the transcript contains a full summary line and an explicit caller "yes".
- (d) Across two forced reconnects in the same call, "Sorry about that brief interruption" appears at most once.
