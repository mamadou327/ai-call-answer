## Goal
Apply the two approved fixes to the `twilio-outbound-media-stream` edge function so outbound AI conversations feel natural and model references stay consistent with the inbound path.

## Fix 1 — VAD settings in `sendSessionConfig`
File: `supabase/functions/twilio-outbound-media-stream/index.ts`
- Change `threshold` from `0.6` to `0.75`
- Change `prefix_padding_ms` from `400` to `300`
- Change `silence_duration_ms` from `900` to `2500`

## Fix 2 — Mirror inbound model constant (Option A)
File: `supabase/functions/twilio-outbound-media-stream/index.ts`
- Add a top-level constant: `const OPENAI_REALTIME_MODEL = "gpt-realtime";`
- Replace the hardcoded `"gpt-realtime"` in the WebSocket URL (`connectOpenAi`) with `OPENAI_REALTIME_MODEL`
- Replace the hardcoded `"gpt-realtime"` in the session config (`sendSessionConfig`) with `OPENAI_REALTIME_MODEL`
- No actual model name change — value stays `"gpt-realtime"` for consistency only

## Deploy
- Deploy `twilio-outbound-media-stream` only after edits