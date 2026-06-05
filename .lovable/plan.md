## Plan

I’ll make one focused backend pass on the voice stream function to preserve full mid-call state across reconnects, stop repeated disclosures/greetings, block duplicate rebooking after a successful booking, then clean up the duplicate booking row and redeploy.

## What I found

- **Reconnect rehydration is incomplete today**: `rehydrateContext()` only reloads the **last 15 user/assistant messages** from `call_conversations`, skips system/tool state, and rebuilds `session.conversationHistory` from that subset (`supabase/functions/twilio-media-stream/index.ts:1537-1599`).
- **Successful tool calls are not persisted into conversation history**: `logConversation()` only writes `{ role, content, timestamp }`, so the DB record has no structured `create_booking` success marker to protect against reconnect rebooking (`index.ts:5628-5650`).
- **Only one reconnect flag currently survives locally**: `interruptionAcknowledged` exists on `StreamSession`, but `recordingDisclosureGiven` and `returningCallerGreeted` do not currently live there (`index.ts:139-223`).
- **Reconnect prompt is not the requested silent continuation rule**: current reconnect instructions still inject an apology on first reconnect and do not explicitly forbid re-checking already confirmed details (`index.ts:1922-1931`).
- **There are already duplicate confirmed bookings for this caller on 2026-06-09**:
  - `JOH-3676` at **14:00** created **2026-06-05 15:55:26 UTC**
  - `JOH-0131` at **16:00** created **2026-06-05 15:53:48 UTC**
  Both are confirmed for the same caller/business/service/staff.

## Implementation

### 1) Persist full reconnect state on `StreamSession`
Update `StreamSession` in `supabase/functions/twilio-media-stream/index.ts` to carry reconnect-stable state for the whole call:
- `conversationHistory` as the authoritative in-memory event log for the call
- `recordingDisclosureGiven: boolean`
- `interruptionAcknowledged: boolean`
- `returningCallerGreeted: boolean`
- a structured record of successful booking/reservation/order tool results for dedupe checks, keyed by type + business + service/date/time/customer where applicable

These values will be initialized once per call and **never reset during reconnects**.

### 2) Save and restore conversation history properly
Before any reconnect/session reinitialisation path, preserve the current full `session.conversationHistory` and use it as the primary restore source.

On OpenAI session re-init after reconnect:
- inject the saved history back immediately as prior conversation items
- include assistant, user, and structured tool success context needed for continuity
- fall back to `call_conversations.messages` only if in-memory history is unexpectedly missing
- log the restored **history length** and **estimated token count** at reconnect start so you can verify restoration on the next test call

### 3) Apply the exact reconnect continuation rule
Replace the reconnect response instruction with the exact required text:

```text
You are reconnecting mid-call. The conversation history above shows everything that was already discussed. Continue naturally from exactly where you left off. Do NOT re-introduce yourself. Do NOT re-deliver the recording disclosure. Do NOT apologise for any interruption unless this is the very first reconnect and interruptionAcknowledged is false. Do NOT re-check availability or re-discuss anything already confirmed. Simply continue as if the line never dropped.
```

I’ll make this the dominant reconnect instruction and keep the first-reconnect apology logic gated by `interruptionAcknowledged`.

### 4) Prevent duplicate bookings after reconnect
Add a reconnect-safe duplicate guard around `create_booking`:
- whenever `create_booking` succeeds, store a structured success entry in session history/state
- on reconnect, inspect restored history/state for prior successful `create_booking` results
- if a booking for the **same service + date + time** already succeeded in the same call, block a second `create_booking`
- instead, inject a system instruction telling the model the booking already exists and it must confirm the existing booking details rather than book again

I’ll apply the same pattern to reservation/order success tracking if the existing code path makes that low-risk in the same edit.

### 5) Clean up the duplicate booking data
After the code fix, remove the extra duplicate booking row for caller `07491004439` on `2026-06-09`, keeping only the **most recently created confirmed row** per your instruction.

Based on current data, that means:
- **Keep** `0bf50194-fab2-426b-a5e7-8b5300b98acf` (`JOH-3676`, 14:00, created 15:55:26 UTC)
- **Delete** `f6114033-edee-4e58-aef1-ab17d7084087` (`JOH-0131`, 16:00, created 15:53:48 UTC)

## Validation after deploy

I’ll verify and report back with:
- reconnect start **history length**
- reconnect start **estimated token count**
- whether the exact reconnect continuation instruction is being sent
- whether a prior successful `create_booking` is detected and blocks rebooking
- confirmation that the duplicate row was deleted and the kept booking remains

## Technical details

- **Primary files**:
  - `supabase/functions/twilio-media-stream/index.ts`
- **Likely changes**:
  - expand `StreamSession`
  - strengthen reconnect scheduling + OpenAI session reinit path
  - replace `rehydrateContext()` to restore from full saved history first
  - persist structured tool success events alongside plain transcript history
  - add duplicate guard in `create_booking` handling
  - run a data cleanup on `public.bookings`
- **Deployment**:
  - redeploy `twilio-media-stream`
  - inspect deployed logs for reconnect restoration metrics