# Stop the AI from cutting off on background noise

## Problem

When the caller is on a noisy line (café, car, TV in the background, kids, traffic), the AI keeps stopping mid-sentence. Right now any sound above the speech threshold is treated as the caller starting to talk, which triggers a "barge-in" and cancels the AI's current response.

The cause is in the OpenAI Realtime voice-activity-detection (VAD) config in `supabase/functions/twilio-media-stream/index.ts` (~line 2003):

```
type: "server_vad",
threshold: 0.75,
prefix_padding_ms: 300,
silence_duration_ms: 1000,
```

`server_vad` with `threshold: 0.75` is energy-based — it can't tell speech from clattering plates, a TV, or road noise, so it fires on noise and interrupts the AI.

## Fix

**1. Switch to semantic VAD (primary fix).**
Change the turn-detection block to OpenAI's `semantic_vad`, which uses a model to decide whether the caller is *actually* speaking to the AI (vs. background noise / side-talk). Use `eagerness: "low"` so it waits for a clear end-of-turn before responding and is much less twitchy on noise.

```
turn_detection: {
  type: "semantic_vad",
  eagerness: "low",
  create_response: true,
  interrupt_response: true,
}
```

**2. Add a minimum-speech-duration guard before allowing interruption.**
Even with semantic VAD, we'll add a small guard in the existing `input_audio_buffer.speech_started` handler so that a barge-in only cancels the AI's current response if the detected speech segment lasts more than ~300ms. A single bang/cough/door-slam won't reach that, so the AI keeps talking. Real speech easily exceeds it.

**3. Keep everything else unchanged.**
- No prompt changes.
- No changes to language-lock, disambiguation, reconnect, ElevenLabs TTS, or any other behaviour from prior turns.
- Whisper transcription config stays the same.

## Files to edit

- `supabase/functions/twilio-media-stream/index.ts`
  - Replace the `turn_detection` block (~line 2003) with the `semantic_vad` config above.
  - In the existing `speech_started` / `speech_stopped` / `response.cancel` path, add the short minimum-duration guard before cancelling the AI's current response.

## Deploy

- Redeploy the `twilio-media-stream` edge function.

## Out of scope

- No DB schema changes.
- No frontend / dashboard changes.
- No new per-business setting for now — we can add a "noisy environment" toggle later if you want it configurable per business.

## How to verify

Call the AI from a noisy environment (play music/TV in the background, or call from outside). The AI should keep speaking through background noise and only stop when you actually talk to it.
