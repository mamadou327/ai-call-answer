# Make voice ↔ language honest in the voice picker

## The problem
- All 26 voices in `voice_library` are English (British/American). The TTS model (`eleven_flash_v2_5`) is multilingual, so they *play* in any language — but they sound English-accented and mispronounce non-English words (Welsh "Mehefin" → "Mawrth", "Lorena" → "Larina").
- The picker shows no language info, so a Welsh / Spanish / Polish business has no way to know.

## What to change

### 1. Add language metadata to `voice_library`
Migration adds two columns:
- `verified_languages text[]` — list of ISO codes the voice is verified for by ElevenLabs (e.g. `{en,es,fr}`)
- `is_multilingual boolean` — true if the voice is verified in more than just English

Backfill plan: a one-off edge function `sync-voice-library-languages` calls `GET https://api.elevenlabs.io/v1/voices/{voice_id}` for every row, reads `verified_languages` and `high_quality_base_model_ids`, and writes both columns. Run once after deploy; safe to re-run.

### 2. Show language support in the picker
`src/components/dashboard/settings/VoiceSelector.tsx`:
- Add a "Languages" chip on each voice card showing the verified language codes (or "English only").
- Add a filter at the top: "Show voices that support: [business's primary language]" — default on when `business_settings.primary_language` is not `en`.
- If the business's primary language is not in the selected voice's `verified_languages`, show a soft warning under the voice: *"Will speak [Welsh] in an English accent — pronunciation may be off."*

### 3. Curate at least one strong non-English voice option
If the ElevenLabs sync reveals none of the current 26 voices are verified for the business's language (likely for Welsh, possibly for others), add a follow-up note in the picker linking to ElevenLabs Voice Library so the user can paste a custom voice ID. The `elevenlabs_voice_id` column already supports arbitrary IDs.

## Out of scope
- Re-training/cloning a Welsh-specific voice
- Swapping the TTS model — Flash v2.5 stays (latency requirement)
- Per-language voice routing (one call switching voices mid-conversation when caller switches language) — possible follow-up if you want it

## Files
- `supabase/migrations/<new>.sql` — add columns to `voice_library`
- `supabase/functions/sync-voice-library-languages/index.ts` — new one-off backfill function
- `src/components/dashboard/settings/VoiceSelector.tsx` — language chips, filter, warning

## Answer to your direct question
**No — none of the 26 voices in your library are multilingual voices.** They're all English (British or American). The *model* underneath is multilingual, so non-English calls work, but the voice itself will always sound English. This plan makes that visible in the UI and lets you add a proper multilingual voice if you want one.
