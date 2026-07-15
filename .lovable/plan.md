# Plan: Pre-call recording disclosure

Add an automated recording-disclosure message that plays before the AI assistant picks up, handled purely at the TwiML level.

## Change

**File:** `supabase/functions/twilio-voice-webhook-realtime/index.ts`

In the final TwiML response (the `<Response>` block that starts the media stream), insert a `<Say>` element before `<Connect>`:

```xml
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">This call may be recorded for quality and training purposes.</Say>
  <Connect action="...">
    <Stream url="...">
      ...existing parameters...
    </Stream>
  </Connect>
</Response>
```

Twilio plays `<Say>` synchronously, then proceeds to `<Connect><Stream>`, so the AI won't start speaking until the disclosure finishes.

## Notes / non-goals

- No AI prompt changes. The recording-disclosure text stays out of the salon/restaurant system prompts (already removed).
- Voice matches the existing `twimlError` voice (`Polly.Amy-Neural`, `en-GB`) for consistency.
- No changes to `twilio-inbound-sales` (sales callback flow) unless you want the disclosure there too — confirm if needed.
- No DB, no settings toggle — it plays on every inbound AI call. If you later want a per-business toggle, that's a follow-up.

## Verification

Deploy `twilio-voice-webhook-realtime` and place a test call: caller should hear the disclosure line, then the AI greeting.
