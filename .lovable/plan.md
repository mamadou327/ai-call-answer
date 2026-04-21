

# Plan: Swap OpenAI Voice for ElevenLabs Flash v2.5 (with Safety Rails)

Same architecture as last revision, with Claude's two additions baked in.

## The Architecture

Keep OpenAI Realtime as the brain (STT + LLM + tool calls + turn detection). Disable its audio output. Pipe its text deltas into ElevenLabs Flash v2.5 over WebSocket. Forward the resulting μ-law 8kHz audio straight to Twilio.

```text
Caller ↔ Twilio ↔ twilio-media-stream ↔ OpenAI Realtime
                          │              (text + tools only)
                          ▼
                  ElevenLabs Flash v2.5 WS
                  (streaming TTS, μ-law 8kHz)
                          │
                          ▼
                  Audio frames → Twilio
```

Expected latency: ~400ms today → ~475ms (Flash v2.5 first-audio ~75ms).

---

## Safety Rails

1. **Per-business feature flag, defaulted OFF.** New `use_elevenlabs_voice boolean default false` on `business_settings`. Existing OpenAI voice path stays the default for everyone.
2. **No auto-rollout.** Only your test business gets the flag enabled first.
3. **Side-by-side code paths.** New ElevenLabs pipeline lives behind `if (useElevenLabsVoice)`. Existing OpenAI audio output code is **preserved, not deleted** — instant rollback.
4. **Deploy summary before go-live.** After the rewrite I will list every modified section in `twilio-media-stream/index.ts` (greeting, response handler, interruption handler, stream rotation, etc.) for your review.
5. **Aggressive logging on the new path.** Every interruption event, ElevenLabs WS open/close, audio chunk count, and latency measurement logged for fast debugging.

---

## Environment Variable Handling (Claude's addition)

- `ELEVENLABS_API_KEY` is already set as a Supabase secret ✅ (confirmed)
- At the top of `twilio-media-stream/index.ts`, alongside the existing `OPENAI_API_KEY` read, add:
  ```ts
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    console.error("[FATAL] ELEVENLABS_API_KEY is required when use_elevenlabs_voice is enabled");
  }
  ```
- Treat as **required** when the per-business flag is on. If the flag is on but the key is missing at call start, log a fatal error and **fall back to the OpenAI voice path automatically** rather than dropping the call.

---

## What Changes

### 1. `twilio-media-stream/index.ts` — gated rewrite of voice output

- Read `use_elevenlabs_voice` from `business_settings` at call start
- If **false** → existing OpenAI audio output path (unchanged)
- If **true** → new path:
  - OpenAI session opens with `modalities: ["text"]` (no audio out)
  - Open ElevenLabs WS: `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_flash_v2_5&output_format=ulaw_8000`
  - Stream OpenAI text deltas straight into ElevenLabs as they arrive
  - Forward ElevenLabs μ-law audio chunks directly to Twilio `media` events (no transcoding)

### 2. Interruption handling — match current behavior exactly

When `input_audio_buffer.speech_started` fires from OpenAI:
- Send `flush` + close current ElevenLabs stream
- Send Twilio a `clear` event (drops queued audio in Twilio's buffer — what makes the AI stop mid-word)
- Send `response.cancel` to OpenAI
- Open a fresh ElevenLabs WS for the next response

Keep existing 850ms min interruption delay and VAD threshold 0.80 in OpenAI session config.

**Honest expectation:** first version of manual interruption will need 1–2 tuning rounds on real calls before it matches OpenAI's built-in feel.

### 3. Voice settings — reuse what's there

- `elevenlabs_voice_id` column already exists in `business_settings` ✅
- `VoiceSelector.tsx` updated to show curated ElevenLabs voices recommended for telephony, grouped by language
- `generate-openai-voice-preview` repointed to Flash v2.5 so previews match real-call audio

### 4. Stream rotation (110-second reconnect)

- "One moment please" reconnect message switched to the same ElevenLabs Flash stream so audio character is consistent across rotation
- Rotation logic itself unchanged

### 5. Prompts — one-line tweak

Add to all prompts (`prompts/restaurant-*.ts`, `prompts/salon-prompt.ts`):
> "Speak naturally with contractions. Keep responses conversational and concise — long monologues feel robotic on the phone."

### 6. Cost & monitoring

- Add `elevenlabs_chars_used integer default 0` to `calls_log` for per-call TTS spend tracking
- Flash v2.5 ≈ $0.05/1k chars (~$0.03/min of speech)

### 7. UI: per-business toggle

Add "Premium voice (ElevenLabs)" toggle in `AISettingsTab.tsx`. Off by default. Tooltip: *"Higher-quality human-sounding voice. Adds ~75ms latency."*

---

## What Does NOT Change

- `twilio-voice-webhook-realtime` — untouched
- All booking/order/menu/fallback/recording/missed-call edge functions — untouched
- All AI tools (`create_booking`, `create_order`, `lookup_menu`, etc.) — untouched
- Stream rotation, WS keepalive, stale connection detection, signature validation — untouched
- Cross-call memory, multilingual detection, returning-customer greetings — untouched
- Existing OpenAI voice path — preserved as fallback

---

## Rollout

1. Deploy with flag OFF for everyone (zero behavior change)
2. I send you a written summary of every modified section in `twilio-media-stream/index.ts`
3. You enable flag on your own test number
4. Make 5–10 real test calls (booking, order, menu Q, mid-sentence interruption, multi-language)
5. Tune interruption timing if needed (expect 1–2 iterations)
6. Once satisfied → enable for one pilot client → broader rollout

## Risks (Honest)

1. **Manual interruption will need real-call tuning.** Mitigated by aggressive logging + fallback flag.
2. **3 concurrent WebSockets per call** (Twilio + OpenAI + ElevenLabs). Should be fine but monitored.
3. **ElevenLabs WS occasional drops** — handled with same exponential backoff pattern used for OpenAI today.
4. **First call after deploy** may sound off until tuning settles. Mitigated by flag-gated rollout.

## Files Touched

- `supabase/functions/twilio-media-stream/index.ts` — gated voice-output rewrite + ELEVENLABS_API_KEY read at top
- `supabase/functions/twilio-media-stream/prompts/*.ts` — one-line natural-speech instruction
- `supabase/functions/generate-openai-voice-preview/index.ts` — repoint to Flash v2.5
- `src/components/dashboard/settings/VoiceSelector.tsx` — switch catalog to ElevenLabs voices
- `src/components/dashboard/settings/AISettingsTab.tsx` — add "Premium voice" toggle
- New migration: `use_elevenlabs_voice` on `business_settings`, `elevenlabs_chars_used` on `calls_log`

