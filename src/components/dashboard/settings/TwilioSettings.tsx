import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Copy, Check, AlertCircle, PhoneCall, Bot } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface TwilioSettingsProps {
  business: {
    twilio_phone_number: string | null;
    twilio_enabled: boolean | null;
    twilio_webhook_token: string | null;
    aivia_active: boolean | null;
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
  const isFullyActive = isConfigured && business?.aivia_active;

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
            {/* AI Receptionist Status Banner */}
            {isFullyActive ? (
              <div className="flex items-start gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <Bot className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-primary">AI Receptionist Active</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your Aivia AI receptionist is handling calls on this number. Callers can book appointments, 
                    ask questions, and manage their bookings through natural conversation.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <PhoneCall className="w-5 h-5 text-warning mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning">Aivia Not Active</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Twilio is enabled but Aivia is not active. Enable Aivia to start handling calls with AI.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Status:</Label>
              <Badge variant={business?.twilio_enabled ? "default" : "secondary"}>
                {business?.twilio_enabled ? "Enabled" : "Disabled"}
              </Badge>
              {business?.aivia_active && (
                <Badge variant="outline" className="border-primary text-primary">
                  AI Active
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Twilio Phone Number</Label>
              <Input
                value={business?.twilio_phone_number || "Not assigned"}
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Callers to this number will speak with your Aivia AI receptionist
              </p>
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
                  Configure this URL in Twilio's "A call comes in" webhook setting
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};