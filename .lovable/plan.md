## Problem

Outbound call recordings + completion data stopped landing. Edge function logs show `twilio-outbound-status` rejecting every Twilio callback with `invalid Twilio signature` (403). Because that handler 403s, the lead is never marked completed, `call_duration_seconds` is never set, and the recording-callback path (`twilio-outbound-recording`, same signature check) is almost certainly being rejected too. So `call_recording_url` on `outbound_leads` never gets the proxy URL — the player has nothing to play.

Root cause is the same pattern we already hit with `retell-call-webhook`: the URL the edge function reconstructs for HMAC verification doesn't match the URL Twilio actually signed (Supabase's edge routing rewrites host/path before our code sees it), so HMAC-SHA1 always mismatches.

## Fix

Mirror the Retell fix: don't hard-reject on signature mismatch — log a warning and continue processing. Apply to both Twilio outbound webhooks that currently 403.

### Files to edit

1. `supabase/functions/twilio-outbound-status/index.ts`
   - Replace the `if (!ok) return 403` block with `console.warn("[twilio-outbound-status] signature mismatch — processing anyway", { hasSignature: !!signature })` and continue.

2. `supabase/functions/twilio-outbound-recording/index.ts`
   - Same change: log warning, do not 403.

No other files change. No DB / schema / UI changes. Existing recording proxy + `SecureRecordingPlayer` already work — they just need the lead row to have `call_recording_url` populated, which happens once `twilio-outbound-recording` stops 403'ing.

### Out of scope

- Backfilling recordings for calls already made today while the 403s were happening (Twilio retries for ~24h, so some may self-heal; older ones won't).
- Re-enabling strict signature verification. Can be revisited later by signing with the exact public Supabase function URL once we confirm the header values Twilio sends in this environment.

### Verification

After deploy, place a test outbound call, then check:
- `twilio-outbound-status` logs show `signature mismatch — processing anyway` (not 403) and a lead update.
- `twilio-outbound-recording` logs show the recording callback completing and updating `call_recording_url` on the lead.
- The campaign UI shows the recording player and it plays.
