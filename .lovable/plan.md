

## Plan: Switch defaults to British voices

Since you're UK-based, I'll make British voices the default and prioritise them in the picker.

### Changes

**1. Database default → George (warm British male)**
- Update `business_settings` defaults:
  - `elevenlabs_voice_id` default: `'JBFqnCBsd6RMkjVDRZzb'` (George — warm British)
- New businesses will get George by default instead of Sarah.

**2. Lebanese Grill → switch to British voice**
- Update Lebanese Grill's `business_settings.elevenlabs_voice_id` to George (`JBFqnCBsd6RMkjVDRZzb`).
- Keeps `use_elevenlabs_voice = true`.

**3. Voice picker — British-first curated list**

Replace the 8-voice list with a British-led selection:

| Voice | Gender | Accent | Vibe |
|---|---|---|---|
| **George** (new default) | Male | British | Warm, professional |
| **Alice** | Female | British | Confident, clear |
| **Lily** (`pFZP5JQG7iQjIQuC4Bku`) | Female | British | Soft, friendly |
| **Charlie** (`IKne3meq5aSn9XLyUdCD`) | Male | British | Conversational, natural |
| Sarah | Female | American | Warm, friendly |
| Brian | Male | American | Deep, narrator |

Grouping in the UI changes from "Female / Male" to **"British Voices"** (top, highlighted) and **"Other Voices"** (American) below — so UK businesses see their accent first.

**4. Section copy**
Tweak the AI Voice description to: *"British voices recommended for UK businesses. Click play to preview, then click a card to select."*

### Files

1. New migration — change DB default to George + update Lebanese Grill's voice.
2. `src/components/dashboard/settings/VoiceSelector.tsx` — reorder list, regroup by accent, update copy.

No edge function or onboarding changes needed.

