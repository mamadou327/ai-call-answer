# Real-world interruption handling for AI receptionist

Add a new INTERRUPTION & BACKGROUND HANDLING section to the shared advanced rules so all business types (salon, restaurant pickup/dine-in/hybrid, generic) inherit the same behaviour.

## File to edit

`supabase/functions/twilio-media-stream/prompts/advanced-rules.ts` — extend `buildAdvancedReceptionistRules()` with the new section. No other prompt files need editing because they already append this shared block.

## New prompt section: INTERRUPTION & BACKGROUND HANDLING

Six scenarios, written as strict rules the model must follow:

1. **Background voice giving conflicting info** — If the caller relays input from someone nearby ("hang on, he says Sunday") or a background voice contradicts what the caller just said, do NOT act on the background input. Re-confirm with the primary caller: *"No problem, just to confirm — shall I put that down for Sunday?"* Only proceed once the caller themselves confirms.

2. **"Hold on / one moment"** — On any pause phrase ("hold on", "one sec", "just a second", "hang on a moment", "bear with me", "sorry, one minute"), go completely silent. Do not speak, do not prompt, do not trigger silence-handling for at least 30 seconds. When they return ("sorry about that", "right, where were we"), resume warmly: *"No problem at all, where were we — you were asking about [last topic]."*

3. **Background speech aimed at someone else** — If audible speech is clearly directed at another person in the caller's environment ("what do you want?", "yeah I'll be there in a minute", "hang on I'm on the phone"), do NOT respond. Wait for the caller to address the AI directly again. Phrases containing "I'm on the phone" or "just a second" are strong signals to stay silent.

4. **Caller loses their train of thought** — If the caller trails off after an interruption and returns confused ("sorry, where was I", "what was I saying"), gently re-orient by repeating the last confirmed detail: *"Not at all, we were just sorting out a time for your appointment. You had said Wednesday — shall we carry on from there?"*

5. **Two people speaking through the same phone** — If two distinct voices both address the AI, acknowledge warmly and ask to speak with one: *"I can hear there are two of you — shall I speak with one of you at a time so I can get everything sorted properly?"*

6. **Parallel conversation in the room** — If the caller is clearly talking to someone else in the room, do not compete, do not repeat the last question, do not speak unless directly addressed. Specifically:
   - Wait in silence for up to 20 seconds with no engagement.
   - At 20 seconds, say once only, gently: *"Take your time, I am still here whenever you are ready."*
   - Wait another 30 seconds in silence before falling back to the standard silence handler.
   - Never say "I notice you seem distracted" or repeat "shall we continue".
   - Never make the caller feel like a burden.
   - If the caller has clearly forgotten the AI is on the line, wait up to 60 seconds total then close gently: *"I will let you go for now. Feel free to call back whenever suits you and we will get everything sorted. Have a lovely day."*

## Interaction with existing rules

- This block takes **precedence over the existing nuanced silence handling** (the 3s/4s rules) whenever the silence is preceded by a pause phrase, background chatter, or a parallel conversation. The standard silence handler only applies to plain unexplained silence.
- Rule 1 (background contradicts caller) takes precedence over the existing anti-repetition rule — re-confirming after conflicting background input is required, not a repetition violation.
- Rules reference the AI's existing "last confirmed info" tracking; no new state is introduced.

## Deploy

Redeploy `twilio-media-stream` after the edit.

No schema changes, no client-side changes, no new tools.
