import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  Copy,
  Check,
  Loader2,
  Webhook,
  Settings
} from "lucide-react";

interface BusinessNotificationServicesDialogProps {
  business: {
    id: string;
    business_name: string;
    twilio_enabled: boolean | null;
    twilio_phone_number: string | null;
    twilio_webhook_token: string | null;
    email_on_confirmation: boolean;
    email_on_cancellation: boolean;
    email_on_reminder: boolean;
    sms_on_confirmation: boolean;
    sms_on_cancellation: boolean;
    sms_on_reminder: boolean;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export const BusinessNotificationServicesDialog = ({ 
  business, 
  open, 
  onOpenChange,
  onUpdate 
}: BusinessNotificationServicesDialogProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  
  // SMS Settings
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [twilioNumber, setTwilioNumber] = useState("");
  const [smsOnConfirmation, setSmsOnConfirmation] = useState(false);
  const [smsOnCancellation, setSmsOnCancellation] = useState(false);
  const [smsOnReminder, setSmsOnReminder] = useState(false);
  
  // Email Settings
  const [emailOnConfirmation, setEmailOnConfirmation] = useState(false);
  const [emailOnCancellation, setEmailOnCancellation] = useState(false);
  const [emailOnReminder, setEmailOnReminder] = useState(false);

  useEffect(() => {
    if (business) {
      setSmsEnabled(business.twilio_enabled || false);
      setTwilioNumber(business.twilio_phone_number || "");
      setSmsOnConfirmation(business.sms_on_confirmation || false);
      setSmsOnCancellation(business.sms_on_cancellation || false);
      setSmsOnReminder(business.sms_on_reminder || false);
      setEmailOnConfirmation(business.email_on_confirmation || false);
      setEmailOnCancellation(business.email_on_cancellation || false);
      setEmailOnReminder(business.email_on_reminder || false);
    }
  }, [business]);

  if (!business) return null;

  // Webhook URLs for Twilio
  const projectUrl = "https://zyqzypyncugihrawhppg.supabase.co";
  const voiceWebhookUrl = business.twilio_webhook_token 
    ? `${projectUrl}/functions/v1/twilio-voice-webhook-realtime/${business.twilio_webhook_token}`
    : `${projectUrl}/functions/v1/twilio-voice-webhook-realtime`;
  const smsWebhookUrl = business.twilio_webhook_token
    ? `${projectUrl}/functions/v1/twilio-sms-webhook/${business.twilio_webhook_token}`
    : `${projectUrl}/functions/v1/twilio-sms-webhook`;
  const recordingCallbackUrl = `${projectUrl}/functions/v1/twilio-recording-callback`;

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          twilio_enabled: smsEnabled,
          twilio_phone_number: twilioNumber || null,
          sms_on_confirmation: smsOnConfirmation,
          sms_on_cancellation: smsOnCancellation,
          sms_on_reminder: smsOnReminder,
          email_on_confirmation: emailOnConfirmation,
          email_on_cancellation: emailOnCancellation,
          email_on_reminder: emailOnReminder,
        })
        .eq("id", business.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Notification services updated successfully.",
      });
      
      onUpdate?.();
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const CopyButton = ({ text, label }: { text: string; label: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={() => handleCopy(text, label)}
    >
      {copied === label ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Notification Services - {business.business_name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* SMS Service */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">SMS Notifications (Twilio)</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={smsEnabled}
                    onCheckedChange={setSmsEnabled}
                  />
                  <Badge variant={smsEnabled ? "default" : "secondary"}>
                    {smsEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                Enable SMS notifications for booking confirmations, cancellations, and reminders.
              </CardDescription>
            </CardHeader>
            
            {smsEnabled && (
              <CardContent className="space-y-4">
                {/* Twilio Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="twilioNumber" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Twilio Phone Number
                  </Label>
                  <Input
                    id="twilioNumber"
                    value={twilioNumber}
                    onChange={(e) => setTwilioNumber(e.target.value)}
                    placeholder="+447886082029"
                  />
                  <p className="text-xs text-muted-foreground">
                    This number will be used to send SMS to customers
                  </p>
                </div>

                <Separator />

                {/* SMS Event Toggles */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Send SMS on:</Label>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="smsConfirmation" className="font-normal">
                      Booking Confirmation
                    </Label>
                    <Switch
                      id="smsConfirmation"
                      checked={smsOnConfirmation}
                      onCheckedChange={setSmsOnConfirmation}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="smsCancellation" className="font-normal">
                      Booking Cancellation
                    </Label>
                    <Switch
                      id="smsCancellation"
                      checked={smsOnCancellation}
                      onCheckedChange={setSmsOnCancellation}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="smsReminder" className="font-normal">
                      Booking Reminder
                    </Label>
                    <Switch
                      id="smsReminder"
                      checked={smsOnReminder}
                      onCheckedChange={setSmsOnReminder}
                    />
                  </div>
                </div>

                <Separator />

                {/* Webhook URLs */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Webhook className="w-4 h-4" />
                    Twilio Webhook Configuration
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Voice Webhook URL (for incoming calls)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={voiceWebhookUrl}
                        readOnly
                        className="font-mono text-xs bg-muted"
                      />
                      <CopyButton text={voiceWebhookUrl} label="voice" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">SMS Webhook URL (for incoming SMS)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={smsWebhookUrl}
                        readOnly
                        className="font-mono text-xs bg-muted"
                      />
                      <CopyButton text={smsWebhookUrl} label="sms" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Recording Callback URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={recordingCallbackUrl}
                        readOnly
                        className="font-mono text-xs bg-muted"
                      />
                      <CopyButton text={recordingCallbackUrl} label="recording" />
                    </div>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Configure these URLs in the Twilio console for the phone number above. Set Voice webhook for calls, SMS webhook for messaging.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Email Service */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Email Notifications</CardTitle>
                </div>
                <Badge variant={emailOnConfirmation || emailOnCancellation || emailOnReminder ? "default" : "secondary"}>
                  {emailOnConfirmation || emailOnCancellation || emailOnReminder ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardDescription>
                Enable email notifications for booking events.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <Label className="text-sm font-medium">Send Email on:</Label>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="emailConfirmation" className="font-normal">
                  Booking Confirmation
                </Label>
                <Switch
                  id="emailConfirmation"
                  checked={emailOnConfirmation}
                  onCheckedChange={setEmailOnConfirmation}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="emailCancellation" className="font-normal">
                  Booking Cancellation
                </Label>
                <Switch
                  id="emailCancellation"
                  checked={emailOnCancellation}
                  onCheckedChange={setEmailOnCancellation}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="emailReminder" className="font-normal">
                  Booking Reminder
                </Label>
                <Switch
                  id="emailReminder"
                  checked={emailOnReminder}
                  onCheckedChange={setEmailOnReminder}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
