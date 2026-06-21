import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Lock, Mail, ArrowDown } from "lucide-react";
import { TIERS, TIER_ORDER, SubscriptionTier, tierRank } from "@/lib/tiers";
import { useTier } from "@/hooks/use-tier";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BillingSettingsProps {
  businessId: string;
  businessName?: string;
}

const formatNextReset = () => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toLocaleDateString(undefined, {
    day: "numeric", month: "long", year: "numeric",
  });
};

export const BillingSettings = ({ businessId, businessName }: BillingSettingsProps) => {
  const { tier, config, callsThisMonth, loading } = useTier(businessId);
  const { toast } = useToast();
  const [requesting, setRequesting] = useState<SubscriptionTier | null>(null);

  const requestChange = async (target: SubscriptionTier, kind: "upgrade" | "downgrade") => {
    setRequesting(target);
    try {
      const { error } = await supabase.functions.invoke("send-upgrade-request", {
        body: {
          businessId,
          businessName,
          requestedTier: target,
          changeKind: kind,
        },
      });
      if (error) throw error;
      toast({
        title:
          target === "enterprise"
            ? "Enquiry sent"
            : kind === "downgrade"
            ? "Downgrade request sent"
            : "Upgrade request sent",
        description:
          target === "enterprise"
            ? "Our team will be in touch about Enterprise."
            : kind === "downgrade"
            ? `We'll be in touch about moving you down to ${TIERS[target].name}.`
            : `We'll be in touch about moving you to ${TIERS[target].name}.`,
      });
    } catch (e: any) {
      toast({
        title: "Could not send",
        description: e?.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading billing details…
        </CardContent>
      </Card>
    );
  }

  const limit = config.callLimit;
  const isUnlimited = limit === null;
  const pct = isUnlimited ? 0 : Math.min(100, (callsThisMonth / (limit || 1)) * 100);

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <CardTitle>Current plan</CardTitle>
            </div>
            <Badge variant="secondary" className="text-base px-3 py-1">
              {config.name}
            </Badge>
          </div>
          <CardDescription>
            {isUnlimited
              ? "Unlimited calls — no monthly cap."
              : `Resets on ${formatNextReset()}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isUnlimited ? (
            <p className="text-sm text-muted-foreground">
              You're on Enterprise — usage is uncapped. <strong>{callsThisMonth}</strong> calls so far this month.
            </p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2 text-sm">
                <span>Calls this month</span>
                <span className="font-medium">
                  {callsThisMonth.toLocaleString()} / {limit!.toLocaleString()}
                </span>
              </div>
              <Progress value={pct} />
              {pct >= 100 ? (
                <p className="text-sm text-destructive mt-2">
                  You've reached your monthly limit. Aivia will not answer new calls until your plan resets or you upgrade.
                </p>
              ) : pct >= 90 ? (
                <p className="text-sm text-destructive mt-2">
                  Only {(limit! - callsThisMonth).toLocaleString()} calls remaining — upgrade now to avoid interruption.
                </p>
              ) : pct >= 75 ? (
                <p className="text-sm text-amber-600 mt-2">
                  You're approaching your monthly limit. Consider upgrading.
                </p>
              ) : null}
            </div>
          )}

          <div>
            <h4 className="text-sm font-medium mb-2">Included on your plan</h4>
            <ul className="space-y-1.5">
              {config.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Plan change options */}
      <div className="grid gap-4 md:grid-cols-2">
        {TIER_ORDER.filter((t) => t !== tier).map((targetTier) => {
          const t = TIERS[targetTier];
          const isEnterprise = targetTier === "enterprise";
          const isDowngrade = tierRank(targetTier) < tierRank(tier);
          const kind: "upgrade" | "downgrade" = isDowngrade ? "downgrade" : "upgrade";
          return (
            <Card key={targetTier} className={`border-2 ${isDowngrade ? "border-muted" : ""}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {t.name}
                    {isDowngrade && (
                      <Badge variant="outline" className="text-xs">Downgrade</Badge>
                    )}
                  </CardTitle>
                  <span className="font-semibold">
                    {t.priceLabel}
                    {t.priceSuffix && <span className="text-sm text-muted-foreground">{t.priceSuffix}</span>}
                  </span>
                </div>
                <CardDescription>
                  {isEnterprise
                    ? "Unlimited calls, custom AI training, SLA & more."
                    : `${t.callLimit?.toLocaleString()} calls/month`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 mb-4">
                  {t.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => requestChange(targetTier, kind)}
                  disabled={requesting === targetTier}
                  className="w-full"
                  variant={isEnterprise ? "outline" : isDowngrade ? "secondary" : "default"}
                >
                  {isEnterprise ? (
                    <Mail className="w-4 h-4 mr-2" />
                  ) : isDowngrade ? (
                    <ArrowDown className="w-4 h-4 mr-2" />
                  ) : (
                    <Crown className="w-4 h-4 mr-2" />
                  )}
                  {requesting === targetTier
                    ? "Sending…"
                    : isEnterprise
                    ? "Contact us"
                    : isDowngrade
                    ? `Request downgrade to ${t.name}`
                    : `Upgrade to ${t.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>


      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Plan changes are processed manually by the Aivia team. We'll reach out shortly after your request.
      </p>
    </div>
  );
};
