import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Copy, Check, AlertCircle, PhoneCall, Bot, Zap } from "lucide-react";
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
  const [copiedStandard, setCopiedStandard] = useState(false);
  const [copiedRealtime, setCopiedRealtime] = useState(false);

  const getStandardWebhookUrl = () => {
    if (!business?.twilio_webhook_token) return "";
    return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook/${business.twilio_webhook_token}`;
  };

  const getRealtimeWebhookUrl = () => {
    if (!business?.twilio_webhook_token) return "";
    return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook-realtime/${business.twilio_webhook_token}`;
  };

  const copyUrl = (url: string, type: 'standard' | 'realtime') => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    if (type === 'standard') {
      setCopiedStandard(true);
      setTimeout(() => setCopiedStandard(false), 2000);
    } else {
      setCopiedRealtime(true);
      setTimeout(() => setCopiedRealtime(false), 2000);
    }
    toast({
      title: "Copied",
      description: `${type === 'realtime' ? 'Realtime' : 'Standard'} webhook URL copied to clipboard`,
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
              <div className="space-y-4">
                {/* Realtime Webhook (Recommended) */}
                <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <Label className="text-sm font-medium text-primary">Realtime Webhook (Recommended)</Label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={getRealtimeWebhookUrl()}
                      readOnly
                      className="bg-muted font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyUrl(getRealtimeWebhookUrl(), 'realtime')}
                    >
                      {copiedRealtime ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <strong>Faster responses (~1-2s)</strong> using OpenAI Realtime API with built-in voices (alloy, coral, ash, etc.)
                  </p>
                </div>

                {/* Standard Webhook */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Standard Webhook (ElevenLabs voices)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={getStandardWebhookUrl()}
                      readOnly
                      className="bg-muted font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyUrl(getStandardWebhookUrl(), 'standard')}
                    >
                      {copiedStandard ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Uses ElevenLabs voices with higher quality but slower response times (~3-5s)
                  </p>
                </div>

                <p className="text-xs text-muted-foreground border-t pt-3">
                  Configure your chosen URL in Twilio's "A call comes in" webhook setting
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};