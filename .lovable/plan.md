# Fix wrong-language AI responses (Lucy's Welsh call issue)

## What happened
Last call to Lucy's Hair and Beauty: the AI answered and transcribed the entire call in Welsh, even though `business_settings.primary_language = "English"` and the caller was almost certainly speaking English on a UK number. Result: garbled transcript, customer experience broken.

## Root cause
1. The system prompt sent to OpenAI Realtime has **no language instruction at all** (only the Starter tier gets a "English-only" line). Non-Starter tiers get nothing, so the model picks a language at random — often influenced by accent + region.
2. The Whisper transcription config has **no `language` hint** (`transcription: { model: "whisper-1" }`), so STT also free-detects and can lock onto Welsh on a UK number.
3. `business_settings.primary_language` is collected from the owner but never actually used.

## Fix

### 1. `supabase/functions/twilio-media-stream/index.ts` — system prompt
Inject a LANGUAGE RULE block for **all tiers** (replacing the Starter-only block), built from `business_settings.primary_language` (default `English`):

```
## LANGUAGE — HIGHEST PRIORITY RULE:
- ALWAYS respond in {primary_language} by default. The greeting MUST be in {primary_language}.
- Do NOT switch to Welsh, Irish, Scots Gaelic, or any regional dialect — these are NEVER the right answer on a UK number unless the caller is unmistakably speaking that language for multiple full sentences.
- Only switch language if the caller clearly and unambiguously speaks a different MAJOR language (e.g. Spanish, French, German, Polish, Arabic, Mandarin) for at least 2 consecutive full sentences. Accents, single words, or unclear audio do NOT count — keep speaking {primary_language}.
- If a returning caller has preferred_language set, start in that language instead of {primary_language}.
- If unsure what language the caller is speaking, default to {primary_language}. Never guess.
```

This replaces the existing Starter-only block at lines 780–783 with a universal block, while keeping the existing `update_customer_language` tool wiring for genuine language switches.

### 2. `supabase/functions/twilio-media-stream/index.ts` — Whisper STT hint
At line 1936, pass a `language` hint to Whisper derived from `primary_language` (or caller's `preferred_language` if known):

```ts
transcription: {
  model: "whisper-1",
  language: mapToIso639_1(session.preferredLanguage || session.primaryLanguage || "English"),
},
```

`mapToIso639_1` maps `English → "en"`, `Spanish → "es"`, `French → "fr"`, `German → "de"`, `Polish → "pl"`, `Italian → "it"`, `Portuguese → "pt"`, `Arabic → "ar"`, `Mandarin/Chinese → "zh"`. Anything unknown → omit the hint (let Whisper auto-detect rather than send a bad code).

This prevents Whisper from mis-detecting accented English as Welsh/Irish/etc., which is what produced the garbled transcript.

### 3. Plumbing
- Add `primaryLanguage` to the `Session` interface and populate it in `buildFullSystemPrompt` from `business_settings.primary_language`.
- Pass `primaryLanguage` into the prompt template where the new LANGUAGE block is rendered.
- `preferredLanguage` already exists on the session — reuse it.

## Out of scope
- No DB changes (the columns we need already exist).
- No UI changes — `primary_language` is already editable in business settings.
- Restaurant prompt builder path: apply the same LANGUAGE block there too (one-line addition) so restaurants benefit equally.
- No change to `update_customer_language` tool — it still saves a genuine mid-call switch to `customers.preferred_language` so next call starts correctly.

## Files changed
- `supabase/functions/twilio-media-stream/index.ts` (system prompt block + Whisper language hint + Session field + restaurant prompt block)

## Verification
After deploy, place a test call to Lucy's number and confirm: greeting is in English, transcript is coherent English (not Welsh), and the `update_customer_language` flow still fires only on a real language switch.
