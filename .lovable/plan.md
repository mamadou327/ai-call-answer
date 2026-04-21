

## Plan: Diagnose and force ElevenLabs path to activate

### What we know

- DB is correct: `use_elevenlabs_voice = true`, `elevenlabs_voice_id = EXAVITQu4vr4xnSDxMaL` (Sarah) for Lebanese Grill.
- `ELEVENLABS_API_KEY` secret is configured.
- Source code in `twilio-media-stream/index.ts` correctly reads the flag and branches to ElevenLabs.
- But the most recent test-call logs show `voice: "ballad"` and **zero** `[ElevenLabs]` or `Premium voice ENABLED` log lines — meaning the deployed function is not executing the new code path.

Most likely cause: the deployed edge-function bundle is stale (from before the ElevenLabs integration landed, or from the pre-fix broken build). We need to force a redeploy and add one diagnostic log to prove which code path fires.

### Fix steps

1. **Add a single module-load diagnostic log** at the very top of `supabase/functions/twilio-media-stream/index.ts` so we can confirm the new bundle is live:
   ```ts
   console.log("[MediaStream] Boot — ElevenLabs integration build 2026-04-21, ELEVENLABS_API_KEY present:", !!Deno.env.get("ELEVENLABS_API_KEY"));
   ```

2. **Add a diagnostic log at the flag-decision point** (around line 483) so every incoming call reports how the flag resolved:
   ```ts
   console.log("[MediaStream] ElevenLabs decision", {
     businessId: business.id,
     use_elevenlabs_voice_from_db: settings?.use_elevenlabs_voice,
     api_key_present: !!ELEVENLABS_API_KEY,
     resolved_useElevenLabs: useElevenLabs,
     elevenLabsVoiceId,
   });
   ```

3. **Trigger a redeploy** by saving `index.ts` (the edits above force a fresh deploy automatically).

4. **User makes one more test call** to +447458691055.

5. **Pull logs** and look for:
   - The boot log → confirms new bundle is live
   - The decision log → tells us exactly why the flag did or didn't activate
   - Either `Premium voice ENABLED` + `[ElevenLabsTTS] ws-open` (success) or a concrete reason (flag false / key missing / voice id rejected)

### Why this is safe

- Only adds log lines — no behavior changes.
- Touches only `twilio-media-stream/index.ts`.
- If ElevenLabs path still doesn't fire, the decision log will pinpoint the exact value that's wrong (DB read, key read, or voice id logic).

### Files changed

- `supabase/functions/twilio-media-stream/index.ts` — two `console.log` additions

