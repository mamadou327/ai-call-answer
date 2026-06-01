import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Wallet, AlertTriangle } from "lucide-react";
import { StripeConnectSettings } from "./StripeConnectSettings";
import { supabase } from "@/integrations/supabase/client";

interface PaymentProvidersSettingsProps {
  business: any;
  onUpdate: () => void;
  currency?: string;
}

export const PaymentProvidersSettings = ({ business, onUpdate }: PaymentProvidersSettingsProps) => {
  const isStripeConnected = !!business?.stripe_account_id;
  const [hasDepositServices, setHasDepositServices] = useState(false);

  useEffect(() => {
    if (!business?.id || isStripeConnected) return;
    (async () => {
      const { count } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("deposit_required", true)
        .gt("deposit_amount", 0);
      setHasDepositServices((count ?? 0) > 0);
    })();
  }, [business?.id, isStripeConnected]);

  return (
    <div className="space-y-6">
      {!isStripeConnected && hasDepositServices && (
        <div className="flex gap-3 p-4 rounded-lg border border-warning/40 bg-warning/10">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Stripe not connected</p>
            <p className="text-muted-foreground">
              You have services that require a deposit but Stripe is not connected. Connect Stripe to collect deposits automatically.
            </p>
          </div>
        </div>
      )}

      {/* Stripe Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Payment Provider
          </CardTitle>
          <CardDescription>
            Stripe is used for collecting deposits from your customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center space-x-4 p-4 rounded-lg border ${
            isStripeConnected ? "border-primary bg-primary/5" : "border-border"
          }`}>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-[#635BFF]" />
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      Stripe
                      {isStripeConnected && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Card payments, Apple Pay, Google Pay
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Connection */}
      <StripeConnectSettings business={business} onUpdate={onUpdate} />
    </div>
  );
};
