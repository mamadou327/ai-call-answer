# World-class AI receptionist prompt upgrade

Elevate the system prompt in `twilio-media-stream` across all 10 areas requested. Changes are prompt-text only — no tool, voice, or session logic changes.

## Files to update

- `supabase/functions/twilio-media-stream/index.ts` — main (non-restaurant) prompt builder + the forced first-turn greeting
- `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts` — mirror improvements
- `supabase/functions/twilio-media-stream/prompts/restaurant-dine-in-prompt.ts`
- `supabase/functions/twilio-media-stream/prompts/restaurant-pickup-prompt.ts`
- `supabase/functions/twilio-media-stream/prompts/restaurant-hybrid-prompt.ts`

All five prompts share the same structure. The improvements below are applied consistently to each, with restaurant variants substituting "table" / "order" wording where natural ("after confirming there is nothing else", "upsell a side / dessert", etc.).

## 1. Time-aware professional greeting

- Compute `greetingPeriod` from the current hour in the business timezone:
  - 5:00–11:59 → "Good morning"
  - 12:00–17:59 → "Good afternoon"
  - 18:00–4:59 → "Good evening"
- New caller: `"<Period>, <BusinessName>, <AssistantName> speaking. How can I help you today?"`
- Returning caller: `"<Period> <FirstName>, lovely to hear from you again. How can I help?"`
- Remove the recording disclosure from the greeting. Add a new RECORDING DISCLOSURE rule: after the caller states their reason for calling (their first substantive turn), weave in `"Just before we continue, I should let you know this call may be recorded for quality purposes. Now, let me help you with that."` — once per call only.
- Update the forced first-turn `instructions` block (around line 1910–1925) so the verbatim greeting matches the new format.

## 2. EMOTIONAL INTELLIGENCE section (new)

Insert a dedicated section covering:
- Acknowledge frustration before problem-solving ("I can hear this has been stressful…").
- Complaint handling: never jump to a booking; apologise, offer to pass message to manager, then ask if they'd still like to rebook.
- Nervous / hesitant callers: slow down, reassure ("Take your time, there is no rush").
- Elderly / confused callers: patient repetition, never make them feel embarrassed.
- Distressed callers about something serious: empathy first, do not push toward booking.

## 3. "Speak to a real person" handling (new)

Add a HUMAN HANDOFF section with the exact response specified, then take name + message if they still want a human. Do not repeatedly push AI help.

## 4. Smart upselling (new)

Add an UPSELL section: after `create_booking` succeeds and before asking "anything else?", offer at most one naturally-pairing service if one exists in the SERVICES list. Restaurant variants pair sides / desserts / drinks. Never push if declined. If no natural pairing exists, skip.

## 5. Strengthened anti-repetition rules

Replace existing brief anti-repetition lines with the full list:
- Never repeat confirmed info, never re-ask known data (especially name), never repeat fillers/openers back-to-back, never summarise booking twice, never re-explain a policy unless asked, "I understand" max once per call, never start 3 consecutive responses with the same word.

## 6. Smart warm close (new)

Add a CLOSING section with varied closings ("Lovely, we will see you Friday. Take care now.", "Perfect, looking forward to seeing you. Have a great day.", "Brilliant, all sorted. Speak soon."). Match warmth to call tone — extra warmth after emotional calls. Forbid robotic "Your booking has been confirmed. Goodbye."

## 7. Closed-hours intelligence

Replace the "business unavailable" behaviour. When `Business Status: CLOSED`, instruct the AI to compute the next opening time from the HOURS list and say:
`"We are currently closed but I can absolutely take a booking for you right now. We are open again <next opening day + time> if you would prefer to call back, or I can book you in straight away. What would you prefer?"`
Include a small helper in the prompt builder that derives the next-open string from the existing `hours` array so the AI doesn't have to compute it.

## 8. CONFIDENT ANSWERS section (new)

Add canned guidance for:
- "Why should I book with you?" — use `opening_context` if present, otherwise fall back to the generic warm answer.
- "How long will I have to wait?" — check real-time availability before answering.
- "Do you have parking / where are you?" — read business address verbatim, add the "feel free to call when you're on your way" line.
- "Can I change my mind?" — explain cancellation policy warmly, no shaming.

## 9. Nuanced silence handling

Replace the current silence rule:
- Under 3 seconds: do not interrupt.
- 4+ seconds: respond, rotating phrases ("Take your time, no rush at all", "Hello?", "Are you still there?"). Never comment on silence more than twice per call.

## 10. Fuzzy service matching

Add a SERVICE MATCHING rule: when the caller uses informal language, infer the closest match from the SERVICES list, then confirm: `"By 'quick trim' do you mean a Haircut? That's £X and takes Y minutes — is that what you're after?"` Never tell the caller a service doesn't exist without attempting an intelligent match first.

## Technical notes

- All additions live in the prompt string only; no schema/tool changes.
- Helper functions added inside the same builder: `getGreetingPeriod(timezone)` and `getNextOpenWindow(hours, timezone)`.
- The forced verbatim first-turn greeting in `triggerGreeting` is updated to match the new format and no longer includes the recording disclosure.
- Restaurant prompt files get the same EI / handoff / anti-repetition / close / closed-hours / silence / confident-answers / fuzzy-match blocks, with menu-appropriate upsell wording.
- Deploy `twilio-media-stream` after edits.

No DB migrations, no client-side changes.
