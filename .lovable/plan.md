
## Goal
Stop the AI phone calls from cutting off mid-call and make long calls (up to ~30 minutes) realistically possible.

## What I found from your latest call (why it still cut off)
From the backend logs + the actual recorded call transcription:

- The call **ended around ~173 seconds (2m 53s)** (`duration_ms = 173000`).
- The conversation shows the system tried to recover:
  - `[reconnect] Stream reconnecting (attempt 1/4)`
  - Caller then says “Hello?” repeatedly
  - Then `[reconnect] Stream reconnecting (attempt 2/4)`
- The `twilio-media-stream` logs show:
  - `Stream stopped`
  - `Twilio WebSocket closed`
  - `OpenAI WebSocket closed { code: 1005 }`
- This pattern strongly suggests the **Twilio Media Stream WebSocket itself is dropping** (and then OpenAI closes as a consequence), and the reconnect flow isn’t recovering fast enough to feel seamless to the caller.

## Likely root cause (important)
This looks less like “the AI chose to hang up” and more like a **WebSocket/session lifetime limitation or instability** in the realtime streaming layer (either platform/runtime limits for long-lived WebSockets, network blips, or Twilio stream resets). It’s happening at ~2–3 minutes which is consistent with “a hard cap” behavior.

So yes: **30-minute calls are possible**, but we likely need to **engineer around stream resets** instead of assuming one WebSocket will stay alive for 30 minutes.

## Strategy
### A) Make reconnects seamless and automatic (so caller doesn’t experience “dead air”)
1. **Improve the reconnect UX** in `twilio-stream-action`:
   - When Twilio calls the action URL (meaning the stream ended), immediately play a short spoken message like:
     - “One moment—just reconnecting, please hold.”
   - Then re-open the stream.
   - This prevents the caller from hearing silence and hanging up.

2. **Increase reconnect resilience**
   - Increase `MAX_RECONNECTS` in `twilio-stream-action` (currently 4) to something higher (e.g. 10).
   - Add slightly longer pauses/jitter between reconnect attempts to avoid rapid loops.
   - Keep the existing fallback redirect to the backup voice flow, but only after more attempts (or after a time threshold).

### B) Proactively “rotate” the media stream before it hits the drop point (workaround for 2–3 minute cap)
If the realtime stream is getting killed around ~2–3 minutes, we can prevent surprise cutoffs by doing controlled restarts:

1. Add a **stream rotation timer** inside `twilio-media-stream/index.ts`:
   - Track how long the current Twilio stream has been alive (per stream segment).
   - At a safe interval (example: **every 110–130 seconds**), intentionally trigger a controlled reconnect:
     - Log a system message into `call_conversations`
     - Close the Twilio WebSocket from our side so Twilio immediately hits `twilio-stream-action`
     - `twilio-stream-action` reconnects right away (with the “please hold” message)

2. Ensure **context survives** across rotations:
   - Your code already supports `isReconnect` + `rehydrateContext()` from `call_conversations`.
   - We’ll strengthen this by:
     - Logging an explicit `[rotation]` marker to `call_conversations`
     - Ensuring `sendSessionConfig()` on reconnect always rehydrates before continuing

Net effect: the call can last “indefinitely” by stitching together multiple short stream segments, instead of relying on one long-lived WebSocket.

### C) Add better diagnostics so we can prove it’s fixed (and pinpoint if anything still drops)
In `twilio-media-stream/index.ts`, add structured logs including:
- `callSid`, `streamSid`, `isReconnect`, `reconnectCount`
- “stream age in seconds” at the moment of:
  - `stop`
  - `onclose`
  - rotation trigger
  - OpenAI close

Also write a small system entry into `call_conversations.messages` when:
- stream stops
- stream rotates
- reconnect begins/ends

This makes it much easier to verify the exact failure mode without guessing.

## Files to change
1. **`supabase/functions/twilio-media-stream/index.ts`**
   - Add stream-rotation timer + state
   - Improve shutdown/reconnect logging
   - Ensure reconnect rehydration is consistently applied
2. **`supabase/functions/twilio-stream-action/index.ts`**
   - Add “reconnecting, please hold” audio (via `<Say>` before `<Connect>`)
   - Increase `MAX_RECONNECTS`
   - Optionally tune pauses/backoff between reconnect attempts

(We should not need database changes for this approach.)

## Acceptance criteria (what “fixed” means)
- A call can run **10 minutes+** without the caller experiencing an unrecovered cut.
- If a stream resets, the caller hears a short “reconnecting” message and the system resumes within a couple seconds.
- We can confirm in logs:
  - stream rotation events happening (if enabled)
  - reconnect success (stream re-start logs appear)
  - no abrupt end without fallback

## Testing plan (what we’ll do right after implementation)
1. Place a real call and keep it running for:
   - 5 minutes
   - then 10 minutes
   - then 20–30 minutes
2. During the call, intentionally include:
   - long pauses (15–30 seconds)
   - continuous ordering (lots of turns)
3. Verify:
   - no “dead air” longer than a couple seconds
   - reconnect message plays if rotation happens
4. Check the last call’s `call_conversations` messages for:
   - `[rotation] ...`
   - `[reconnect] Stream reconnecting ...`
   - “stream started” events after reconnect

## Notes / trade-offs
- If we confirm there is a hard runtime cap (2–3 minutes) on realtime streaming, then a “single uninterrupted WebSocket” for 30 minutes may not be possible on this infrastructure.
- The stream-rotation method is the practical workaround: the caller experiences (at worst) a brief reconnect message, but the call keeps going and feels stable.
