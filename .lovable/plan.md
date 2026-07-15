## Goal
Route salon calls through the trimmed `buildSalonSystemPrompt` in `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts` instead of the inline prompt + `buildAdvancedReceptionistRules` combo in `index.ts`. Restaurants and any other business types keep the existing inline path unchanged.

## Changes — `supabase/functions/twilio-media-stream/index.ts`

1. **Add import** at the top (alongside existing prompt imports):
   ```ts
   import { buildSalonSystemPrompt } from "./prompts/salon-prompt.ts";
   ```

2. **Early-return salon branch** in `buildFullSystemPrompt`. Insert immediately after the restaurant `if (isRestaurant) { ... }` block (after line 5829), before the inline `const prompt = ...` construction that begins at line 5468 — actually the inline prompt is built *before* the restaurant branch, so we instead add the salon short-circuit **right before** the `advancedRules` IIFE at line 5831 (so all upstream data — `hours`, `staff`, `services`, `staffServices`, `staffTimeOff`, `businessSettings`, `callerInfo`, `customerSettings` — is already computed and in scope):

   ```ts
   // For salons (non-restaurant business types), use the trimmed salon prompt.
   // Bypass the inline prompt + buildAdvancedReceptionistRules path entirely.
   const salonPrompt = buildSalonSystemPrompt({
     businessName,
     businessNamePhonetic: businessSettings?.business_name_phonetic,
     businessAddress,
     assistantName,
     tone,
     voiceSpeed,
     callerPhone,
     twilioPhoneNumber,
     websiteKnowledge,
     openingHours: hours,
     staff,
     services,
     staffServices,
     staffTimeOff,
     businessSettings,
     callerInfo,
     customerSettings,
     openingContext: businessSettings?.opening_context || undefined,
     recentCallContext: callerInfo.recentCallContext,
   });

   return {
     prompt: salonPrompt,
     businessSettings,
     openingHours: hours,
     staffTimeOff,
     staffServices,
     staff,
     services,
     menuCategories: [],
     menuItems: [],
     menuItemOptionGroups: [],
     menuItemOptions: [],
     tables: [],
     preferredLanguage: callerInfo?.preferredLanguage,
   };
   ```

   The existing inline `prompt` string and the `advancedRules` IIFE + final `return { prompt: prompt + advancedRules, ... }` remain in place as dead-code fallback (kept intentionally per instructions — "Do NOT delete the inline prompt").

3. **Do not touch**: restaurant branch, `buildAdvancedReceptionistRules`, `buildAdvancedRules`, turn-detection settings, or any other file.

## Deploy
Deploy `twilio-media-stream` edge function so the routing change takes effect on the next call.

## Verification
- Confirm TypeScript build passes (all fields on `SalonPromptData` are populated with in-scope variables).
- Trigger a salon test call and confirm via logs that the trimmed salon prompt is used (no "SMART UPSELL" / recording disclosure text, service list not embedded).