## Goal
Make the service disambiguation rule fully generic so it applies to ANY ambiguous service request, not just "cut and blow dry". The cut/blow dry case is just one example — the same logic must cover colour vs highlights vs balayage, manicure vs gel manicure, massage types, facial tiers, beard trim vs beard sculpt, etc.

## Changes

### 1. `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts`
Rewrite the "SERVICE DISAMBIGUATION" block I added last turn so it:

- States the rule as universal: "Whenever the caller's words could match more than ONE row in get_services, you MUST ask a clarifying question before booking. This applies to EVERY service category, not just haircuts."
- Lists multiple example families (haircuts, colour, nails, massage, facials, beard work, waxing) so the AI doesn't pattern-match only on "cut and dry".
- Keeps the two-step funnel:
  1. Narrow to the right service family (e.g. "cut and dry" → blow dry vs hand dry; "colour" → full colour vs roots vs highlights vs balayage; "massage" → Swedish vs deep tissue vs hot stone).
  2. Narrow to the right variant within that family (short/medium/long hair, 30/60/90 min, with/without add-on).
- Forbids defaulting to cheapest, first-listed, or most popular.
- Requires reading back the exact matched service name + duration + price before `check_availability` / `create_booking`.
- One clarifying question at a time, short and natural.

### 2. Restaurant prompts (`restaurant-dine-in-prompt.ts`, `restaurant-pickup-prompt.ts`, `restaurant-hybrid-prompt.ts`)
Add the equivalent rule for menu items, since the same problem applies there (e.g. "I'll have the burger" when there are 4 burgers; "a coke" when there's regular/diet/zero; pizza sizes; pasta options). Same structure: if the caller's words match more than one menu_item / option / size, ask a short clarifying question before adding to the order. Never assume.

### 3. Deploy
Redeploy `twilio-media-stream` so the updated prompts take effect on the next call.

## Out of scope
- No DB or frontend changes.
- No changes to the language-lock or availability rules from previous turns.