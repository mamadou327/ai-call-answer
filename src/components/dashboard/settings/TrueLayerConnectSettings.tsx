import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Landmark, CheckCircle2, XCircle, ExternalLink, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TrueLayerConnectSettingsProps {
  business: any;
  onUpdate: () => void;
}

export const TrueLayerConnectSettings = ({ business, onUpdate }: TrueLayerConnectSettingsProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  const isConnected = !!business?.truelayer_client_id && !!business?.truelayer_connected_at;

  const handleConnect = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast({
        title: "Error",
        description: "Please enter both Client ID and Client Secret",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please log in to connect TrueLayer",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("truelayer-connect", {
        body: {
          action: "connect",
          businessId: business.id,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: "TrueLayer Open Banking connected successfully",
      });

      setClientId("");
      setClientSecret("");
      setShowForm(false);
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to connect TrueLayer",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect TrueLayer? This will disable Open Banking payments for your bookings.")) {
      return;
    }

    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "Please log in",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke("truelayer-connect", {
        body: {
          action: "disconnect",
          businessId: business.id,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success",
        description: "TrueLayer has been disconnected",
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect TrueLayer",
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
            <Landmark className="w-5 h-5 text-primary" />
            <CardTitle>TrueLayer Open Banking</CardTitle>
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
          Accept bank payments directly with the lowest fees (0.5%)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-green-500/10 border-green-500/20">
          <Info className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-700">
            <strong>Lowest fees!</strong> Open Banking charges only 0.5% vs Stripe's 1.5% + 20p. 
            Perfect for deposit payments.
          </AlertDescription>
        </Alert>

        {isConnected ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Client ID</span>
                <span className="text-sm font-mono">
                  {business.truelayer_client_id?.substring(0, 20)}...
                </span>
              </div>
              {business.truelayer_connected_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Connected</span>
                  <span className="text-sm">
                    {new Date(business.truelayer_connected_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => window.open("https://console.truelayer.com", "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                TrueLayer Console
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!showForm ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Connect your TrueLayer account to accept instant bank payments with the lowest fees. 
                  Customers pay directly from their bank - no cards needed.
                </p>
                <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Fee Comparison</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Stripe:</span>{" "}
                      <span className="font-medium">1.5% + 20p</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">TrueLayer:</span>{" "}
                      <span className="font-medium text-green-600">0.5%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    On a £20 deposit: Stripe = £0.50 vs TrueLayer = £0.10 (save 80%)
                  </p>
                </div>
                <Button onClick={() => setShowForm(true)}>
                  <Landmark className="w-4 h-4 mr-2" />
                  Connect TrueLayer
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    placeholder="Enter your TrueLayer Client ID"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    placeholder="Enter your TrueLayer Client Secret"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Get your credentials from the{" "}
                  <a 
                    href="https://console.truelayer.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    TrueLayer Console
                  </a>
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleConnect} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Connect
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowForm(false);
                      setClientId("");
                      setClientSecret("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
