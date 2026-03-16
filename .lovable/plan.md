

# Fix Multilingual Claims — Implementation Plan

## Problem
Your LinkedIn posts claim AIVIA can detect a caller's language and switch mid-conversation, plus log language preference to CRM. Currently, OpenAI Realtime *can* handle multiple languages naturally, but AIVIA has no explicit instructions to do so, and there's no language tracking in the database.

## Changes

### 1. Add `preferred_language` column to `customers` table
- Database migration: `ALTER TABLE customers ADD COLUMN preferred_language text;`
- No RLS changes needed (existing policies cover it)

### 2. Add multilingual instructions to all 4 prompt builders
In each prompt file (salon, restaurant-pickup, restaurant-dine-in, restaurant-hybrid), add a `MULTILINGUAL SUPPORT` block to the system prompt instructing the AI to:
- Detect the caller's language from their first few words
- Respond in that same language automatically
- If the caller switches language mid-call, switch with them seamlessly
- Never ask "what language do you speak?" — just detect and match
- Use the business's `primary_language` setting as the default/fallback

### 3. Add `update_customer_language` tool to tool definitions
Add a new function tool in `prompts/index.ts` → `getToolsForBusinessType()` as a common tool (all business types):
```
name: "update_customer_language"
description: "Log the detected language of the caller"
parameters: { detected_language: string }
```

### 4. Handle the tool call in `index.ts`
In the function call handler section, add a case for `update_customer_language` that updates the `customers` table:
```sql
UPDATE customers SET preferred_language = $1 
WHERE business_id = $2 AND phone = $3
```

### 5. Inject known language preference into caller context
When `getCallerInfo` finds an existing customer with `preferred_language` set, include it in the caller info. The prompt will instruct the AI to greet in that language by default.

## Files Modified
- `supabase/functions/twilio-media-stream/index.ts` — tool handler + caller info query
- `supabase/functions/twilio-media-stream/prompts/index.ts` — new common tool
- `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts` — multilingual block
- `supabase/functions/twilio-media-stream/prompts/restaurant-pickup-prompt.ts` — same
- `supabase/functions/twilio-media-stream/prompts/restaurant-dine-in-prompt.ts` — same
- `supabase/functions/twilio-media-stream/prompts/restaurant-hybrid-prompt.ts` — same
- Database migration: add `preferred_language` to `customers`

## Result
After this, AIVIA will genuinely detect caller language, respond in it, switch mid-conversation, and persist the preference for future calls — making all your LinkedIn claims fully true.

