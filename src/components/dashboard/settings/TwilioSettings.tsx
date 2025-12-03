import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Copy, Check, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TwilioSettingsProps {
  business: {
    twilio_phone_number: string | null;
    twilio_enabled: boolean | null;
    twilio_webhook_token: string | null;
  } | null;
}

const SUPABASE_PROJECT_ID = "zyqzypyncugihrawhppg";

export const TwilioSettings = ({ business }: TwilioSettingsProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const getWebhookUrl = () => {
    if (!business?.twilio_webhook_token) return "";
    return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook/${business.twilio_webhook_token}`;
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

  const isConfigured = business?.twilio_enabled && business?.twilio_phone_number;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Twilio & Voice Calls
        </CardTitle>
        <CardDescription>
          Your Twilio voice configuration (read-only - contact admin to modify)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConfigured ? (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Twilio Not Configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your Aivia administrator to set up Twilio voice calls for your business.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Status:</Label>
              <Badge variant={business?.twilio_enabled ? "default" : "secondary"}>
                {business?.twilio_enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Twilio Phone Number</Label>
              <Input
                value={business?.twilio_phone_number || "Not assigned"}
                readOnly
                className="bg-muted"
              />
            </div>

            {business?.twilio_webhook_token && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Webhook URL</Label>
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
                  This URL is configured in Twilio to handle incoming calls
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
