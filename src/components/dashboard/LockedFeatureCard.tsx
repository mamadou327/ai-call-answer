import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { SubscriptionTier, TIERS } from "@/lib/tiers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface LockedFeatureCardProps {
  featureName: string;
  description?: string;
  requiredTier: SubscriptionTier;
  businessId: string;
  businessName?: string;
}

export const LockedFeatureCard = ({
  featureName,
  description,
  requiredTier,
  businessId,
  businessName,
}: LockedFeatureCardProps) => {
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);
  const tierName = TIERS[requiredTier].name;

  const requestUpgrade = async () => {
    setRequesting(true);
    try {
      const { error } = await supabase.functions.invoke("send-upgrade-request", {
        body: {
          businessId,
          businessName,
          requestedTier: requiredTier,
          featureName,
        },
      });
      if (error) throw error;
      toast({
        title: "Upgrade request sent",
        description: `We'll be in touch shortly to move you to ${tierName}.`,
      });
    } catch (e: any) {
      toast({
        title: "Could not send request",
        description: e?.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-base">{featureName}</CardTitle>
        </div>
        <CardDescription>
          {description || `Available on ${tierName} and above.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={requestUpgrade} disabled={requesting}>
          {requesting ? "Sending…" : `Upgrade to ${tierName}`}
        </Button>
      </CardContent>
    </Card>
  );
};
