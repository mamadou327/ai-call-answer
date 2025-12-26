import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Landmark, CheckCircle2, Loader2, Wallet } from "lucide-react";
import { StripeConnectSettings } from "./StripeConnectSettings";
import { TrueLayerConnectSettings } from "./TrueLayerConnectSettings";

interface PaymentProvidersSettingsProps {
  business: any;
  onUpdate: () => void;
  currency?: string;
}

type PaymentProvider = "stripe" | "truelayer" | "sumup";

export const PaymentProvidersSettings = ({ business, onUpdate, currency = "GBP" }: PaymentProvidersSettingsProps) => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const currentProvider = business?.preferred_payment_provider || "stripe";
  
  const isStripeConnected = !!business?.stripe_account_id;
  const isTrueLayerConnected = !!business?.truelayer_client_id && !!business?.truelayer_connected_at;

  const handleProviderChange = async (provider: PaymentProvider) => {
    // Check if the provider is connected before allowing selection
    if (provider === "stripe" && !isStripeConnected) {
      toast({
        title: "Connect Stripe First",
        description: "Please connect your Stripe account before selecting it as your preferred provider",
        variant: "destructive",
      });
      return;
    }

    if (provider === "truelayer" && !isTrueLayerConnected) {
      toast({
        title: "Connect TrueLayer First",
        description: "Please connect your TrueLayer account before selecting it as your preferred provider",
        variant: "destructive",
      });
      return;
    }

    if (provider === "sumup") {
      toast({
        title: "Coming Soon",
        description: "SumUp integration is coming soon!",
      });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({ preferred_payment_provider: provider } as any)
        .eq("id", business.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${provider === "stripe" ? "Stripe" : "TrueLayer"} is now your preferred payment provider`,
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update payment provider",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getFeeDisplay = (provider: PaymentProvider) => {
    switch (provider) {
      case "stripe":
        return "1.5% + 20p";
      case "truelayer":
        return "0.5%";
      case "sumup":
        return "1.69%";
      default:
        return "";
    }
  };

  const getExampleFee = (provider: PaymentProvider, amount: number) => {
    switch (provider) {
      case "stripe":
        return (amount * 0.015 + 0.20).toFixed(2);
      case "truelayer":
        return (amount * 0.005).toFixed(2);
      case "sumup":
        return (amount * 0.0169).toFixed(2);
      default:
        return "0.00";
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Preferred Payment Provider
          </CardTitle>
          <CardDescription>
            Choose which payment provider to use for collecting deposits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={currentProvider} 
            onValueChange={(value) => handleProviderChange(value as PaymentProvider)}
            className="space-y-4"
            disabled={updating}
          >
            {/* Stripe Option */}
            <div className={`flex items-center space-x-4 p-4 rounded-lg border transition-colors ${
              currentProvider === "stripe" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
            }`}>
              <RadioGroupItem value="stripe" id="stripe" disabled={!isStripeConnected} />
              <Label 
                htmlFor="stripe" 
                className={`flex-1 cursor-pointer ${!isStripeConnected ? "opacity-50" : ""}`}
              >
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
                    <div className="font-medium">{getFeeDisplay("stripe")}</div>
                    <div className="text-xs text-muted-foreground">
                      {currency} {getExampleFee("stripe", 20)} on {currency}20
                    </div>
                  </div>
                </div>
              </Label>
            </div>

            {/* TrueLayer Option */}
            <div className={`flex items-center space-x-4 p-4 rounded-lg border transition-colors ${
              currentProvider === "truelayer" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
            }`}>
              <RadioGroupItem value="truelayer" id="truelayer" disabled={!isTrueLayerConnected} />
              <Label 
                htmlFor="truelayer" 
                className={`flex-1 cursor-pointer ${!isTrueLayerConnected ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Landmark className="w-5 h-5 text-[#00BCD4]" />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        TrueLayer Open Banking
                        <Badge className="bg-green-600 text-white">Lowest Fees</Badge>
                        {isTrueLayerConnected && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Direct bank payments, instant settlement
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-green-600">{getFeeDisplay("truelayer")}</div>
                    <div className="text-xs text-muted-foreground">
                      {currency} {getExampleFee("truelayer", 20)} on {currency}20
                    </div>
                  </div>
                </div>
              </Label>
            </div>

            {/* SumUp Option (Coming Soon) */}
            <div className="flex items-center space-x-4 p-4 rounded-lg border border-border opacity-50">
              <RadioGroupItem value="sumup" id="sumup" disabled />
              <Label htmlFor="sumup" className="flex-1 cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="w-5 h-5" />
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        SumUp
                        <Badge variant="secondary">Coming Soon</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Card payments with competitive rates
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{getFeeDisplay("sumup")}</div>
                    <div className="text-xs text-muted-foreground">
                      {currency} {getExampleFee("sumup", 20)} on {currency}20
                    </div>
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>

          {updating && (
            <div className="flex items-center gap-2 mt-4 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Updating preference...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fee Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fee Comparison</CardTitle>
          <CardDescription>
            See how much you save with different payment providers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Deposit</th>
                  <th className="text-right py-2">Stripe</th>
                  <th className="text-right py-2">TrueLayer</th>
                  <th className="text-right py-2">Savings</th>
                </tr>
              </thead>
              <tbody>
                {[10, 20, 30, 50].map((amount) => {
                  const stripeFee = parseFloat(getExampleFee("stripe", amount));
                  const truelayerFee = parseFloat(getExampleFee("truelayer", amount));
                  const savings = stripeFee - truelayerFee;
                  return (
                    <tr key={amount} className="border-b last:border-0">
                      <td className="py-2">{currency}{amount}</td>
                      <td className="text-right py-2">{currency}{stripeFee.toFixed(2)}</td>
                      <td className="text-right py-2 text-green-600 font-medium">
                        {currency}{truelayerFee.toFixed(2)}
                      </td>
                      <td className="text-right py-2 text-green-600">
                        Save {currency}{savings.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Provider Connection Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Connect Payment Providers</h3>
        <StripeConnectSettings business={business} onUpdate={onUpdate} />
        <TrueLayerConnectSettings business={business} onUpdate={onUpdate} />
      </div>
    </div>
  );
};
