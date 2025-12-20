import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";

interface StripeConnectSettingsProps {
  business: any;
  onUpdate: () => void;
}

export const StripeConnectSettings = ({ business, onUpdate }: StripeConnectSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = !!business?.stripe_account_id;

  const handleConnectStripe = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please log in to connect Stripe",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("stripe-connect-authorize", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start Stripe connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectStripe = async () => {
    if (!confirm("Are you sure you want to disconnect Stripe? This will disable deposit collection for your bookings.")) {
      return;
    }

    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          stripe_account_id: null,
          stripe_connected_at: null,
        })
        .eq("id", business.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stripe has been disconnected",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect Stripe",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <CardTitle>Stripe Payments</CardTitle>
          </div>
          {isConnected ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="w-3 h-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect your Stripe account to collect booking deposits directly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Account ID</span>
                <span className="text-sm font-mono">{business.stripe_account_id}</span>
              </div>
              {business.stripe_connected_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <span className="text-sm">
                    {new Date(business.stripe_connected_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Stripe Dashboard
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnectStripe}
                disabled={disconnecting}
              >
                {disconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Stripe account to enable deposit collection for your services. 
              Payments will go directly to your Stripe account.
            </p>
            <Button onClick={handleConnectStripe} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CreditCard className="w-4 h-4 mr-2" />
              Connect Stripe Account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
