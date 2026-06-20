## Problem

June Blitz leads do have recordings in the DB (40/46), but the UI shows "recording unavailable" for all of them.

Cause: those recordings come from Retell and are stored as direct CloudFront URLs like:
`https://dxc03zgurdly9.cloudfront.net/<hash>/recording.wav`

`SecureRecordingPlayer` only knows how to play URLs that match the Twilio proxy pattern (`/outbound-recording-proxy/<SID>.mp3`). Anything else fails the regex on line 17 and renders "recording unavailable". That's why the older Twilio-based recordings (the `dv` campaign) play fine but every Retell-backfilled June Blitz recording doesn't.

## Fix

Update `src/components/admin/outbound/SecureRecordingPlayer.tsx` so it handles both sources:

1. If `url` matches `outbound-recording-proxy/<SID>` → keep the current signed-token flow (Twilio path, requires auth).
2. Otherwise (Retell CloudFront `.wav`/`.mp3`, or any external https URL) → render `<audio controls src={url} />` directly. Retell's CloudFront links are pre-signed/public and playable without our proxy.
3. Keep the "recording unavailable" fallback only for genuinely empty/invalid strings.

No DB or edge-function changes — the recordings are already there, this is purely a player fix so June Blitz (and any future Retell-sourced) recordings actually play.

## Verification

- Open June Blitz → Leads → a row with `call_recording_url` set: audio player appears and plays.
- Open the `dv` campaign's Twilio recording: still plays through the proxy as before.
- A lead with no recording still shows `—`.