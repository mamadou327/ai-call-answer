import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Wallet } from "lucide-react";
import { StripeConnectSettings } from "./StripeConnectSettings";

interface PaymentProvidersSettingsProps {
  business: any;
  onUpdate: () => void;
  currency?: string;
}

export const PaymentProvidersSettings = ({ business, onUpdate }: PaymentProvidersSettingsProps) => {
  const isStripeConnected = !!business?.stripe_account_id;

  return (
    <div className="space-y-6">
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
