## What I found

I went straight to the edge function logs and the root cause is unambiguous. It is **not** the webhook token, the phone number, the services, or the opening hours — those are all fine. It is OpenAI.

### 1. `twilio-media-stream` logs — exact failure point

For the most recent call (`CA497e5635c9a81f5a18112757c44fc754`), the function:

1. Loaded staff/service assignments successfully (`David -> Haircut 1`).
2. Connected the WebSocket to OpenAI Realtime (`OpenAI WebSocket connected`).
3. Immediately received an error from OpenAI and the socket was closed:

```
[MediaStream] OpenAI error: {
  type: "invalid_request_error",
  code: "beta_api_shape_disabled",
  message: "The Realtime Beta API is no longer supported. Please use /v1/realtime for the GA API."
}
[MediaStream] OpenAI WebSocket closed { code: 4000, reason: "invalid_request_error.beta_api_shape_disabled", wasClean: true }
```

4. The code then tried to reconnect 5 times in a row (`Scheduling in-place OpenAI reconnect (1/5) in 1500ms`) — every attempt failed with the exact same error.

Because the AI socket is never usable, no greeting is ever sent down to Twilio → the caller hears complete silence until Twilio tears the stream down.

### 2. Twilio webhook token

Not the cause. The companion `twilio-stream-action` and `twilio-recording-callback` logs for the same call both show:

```
[StreamAction] Signature validated successfully
[RecordingCallback] Twilio signature validated successfully
```

So the business has a valid `twilio_webhook_token` and Twilio is sending it correctly.

### 3. OpenAI Realtime WebSocket

It **does** connect (TLS + WS upgrade succeed), but OpenAI closes it with code `4000` and reason `beta_api_shape_disabled` the moment our code identifies itself as a beta client. This is not a timeout, not a network issue, not an auth issue — OpenAI turned off the beta-shaped Realtime API.

### 4. Twilio phone number / webhook URL

Working correctly. Twilio is calling the right endpoint, the media stream starts (`Stream rotation check started`), the action callback fires, and recording uploads succeed. No misconfiguration there.

### 5. Services and opening hours

Configured. The session log shows `Loaded 1 staff-service assignments for 1 staff members` and `Staff-service assignments: David -> Haircut 1`. If they were missing the session wouldn't get this far. Not the cause.

## Root cause (one sentence)

OpenAI has deprecated the Realtime **Beta** API. Our `twilio-media-stream` edge function still connects with the beta subprotocol and sends a beta-shaped `session.update` payload, so OpenAI closes the socket immediately and the AI never speaks.

Specifically, in `supabase/functions/twilio-media-stream/index.ts`:

- Line 1082 uses model `gpt-4o-realtime-preview-2024-12-17`.
- Lines 1083–1087 send the WS subprotocols `["realtime", "openai-insecure-api-key.<key>", "openai-beta.realtime-v1"]` — the `openai-beta.realtime-v1` token is the trigger.
- Lines 1771–1797 build a beta-shaped session config (flat `modalities`, `input_audio_format`, `output_audio_format`, `input_audio_transcription`, `voice`, `turn_detection`, `temperature`, `max_response_output_tokens`) that is no longer accepted on the GA endpoint.

## Fix plan

Migrate `twilio-media-stream` to the GA Realtime API. Scope is intentionally narrow — only the OpenAI connection and the first `session.update` payload change. No DB, no Twilio, no ElevenLabs adapter changes.

1. **Connect to GA endpoint, drop the beta subprotocol.**
   - Update `connectToOpenAI` (around line 1078) to:
     - URL: `wss://api.openai.com/v1/realtime?model=gpt-realtime` (GA model id; we'll keep it as a `OPENAI_REALTIME_MODEL` constant at the top of the file so it can be swapped without code-diving).
     - Subprotocols: `["realtime", "openai-insecure-api-key.${OPENAI_API_KEY}"]` — remove `openai-beta.realtime-v1`.
   - Keep all reconnect / keepalive / silence detection wiring exactly as it is.

2. **Rewrite the first `session.update` into the GA shape.**
   In `sendSessionConfig` (around line 1743), replace the current flat session object with the GA nested shape:
   ```ts
   {
     type: "session.update",
     session: {
       type: "realtime",
       model: OPENAI_REALTIME_MODEL,
       instructions: session.systemPrompt,
       tools,
       tool_choice: "auto",
       output_modalities: session.useElevenLabs ? ["text"] : ["audio"],
       audio: {
         input: {
           format: { type: "audio/pcmu" },           // g711_ulaw -> GA name
           turn_detection: {
             type: "server_vad",
             threshold: 0.75,
             prefix_padding_ms: 300,
             silence_duration_ms: 1000,
             create_response: true,
           },
           transcription: { model: "whisper-1" },
         },
         output: session.useElevenLabs ? undefined : {
           format: { type: "audio/pcmu" },
           voice: session.voice,
         },
       },
     },
   }
   ```
   Notes:
   - `modalities` → `output_modalities`.
   - `input_audio_format` / `output_audio_format` ("g711_ulaw") → `audio.input.format` / `audio.output.format` with `{ type: "audio/pcmu" }`.
   - `input_audio_transcription` → `audio.input.transcription`.
   - `turn_detection` is nested under `audio.input.turn_detection`.
   - `voice` is nested under `audio.output.voice`.
   - `temperature` and `max_response_output_tokens` are dropped — they are not part of the GA session shape. The model defaults are fine for our use case; we can revisit if responses get noticeably worse.
   - When `useElevenLabs` is true, omit the `audio.output` block entirely so OpenAI returns text only and our ElevenLabs adapter continues to handle TTS.

3. **Leave everything else alone.**
   - The greeting `response.create` (lines 1826–1870) keeps working as-is — only the `modalities` field on the *response* might need to become `output_modalities`; I'll verify against the GA event reference during build and adjust only if required.
   - `session.created` / `session.updated` handlers, ElevenLabs adapter, rehydrate-on-reconnect, tool-call routing, recording, keepalive, rotation — no changes.

4. **Verify.**
   - Deploy `twilio-media-stream`.
   - Watch the next call's edge function logs: expect `OpenAI WebSocket connected` followed by `OpenAI session updated` and **no** `beta_api_shape_disabled` error.
   - Confirm the caller hears the forced greeting ("Hey there! Thanks for calling …") within ~1s of pickup.
   - If anything fails, the logs will show the new GA error message and we iterate on the session shape only.

## Out of scope for this fix

- Webhook token rotation, phone number reassignment, opening hours / services edits — confirmed unaffected.
- No DB migration.
- No frontend changes.
