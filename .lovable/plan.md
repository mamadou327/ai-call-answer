

## Plan: Curated 28-voice library

### Step 1 — Review the proposed library

I previewed all 28 voices and analysed each (accent, age, tone). Here's the proposed lineup with display names. **Voice IDs stay hidden from clients** — they only see name, accent, gender, description, and a play button.

#### British Female (5)
| Name | Vibe | Voice ID |
|---|---|---|
| **Olivia** | Warm, friendly British female | `bm3QvaZ3fUSCRBC3UV1f` |
| **Charlotte** | Polished, professional British female | `f1K8uOKtx0TAmtXBiLqx` |
| **Emily** | Clear, friendly British female | `HZJJHUcNj1ROZqPcCmzP` |
| **Poppy** | Sweet, crisp British female | `4BWwbsA70lmV7RMG0Acs` |
| **Florence** | Soft, polite British female | `sIak7pFapfSLCfctxdOu` |
| **Isla** | Friendly, neutral British female | `exsUS4vynmxd379XN4yO` |

#### British Male (6)
| Name | Vibe | Voice ID |
|---|---|---|
| **Oliver** | Friendly, professional British male | `sIivXWc5MTlPIP3kJXhg` |
| **Henry** | Warm, professional British male | `wUwsnXivqGrDWuz1Fc89` |
| **Edward** | Calm, clear British male | `cwo4ramDmreHdb4b1Jxz` |
| **Arthur** | Friendly, informative British male | `5hZv9mAOcmcMt1TxA5Iz` |
| **James** | Friendly, professional British male | `qMeZLxL57iwdz7D3XC3e` |
| **William** | Friendly, clear British male | `9GrXx66oOqWm8wpkCAi2` |

#### American Female (7)
| Name | Vibe | Voice ID |
|---|---|---|
| **Ava** | Friendly, informative American female | `aj0fZfXTBc7E3By4X8L2` |
| **Mia** | Friendly, helpful American female | `l0jEJEG5ZuUd9SnkaVdv` |
| **Zoe** | Friendly, informative American female | `9TwzC887zQyDD4yBthzD` |
| **Ruby** | Bright, cheerful American female | `zxPaDs5RuZh7fQDkY6mP` |
| **Hazel** | Friendly, cheerful American female | `kIYbb5iUo0dJb8oRw5Mt` |
| **Grace** | Friendly, neutral American female | `cYctNG9CmLHHErrIh5s7` |
| **Nora** | Clear, professional American female | `L4so9SudEsIYzE9j4qlR` |
| **Maya** | Pleasant, friendly American female | `wlmwDR77ptH6bKHZui0l` |

#### American Male (6)
| Name | Vibe | Voice ID |
|---|---|---|
| **Mason** | Friendly, informative American male | `tbLKqwAlNrjiwWmLpxI7` |
| **Lucas** | Friendly, helpful American male | `L0Dsvb3SLTyegXwtm47J` |
| **Ethan** | Friendly, neutral American male | `8Qks38ENjPxXSdubdeg8` |
| **Owen** | Friendly, professional American male | `2Qe6CIQY9wj2WB9dT9nY` |
| **Jack** | Friendly, helpful American male | `mlvXFS1MP5qndOFkWz1M` |
| **Theo** | Clear, professional American male | `LEfbhb9oqtzxg1yUjOqk` |

#### Excluded (1)
- `5yPNUy2ZGgvEkNjAmzo1` — flagged as **robotic, low-confidence accent**. Recommend dropping it from the library so clients don't pick something that sounds artificial. You can override and include it if you'd like to hear it yourself first.

**Total: 27 high-quality voices** (12 British, 15 American) split evenly across genders.

### Step 2 — Default flagship voice

I'll need you to pick one as the new default for new businesses (currently George `JBFqnCBsd6RMkjVDRZzb` per your earlier change). My suggestion: **Olivia** (`bm3QvaZ3fUSCRBC3UV1f`) — warm British female, the natural fit for UK salons/restaurants. You can override.

### Step 3 — Build the library

**Database (migration)**
- New `voice_library` table: `id, voice_id, name, accent, gender, description, display_order, is_active, created_at`
- Public read access (anyone can list voices) — no RLS write access needed since this is admin-managed
- Seed all 27 voices with `display_order` (British first)
- Update `business_settings.elevenlabs_voice_id` default to the chosen flagship voice ID

**`src/components/dashboard/settings/VoiceSelector.tsx` rewrite**
- Load voices from `voice_library` table (no hardcoded array)
- Group by **Accent → Gender** (British Female, British Male, American Female, American Male)
- Search bar + accent filter chips ("All / British / American")
- Compact card grid — 2 columns on the 804px viewport
- Voice IDs never rendered in the DOM
- Same play/preview behaviour as today (click play → calls `generate-voice-preview`)
- Selected card highlighted with check badge

**`supabase/functions/generate-voice-preview/index.ts`**
- Upgrade model `eleven_turbo_v2` → `eleven_turbo_v2_5` (better multilingual quality, same speed)

**Live calls** — no changes. Voice ID flows through the existing realtime stack untouched. Every voice automatically supports 30+ languages via your existing language detection.

### Files touched

1. New migration — create `voice_library` table + seed 27 voices + update default voice ID
2. `src/components/dashboard/settings/VoiceSelector.tsx` — DB-driven, search/filter/grouping
3. `supabase/functions/generate-voice-preview/index.ts` — model upgrade

### Before I build — one decision needed

Pick the flagship default voice (the one new businesses get auto-assigned). Reply with a name from the table above, or just say **"Olivia"** to take my recommendation. I'll start building immediately after.

