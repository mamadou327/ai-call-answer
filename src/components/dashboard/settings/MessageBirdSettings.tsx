import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageSquare, AlertCircle, Check, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface MessageBirdSettingsProps {
  business: {
    id: string;
    messagebird_phone_number: string | null;
    messagebird_enabled: boolean | null;
    sms_on_confirmation?: boolean;
    sms_on_cancellation?: boolean;
    sms_on_reminder?: boolean;
  } | null;
  onUpdate?: () => void;
}

export const MessageBirdSettings = ({ business, onUpdate }: MessageBirdSettingsProps) => {
  const { toast } = useToast();
  const [smsOnConfirmation, setSmsOnConfirmation] = useState(false);
  const [smsOnCancellation, setSmsOnCancellation] = useState(false);
  const [smsOnReminder, setSmsOnReminder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    if (business) {
      setSmsOnConfirmation(business.sms_on_confirmation ?? false);
      setSmsOnCancellation(business.sms_on_cancellation ?? false);
      setSmsOnReminder(business.sms_on_reminder ?? false);
      setPhoneNumber(business.messagebird_phone_number ?? "");
      setIsEnabled(business.messagebird_enabled ?? false);
    }
  }, [business]);

  const isConfigured = isEnabled && phoneNumber;

  const handleToggleChange = async (
    field: 'sms_on_confirmation' | 'sms_on_cancellation' | 'sms_on_reminder',
    value: boolean
  ) => {
    if (!business?.id) return;

    // Update local state immediately
    if (field === 'sms_on_confirmation') setSmsOnConfirmation(value);
    if (field === 'sms_on_cancellation') setSmsOnCancellation(value);
    if (field === 'sms_on_reminder') setSmsOnReminder(value);

    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ [field]: value })
        .eq('id', business.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "SMS notification settings updated",
      });
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating SMS settings:', error);
      // Revert on error
      if (field === 'sms_on_confirmation') setSmsOnConfirmation(!value);
      if (field === 'sms_on_cancellation') setSmsOnCancellation(!value);
      if (field === 'sms_on_reminder') setSmsOnReminder(!value);
      toast({
        title: "Error",
        description: "Failed to update SMS settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhoneNumber = async () => {
    if (!business?.id || !phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ 
          messagebird_phone_number: phoneNumber.trim(),
          messagebird_enabled: true 
        })
        .eq('id', business.id);

      if (error) throw error;

      setIsEnabled(true);
      toast({
        title: "Success!",
        description: "MessageBird SMS has been enabled for your business",
      });
      onUpdate?.();
    } catch (error: any) {
      console.error('Error saving MessageBird settings:', error);
      toast({
        title: "Error",
        description: "Failed to save MessageBird settings",
        variant: "destructive",
      });
    } finally {
      setSavingPhone(false);
    }
  };

  const handleDisable = async () => {
    if (!business?.id) return;

    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ messagebird_enabled: false })
        .eq('id', business.id);

      if (error) throw error;

      setIsEnabled(false);
      toast({
        title: "Disabled",
        description: "SMS notifications have been disabled",
      });
      onUpdate?.();
    } catch (error: any) {
      console.error('Error disabling MessageBird:', error);
      toast({
        title: "Error",
        description: "Failed to disable MessageBird",
        variant: "destructive",
      });
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          SMS Notifications (MessageBird)
        </CardTitle>
        <CardDescription>
          Send automated SMS to customers for booking confirmations, cancellations, and reminders
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Status:</Label>
            <Badge variant={isConfigured ? "default" : "secondary"}>
              {isConfigured ? "Enabled" : "Not Configured"}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="messagebird-phone" className="text-sm font-medium">
              MessageBird Phone Number
            </Label>
            <p className="text-xs text-muted-foreground">
              Enter your MessageBird virtual number in international format (e.g., +447123456789)
            </p>
            <div className="flex gap-2">
              <Input
                id="messagebird-phone"
                type="tel"
                placeholder="+447123456789"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="flex-1"
              />
              {!isConfigured ? (
                <Button 
                  onClick={handleSavePhoneNumber} 
                  disabled={savingPhone || !phoneNumber.trim()}
                >
                  {savingPhone ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      Enable
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  onClick={handleDisable} 
                  disabled={savingPhone}
                >
                  {savingPhone ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Disable"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Info box when not configured */}
        {!isConfigured && (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">How to set up MessageBird:</p>
              <ol className="list-decimal list-inside text-xs text-muted-foreground mt-2 space-y-1">
                <li>Sign up at <a href="https://messagebird.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">messagebird.com</a></li>
                <li>Purchase a virtual phone number</li>
                <li>Enter the number above and click Enable</li>
                <li>Toggle on which SMS notifications you want to send</li>
              </ol>
            </div>
          </div>
        )}

        {/* SMS Toggle Options - only shown when configured */}
        {isConfigured && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium">SMS Notification Types</h4>
            <p className="text-xs text-muted-foreground">
              Choose when to automatically send SMS to customers
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sms-confirmation" className="text-sm">
                    Booking Confirmation
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send SMS when a booking is confirmed
                  </p>
                </div>
                <Switch
                  id="sms-confirmation"
                  checked={smsOnConfirmation}
                  onCheckedChange={(checked) => handleToggleChange('sms_on_confirmation', checked)}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sms-cancellation" className="text-sm">
                    Booking Cancellation
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send SMS when a booking is cancelled
                  </p>
                </div>
                <Switch
                  id="sms-cancellation"
                  checked={smsOnCancellation}
                  onCheckedChange={(checked) => handleToggleChange('sms_on_cancellation', checked)}
                  disabled={saving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="sms-reminder" className="text-sm">
                    Booking Reminder
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Send SMS reminder before appointments
                  </p>
                </div>
                <Switch
                  id="sms-reminder"
                  checked={smsOnReminder}
                  onCheckedChange={(checked) => handleToggleChange('sms_on_reminder', checked)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
