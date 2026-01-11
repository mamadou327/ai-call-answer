import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle2, Wallet } from "lucide-react";
import { StripeConnectSettings } from "./StripeConnectSettings";

interface PaymentProvidersSettingsProps {
  business: any;
  onUpdate: () => void;
  currency?: string;
}

export const PaymentProvidersSettings = ({ business, onUpdate, currency = "GBP" }: PaymentProvidersSettingsProps) => {
  const isStripeConnected = !!business?.stripe_account_id;

  const getExampleFee = (amount: number) => {
    return (amount * 0.015 + 0.20).toFixed(2);
  };

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
                <div className="text-right">
                  <div className="font-medium">1.5% + 20p</div>
                  <div className="text-xs text-muted-foreground">per transaction</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fee Examples</CardTitle>
          <CardDescription>
            See what fees apply at different deposit amounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Deposit Amount</th>
                  <th className="text-right py-2">Stripe Fee</th>
                  <th className="text-right py-2">You Receive</th>
                </tr>
              </thead>
              <tbody>
                {[10, 20, 30, 50].map((amount) => {
                  const fee = parseFloat(getExampleFee(amount));
                  const received = amount - fee;
                  return (
                    <tr key={amount} className="border-b last:border-0">
                      <td className="py-2">{currency}{amount}</td>
                      <td className="text-right py-2">{currency}{fee.toFixed(2)}</td>
                      <td className="text-right py-2 font-medium">
                        {currency}{received.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Stripe Connection */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Connect Stripe</h3>
        <StripeConnectSettings business={business} onUpdate={onUpdate} />
      </div>
    </div>
  );
};
