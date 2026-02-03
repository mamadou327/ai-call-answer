

## Goal
Allow business owners to specify how their restaurant name should be pronounced by the AI voice assistant, fixing mispronunciation issues for non-English or unusual names.

## The Problem
When the AI says the business name (e.g., "Thanks for calling [Restaurant Name]"), it may mispronounce it because:
- The name has a non-English origin (French, Italian, etc.)
- The spelling doesn't match the pronunciation
- It's a unique or creative name

Currently there's no way for business owners to guide the AI on pronunciation.

## Solution
Add a **"Phonetic Name"** field in the AI Settings that lets the business owner write out how their name should be pronounced. The AI prompts will use this phonetic version when speaking, while the actual business name is used for display purposes.

**Example:**
- Business Name: "Phở Việt Nam"
- Phonetic Name: "Fuh Vee-et Nahm"

The AI will say "Thanks for calling Fuh Vee-et Nahm" instead of trying to read the original spelling.

## Files to change

### 1. Database: Add `business_name_phonetic` column
Add a new column to `business_settings` table to store the phonetic pronunciation.

### 2. `src/components/dashboard/settings/AISettingsTab.tsx`
Add a new input field for "Phonetic Business Name" with:
- Placeholder showing an example
- Helper text explaining what it's for
- The field saves to `business_name_phonetic` in `business_settings`

### 3. `supabase/functions/twilio-media-stream/index.ts`
When building the prompt, fetch the `business_name_phonetic` from business_settings and pass it to the prompt builders.

### 4. All prompt builder files:
- `prompts/restaurant-pickup-prompt.ts`
- `prompts/restaurant-hybrid-prompt.ts`
- `prompts/restaurant-dine-in-prompt.ts`
- `prompts/salon-prompt.ts`

For each, add a new parameter `businessNamePhonetic` and update the prompts to:
- Use the phonetic name when the AI speaks (greeting, confirmations)
- Add a note in the prompt telling the AI to pronounce the name as specified

**Example prompt update:**
```
BUSINESS INFORMATION:
- Name: ${businessName}
${businessNamePhonetic ? `- SAY THE NAME AS: "${businessNamePhonetic}" (this is how to pronounce it)` : ""}
```

## UI Design (in AI Settings)
```
┌─────────────────────────────────────────────┐
│ Phonetic Business Name                      │
│ ┌─────────────────────────────────────────┐ │
│ │ e.g., "Fuh Vee-et Nahm"                 │ │
│ └─────────────────────────────────────────┘ │
│ Write out how your business name should be  │
│ pronounced. Leave blank if the spelling is  │
│ straightforward.                            │
└─────────────────────────────────────────────┘
```

## Technical Details

### Database migration:
```sql
ALTER TABLE business_settings 
ADD COLUMN IF NOT EXISTS business_name_phonetic TEXT;
```

### Prompt interface update:
```typescript
interface RestaurantPickupPromptData {
  businessName: string;
  businessNamePhonetic?: string;  // NEW
  // ... other fields
}
```

### Prompt usage:
```typescript
// In the system prompt:
BUSINESS INFORMATION:
- Name: ${businessName}
${businessNamePhonetic 
  ? `- PRONUNCIATION: When saying the business name aloud, pronounce it as: "${businessNamePhonetic}"` 
  : ""}
```

## Expected outcome
After implementation:
1. Business owner goes to Settings → AI Settings
2. Enters their phonetic spelling (e.g., "Peet-zuh Nah-poh-lee" for "Pizza Napoli")
3. When AI answers calls, it pronounces the name correctly
4. The actual business name still appears correctly in the dashboard, confirmations, etc.

