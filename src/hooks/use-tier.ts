import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SubscriptionTier, TIERS } from "@/lib/tiers";

interface TierState {
  tier: SubscriptionTier;
  config: typeof TIERS[SubscriptionTier];
  callsThisMonth: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useTier(businessId: string | null | undefined): TierState {
  const [tier, setTier] = useState<SubscriptionTier>("starter");
  const [callsThisMonth, setCallsThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: settings }, { data: count }] = await Promise.all([
      supabase
        .from("business_settings")
        .select("subscription_tier")
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase.rpc("get_current_month_call_count", { p_business_id: businessId }),
    ]);

    const t = ((settings as any)?.subscription_tier as SubscriptionTier) || "starter";
    setTier(t);
    setCallsThisMonth(typeof count === "number" ? count : 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  return {
    tier,
    config: TIERS[tier],
    callsThisMonth,
    loading,
    refresh: load,
  };
}
