// Subscription tier configuration — single source of truth used across the
// dashboard, billing page, landing pricing section, and edge functions.

export type SubscriptionTier = "starter" | "growth" | "scale" | "enterprise";

// Locked-in default English voice for Starter tier (matches the existing
// project-wide default in business_settings.elevenlabs_voice_id).
export const STARTER_DEFAULT_VOICE_ID = "bm3QvaZ3fUSCRBC3UV1f";

export interface TierConfig {
  id: SubscriptionTier;
  name: string;
  priceLabel: string;
  priceSuffix?: string;
  /** null = unlimited */
  callLimit: number | null;
  /** null = unlimited */
  locationLimit: number | null;
  // Feature flags — keep flat & boolean so gating is dead-simple at call sites.
  multilingual: boolean;
  voiceLibrary: boolean;
  advancedAnalytics: boolean;
  depositCollection: boolean;
  prioritySupport: boolean;
  dedicatedAccountManager: boolean;
  monthlyReview: boolean;
  customAiTraining: boolean;
  bespokeOnboarding: boolean;
  slaGuarantee: boolean;
  customIntegrations: boolean;
  features: string[];
  ctaLabel: string;
  popular?: boolean;
}

export const TIERS: Record<SubscriptionTier, TierConfig> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "£149",
    priceSuffix: "/month",
    callLimit: 300,
    locationLimit: 1,
    multilingual: false,
    voiceLibrary: false,
    advancedAnalytics: false,
    depositCollection: false,
    prioritySupport: false,
    dedicatedAccountManager: false,
    monthlyReview: false,
    customAiTraining: false,
    bespokeOnboarding: false,
    slaGuarantee: false,
    customIntegrations: false,
    features: [
      "300 calls per month",
      "AI receptionist 24/7 (English)",
      "Bookings & reservations",
      "Order management",
      "SMS confirmations",
      "Call logs & transcripts",
      "Basic analytics",
      "Email support",
    ],
    ctaLabel: "Start Free Trial",
  },
  growth: {
    id: "growth",
    name: "Growth",
    priceLabel: "£299",
    priceSuffix: "/month",
    callLimit: 800,
    locationLimit: 2,
    multilingual: true,
    voiceLibrary: true,
    advancedAnalytics: true,
    depositCollection: true,
    prioritySupport: true,
    dedicatedAccountManager: false,
    monthlyReview: false,
    customAiTraining: false,
    bespokeOnboarding: false,
    slaGuarantee: false,
    customIntegrations: false,
    features: [
      "800 calls per month",
      "Everything in Starter",
      "Multilingual call handling",
      "Advanced analytics",
      "Deposit collection",
      "Custom AI voice selection",
      "Up to 2 locations",
      "Priority support",
    ],
    ctaLabel: "Start Free Trial",
    popular: true,
  },
  scale: {
    id: "scale",
    name: "Scale",
    priceLabel: "£499",
    priceSuffix: "/month",
    callLimit: 5000,
    locationLimit: 5,
    multilingual: true,
    voiceLibrary: true,
    advancedAnalytics: true,
    depositCollection: true,
    prioritySupport: true,
    dedicatedAccountManager: true,
    monthlyReview: true,
    customAiTraining: false,
    bespokeOnboarding: false,
    slaGuarantee: false,
    customIntegrations: false,
    features: [
      "5,000 calls per month (high volume)",
      "Everything in Growth",
      "Up to 5 locations",
      "Dedicated account manager",
      "Monthly performance review",
    ],
    ctaLabel: "Start Free Trial",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "Custom",
    callLimit: null,
    locationLimit: null,
    multilingual: true,
    voiceLibrary: true,
    advancedAnalytics: true,
    depositCollection: true,
    prioritySupport: true,
    dedicatedAccountManager: true,
    monthlyReview: true,
    customAiTraining: true,
    bespokeOnboarding: true,
    slaGuarantee: true,
    customIntegrations: true,
    features: [
      "Unlimited calls",
      "Unlimited locations",
      "Everything in Scale",
      "Custom AI training",
      "Bespoke onboarding",
      "SLA guarantee",
      "Direct phone support",
      "Custom integrations",
    ],
    ctaLabel: "Contact Us",
  },
};

export const TIER_ORDER: SubscriptionTier[] = ["starter", "growth", "scale", "enterprise"];

export function tierRank(t: SubscriptionTier): number {
  return TIER_ORDER.indexOf(t);
}

export function tierMeets(current: SubscriptionTier, required: SubscriptionTier): boolean {
  return tierRank(current) >= tierRank(required);
}

/** First tier (in order) that has the given feature flag enabled. */
export function firstTierWith(flag: keyof TierConfig): SubscriptionTier {
  for (const id of TIER_ORDER) {
    if (TIERS[id][flag] === true) return id;
  }
  return "enterprise";
}
