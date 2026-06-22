## Goal

Ensure the AI handles every language (Spanish, Welsh, French, German, etc.) with the **same rigor as English** — no date/day mismatches, no looping questions, no category re-asks, no invented translations of dates or service names.

The bugs we saw on the Spanish call (jueves → "viernes 26", looping "damas/caballeros/niños?", "Mehefin" guesses) must not happen in any language.

## File to change (1)

### `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts`

Add a single **LANGUAGE PARITY** block near the top of the prompt body (right after `## VOICE & STYLE`, before `## BUSINESS`) that applies to every language the caller might use. Keep it short — phone prompt, not an essay.

Content of the new block:

- Whatever language the caller is speaking, hold the conversation with the **same accuracy and discipline as English**. No language gets a "looser" version of the rules.
- All existing rules — CONTEXT LOCK, DAY-OF-WEEK ↔ DATE CONSISTENCY, SERVICE CATEGORY LOCK, NARRATING AVAILABILITY, the read-back-before-create_booking guardrail — apply **identically in every language**.
- **Day names map 1:1 across languages and must never be swapped.** Examples (non-exhaustive):
  - EN Thursday = ES jueves = CY dydd Iau = FR jeudi = DE Donnerstag
  - EN Friday = ES viernes = CY dydd Gwener = FR vendredi = DE Freitag
  - EN Saturday = ES sábado = CY dydd Sadwrn = FR samedi = DE Samstag
  If the caller says "jueves", the date you speak MUST be the Thursday — never Friday/Saturday. Same logic for every other day and language.
- **Months map 1:1 too — never guess a translation.** Use the `canonical_date_en` returned by tools as the source of truth and translate it precisely into the caller's language (e.g. June = junio = Mehefin = juin = Juni). If you are not 100% sure of the month name in the caller's language, say the date as digits ("el 25 del 6") rather than invent a word.
- **Service and category names** stored in the database are the source of truth. Do not translate them when calling tools. When speaking, you may translate the *type* of service naturally (e.g. "corte y secado" for "Cut & Blow dry"), but the category lock and disambiguation rules behave exactly the same as in English: once the caller gives a category signal in any language ("mujer / dame / Frau / merch" → ladies' category, etc.), LOCK it and never re-ask.
- **Never ask the same clarifying question twice in any language.** A loop in Spanish is just as bad as a loop in English.
- Read back service + day-name + date + time + staff in the caller's language before `create_booking`, using the LOCKED values. Wait for an explicit yes in that language ("sí", "ie", "oui", "ja", "yes").

## Explicitly NOT changing

- `index.ts` language-lock logic (`buildLanguageRuleBlock`) — language selection stays as is.
- `advanced-rules.ts`, restaurant prompts, VAD settings, recording pipeline.
- The existing English-tuned rules (CONTEXT LOCK, CATEGORY LOCK, DAY ↔ DATE, NARRATING AVAILABILITY) — they stay. The new block just declares they apply equally in every language and adds the day/month mapping anchors.

## Deployment

Redeploy `twilio-media-stream`. Test with one Spanish call and one English call to confirm: (a) same booking flow quality in both, (b) "jueves" stays Thursday end-to-end, (c) no category re-ask after "mujer", (d) month names not invented.

## Risk

Low — prompt-only change, no code paths altered. If the prompt grows too long and starts diluting other rules, we can move the day/month anchor table into a small helper appended only when the detected call language ≠ English.
