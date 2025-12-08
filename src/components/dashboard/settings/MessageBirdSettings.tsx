import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessageSquare, AlertCircle } from "lucide-react";
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

  useEffect(() => {
    if (business) {
      setSmsOnConfirmation(business.sms_on_confirmation ?? false);
      setSmsOnCancellation(business.sms_on_cancellation ?? false);
      setSmsOnReminder(business.sms_on_reminder ?? false);
    }
  }, [business]);

  const isConfigured = business?.messagebird_enabled && business?.messagebird_phone_number;

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          SMS Notifications (MessageBird)
        </CardTitle>
        <CardDescription>
          Configure SMS notifications for booking updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConfigured ? (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">SMS Not Configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your Aivia administrator to set up SMS notifications for your business.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Status:</Label>
              <Badge variant="default">Enabled</Badge>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium">SMS Notifications</h4>
              <p className="text-xs text-muted-foreground">
                Choose when to send SMS notifications to customers
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
          </>
        )}
      </CardContent>
    </Card>
  );
};
