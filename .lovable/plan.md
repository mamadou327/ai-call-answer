# Finish the tier system rollout

Two pieces from the original tier-system spec are still outstanding. This plan closes them.

## 1. Rebuild the landing page pricing section

**File:** `src/components/landing/PricingSection.tsx` (full rewrite)

Replace the old 3-tier placeholder ("Starter / Pro / Business — Custom Pricing") with the real 4-tier structure. Source of truth is `src/lib/tiers.ts` — read `TIER_ORDER` + `TIERS` and render one card per tier, so we never have to maintain pricing in two places again.

Per-card content (driven by `TierConfig`):
- Tier name (`name`)
- Price (`priceLabel` + `priceSuffix`, e.g. "£149 /month"; Enterprise shows just "Custom")
- Feature list (`features[]` with green check icons — keep current visual style)
- "Most Popular" ribbon when `popular === true` (Growth)
- CTA button:
  - Starter / Growth / Scale → "Start Free Trial" → routes to `/auth` (signup)
  - Enterprise → "Contact Us" → opens existing `ContactDialog`

Keep the existing section heading, container, and `ContactDialog` mount. Grid becomes `md:grid-cols-2 lg:grid-cols-4` so all four tiers fit on desktop and stack cleanly on tablet/mobile (current viewport 1113px → 4 columns work, but tighten card padding so feature lists don't overflow).

## 2. Gate tier-restricted dashboard features

Wrap the two Growth+ features so Starter users see a `LockedFeatureCard` instead of the real control. Both gates live in `src/components/dashboard/SettingsTab.tsx` so the gating logic stays in one place; the underlying components are not modified.

**Voice Selector (AI tab)** — `voiceLibrary` flag, requires Growth
- The voice selector is rendered inside `AISettingsTab`. Rather than thread tier props through it, we'll gate at the source: edit `src/components/dashboard/settings/AISettingsTab.tsx` to call `useTier(businessId)` and, if `tier === "starter"`, render `<LockedFeatureCard featureName="Custom AI Voice" description="Choose from our full ElevenLabs voice library. Starter uses our default English voice." requiredTier="growth" businessId={businessId} businessName={...} />` in place of the `<VoiceSelector />` block. All other AI settings (assistant name, tone, language, etc.) stay available.

**Deposit Settings (Policies tab)** — `depositCollection` flag, requires Growth
- In `SettingsTab.tsx`, the Policies tab currently renders `<DepositSettings ... />` directly under `<PoliciesTab />`. Pull the tier check up: call `useTier(businessId)` once in `SettingsTab`, and conditionally render either `<DepositSettings />` (Growth+) or `<LockedFeatureCard featureName="Deposit Collection" description="Take deposits at booking via Stripe to reduce no-shows." requiredTier="growth" businessId={businessId} businessName={business?.business_name} />`.

Use `tierMeets(tier, "growth")` from `src/lib/tiers.ts` for the comparison so the check is centralised and works correctly for Scale/Enterprise too.

## Out of scope (deliberate)

- No DB changes. `subscription_tier` enum, `get_current_month_call_count` RPC, and `call_usage_notifications` table are already live.
- No edge function changes. `check-call-usage`, `send-upgrade-request`, and `twilio-media-stream` gating are already deployed.
- No changes to `BillingSettings`, `useTier`, `LockedFeatureCard`, or `tiers.ts`.
- Multilingual gating already happens server-side in `twilio-media-stream` (Starter forced to English) — no UI changes needed for that.

## Files that will change

- `src/components/landing/PricingSection.tsx` — full rewrite, data-driven from `tiers.ts`
- `src/components/dashboard/SettingsTab.tsx` — add `useTier` + gate `DepositSettings`
- `src/components/dashboard/settings/AISettingsTab.tsx` — add `useTier` + gate `VoiceSelector`

After this lands, every tier-system requirement from the original prompt is complete.
