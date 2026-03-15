

# Cross-Call Memory Implementation Plan

## Overview
Add the ability for the AI voice agent to remember recent conversations when a caller rings back within 30 minutes, by querying `call_conversations` and injecting a summary into the system prompt.

## Changes

### 1. Extend `getCallerInfo` in `supabase/functions/twilio-media-stream/index.ts`

**Add a `recentCallContext` field to `CallerInfo` interface** (line ~246):
- Add `recentCallContext?: string` to the interface

**Add recent call lookup at the end of `getCallerInfo`** (after line ~5038):
- Query `call_conversations` for the same `caller_phone` (using normalized phone ILIKE match) and `business_id`, within the last 30 minutes, excluding the current call
- Extract the last 5-8 messages from the `messages` JSON array
- Format them into a readable summary like: `"Caller asked about booking for 6 people at 7pm Friday. Assistant confirmed and created reservation REF ABC-1234."`
- Attach to the returned `CallerInfo` object as `recentCallContext`

**Pass `currentCallSid` to `getCallerInfo`**: Update the function signature and the call site (line ~4242) to pass `session.callSid` so we can exclude the current conversation from the query.

### 2. Inject recent call context into salon prompt (`buildFullSystemPrompt` in index.ts)

In the salon prompt section (around line ~4856 where `callerContext` is used), append the recent call memory block when `callerInfo.recentCallContext` exists:

```
═══════════════════════════════════════
📞 RECENT CALL MEMORY (< 30 min ago)
═══════════════════════════════════════
The caller spoke with you very recently. Here's what was discussed:
<summary>

INSTRUCTIONS: Acknowledge naturally if the caller references the previous call.
Do NOT repeat the entire summary — just use the context to help.
```

### 3. Inject into restaurant prompt builders

Add the same `recentCallContext` injection to each of the 4 prompt builders in `supabase/functions/twilio-media-stream/prompts/`:
- **salon-prompt.ts** — Append after `callerContext` block (~line 104)
- **restaurant-pickup-prompt.ts** — Append after caller context section
- **restaurant-dine-in-prompt.ts** — Append after caller context section  
- **restaurant-hybrid-prompt.ts** — Append after caller context section

All 4 follow the same pattern: check if `callerInfo.recentCallContext` exists, and if so, append the memory block to the prompt.

### 4. Also inject into the main `buildFullSystemPrompt` salon path

The salon prompt is built directly in `index.ts` (line ~4616-4875) rather than using the prompt builder file. The `callerContext` variable (line ~4430-4438) needs the recent call memory appended there too.

## Files Modified
- `supabase/functions/twilio-media-stream/index.ts` — CallerInfo interface, getCallerInfo function, buildFullSystemPrompt caller context
- `supabase/functions/twilio-media-stream/prompts/salon-prompt.ts` — Inject recent call context
- `supabase/functions/twilio-media-stream/prompts/restaurant-pickup-prompt.ts` — Same
- `supabase/functions/twilio-media-stream/prompts/restaurant-dine-in-prompt.ts` — Same
- `supabase/functions/twilio-media-stream/prompts/restaurant-hybrid-prompt.ts` — Same

## No Database Changes Needed
The `call_conversations` table already has `messages`, `caller_phone`, `business_id`, and `created_at` — everything required.

