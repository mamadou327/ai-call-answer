import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface MessageBirdSettingsProps {
  business: {
    messagebird_phone_number: string | null;
    messagebird_enabled: boolean | null;
    messagebird_token: string | null;
  } | null;
}

export const MessageBirdSettings = ({ business }: MessageBirdSettingsProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getWebhookUrl = () => {
    if (!business?.messagebird_token) return "";
    return `https://aiviaapp.co.uk/api/messagebird/voice/${business.messagebird_token}`;
  };

  const copyWebhookUrl = () => {
    const url = getWebhookUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard",
    });
  };

  const isConfigured = business?.messagebird_enabled && business?.messagebird_phone_number;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          MessageBird & Voice Calls
        </CardTitle>
        <CardDescription>
          Your MessageBird voice configuration (read-only - contact admin to modify)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConfigured ? (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">MessageBird Not Configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your Aivia administrator to set up MessageBird voice calls for your business.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Status:</Label>
              <Badge variant={business?.messagebird_enabled ? "default" : "secondary"}>
                {business?.messagebird_enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">MessageBird Phone Number</Label>
              <Input
                value={business?.messagebird_phone_number || "Not assigned"}
                readOnly
                className="bg-muted"
              />
            </div>

            {business?.messagebird_token && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Webhook URL (Answer URL)</Label>
                <div className="flex gap-2">
                  <Input
                    value={getWebhookUrl()}
                    readOnly
                    className="bg-muted font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyWebhookUrl}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this URL in MessageBird Flow Builder's "Fetch call flow from URL" step
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};