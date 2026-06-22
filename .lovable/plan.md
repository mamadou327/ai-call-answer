## Problem

After switching to `semantic_vad` with `eagerness: "low"`, the AI now waits noticeably longer before replying after the caller finishes speaking. That's expected behavior — `low` eagerness tells the model to be very patient about deciding the caller is done, which adds hundreds of ms (sometimes >1s) of dead air on every turn.

The 300ms barge-in guard we added on top also delays interruption handling slightly, but the dominant cause is the VAD eagerness setting.

## Fix

Tune the VAD for a balance between "doesn't trip on background noise" and "responds fast":

1. **`supabase/functions/twilio-media-stream/index.ts` (turn_detection block, ~line 2003)**
   - Keep `type: "semantic_vad"` (still better than energy-based for noise rejection).
   - Change `eagerness: "low"` → `eagerness: "medium"`. Medium is the OpenAI default and is the right tradeoff — still semantic (ignores most background noise) but turn-end detection is ~roughly as fast as the old server_vad path.

2. **Barge-in guard (~lines 1410-1460)**
   - Lower `MIN_INTERRUPT_MS` from `300` → `150`. Still filters single coughs/clatters, but doesn't add perceptible lag when the caller actually interrupts.

3. No other changes — prompts, ElevenLabs, reconnect, language-lock all untouched.

## Deployment

Redeploy `twilio-media-stream`.

## If medium still feels too slow

Fallback option (only if user reports it after testing): switch back to `server_vad` but with `threshold: 0.5`, `prefix_padding_ms: 300`, `silence_duration_ms: 500`. That's the fastest config but more prone to noise barge-ins.
