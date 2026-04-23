

## Plan: Roll out ElevenLabs as the default voice for all new businesses + give clients a voice picker

### Goal

1. Every newly onboarded business automatically uses ElevenLabs (Sarah voice) — no manual toggle needed.
2. Lebanese Grill stays on ElevenLabs (already configured).
3. Existing businesses keep their current OpenAI voice (no surprise billing).
4. Clients get a clean UI in **Settings → AI Settings** to browse, preview, and pick from a curated set of ElevenLabs voices.

---

### Part 1: Backend — make ElevenLabs the default for new businesses

**Migration** on `business_settings`:
- Change column default: `use_elevenlabs_voice` → `true`
- Change column default: `elevenlabs_voice_id` → `'EXAVITQu4vr4xnSDxMaL'` (Sarah)
- Do **not** backfill existing rows — only new businesses inherit the default.

This way the onboarding flow (`OnboardingStep5` etc.) needs no code change — any new `business_settings` row created automatically gets ElevenLabs + Sarah.

---

### Part 2: Frontend — voice picker UI in AI Settings

Replace the current OpenAI-only `VoiceSelector` component with an **ElevenLabs voice picker** that shows a curated set of 8 voices grouped by gender, with a per-voice play button that previews the voice saying the business's actual greeting.

**Curated voice library** (mix of accents, M/F balance):

| Voice | Gender | Vibe |
|---|---|---|
| Sarah (default) | Female | Warm, friendly American |
| Laura | Female | Bright, upbeat |
| Alice | Female | Confident British |
| Matilda | Female | Calm, professional |
| Roger | Male | Confident American |
| George | Male | Warm British |
| Liam | Male | Articulate, young |
| Brian | Male | Deep, narrator-style |

**UI layout** (in `AISettingsTab.tsx`):

```text
┌─ AI Voice ─────────────────────────────┐
│ Currently using: Sarah  [Change voice ▾]│
├────────────────────────────────────────┤
│ FEMALE VOICES                          │
│ ┌──────────┐ ┌──────────┐              │
│ │ ▶ Sarah ✓│ │ ▶ Laura  │              │
│ │ Warm,    │ │ Bright,  │              │
│ │ friendly │ │ upbeat   │              │
│ └──────────┘ └──────────┘              │
│ ┌──────────┐ ┌──────────┐              │
│ │ ▶ Alice  │ │ ▶ Matilda│              │
│ └──────────┘ └──────────┘              │
│                                        │
│ MALE VOICES (same grid)                │
└────────────────────────────────────────┘
```

- Click play → calls existing `generate-voice-preview` edge function → audio plays "Hi, thanks for calling [Business Name], how can I help?"
- Click card → selects that voice, saves `elevenlabs_voice_id` to `business_settings`
- Selected card has a checkmark + primary border

---

### Part 3: Files changed

1. **New migration** — set defaults on `business_settings.use_elevenlabs_voice` and `elevenlabs_voice_id`.
2. **`src/components/dashboard/settings/VoiceSelector.tsx`** — rewrite to show 8 ElevenLabs voices, use existing `generate-voice-preview` function (which already takes `voiceId` + `businessName`).
3. **`src/components/dashboard/settings/AISettingsTab.tsx`** — minor: pass `businessName` to selector (already done), no other changes needed.
4. **No edge function changes** — `generate-voice-preview` already exists and works.
5. **No onboarding changes** — DB default handles new businesses.

---

### Part 4: What happens to existing businesses

- Their `business_settings` rows already have `use_elevenlabs_voice = false` → unchanged, stays on OpenAI.
- If they want to switch, they open AI Settings → pick an ElevenLabs voice → we'll also flip `use_elevenlabs_voice = true` automatically when they pick one.
- No surprise ElevenLabs billing for businesses that didn't choose it.

---

### Part 5: How clients discover the feature

The voice picker sits inside the existing **AI Settings** card they already use to set assistant name, tone, language. Adding a clear section header "AI Voice — Premium" with a short blurb:

> Choose how your AI assistant sounds. Click any voice to preview it speaking your business greeting, then click the card to select it.

No separate page, no new navigation — it's right where they already configure the assistant.

---

### Out of scope (we can do later if you want)

- Plan tier gating (e.g., only Premium plan gets voice choice)
- Usage/billing dashboard for ElevenLabs character counts
- Voice cloning (uploading their own voice)

