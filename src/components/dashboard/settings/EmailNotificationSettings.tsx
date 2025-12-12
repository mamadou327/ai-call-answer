import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Mail, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmailNotificationSettingsProps {
  business: {
    id: string;
    email_on_confirmation?: boolean;
    email_on_cancellation?: boolean;
    email_on_reminder?: boolean;
  } | null;
  onUpdate?: () => void;
}

export const EmailNotificationSettings = ({ business, onUpdate }: EmailNotificationSettingsProps) => {
  const { toast } = useToast();
  const [emailOnConfirmation, setEmailOnConfirmation] = useState(false);
  const [emailOnCancellation, setEmailOnCancellation] = useState(false);
  const [emailOnReminder, setEmailOnReminder] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (business) {
      setEmailOnConfirmation(business.email_on_confirmation ?? false);
      setEmailOnCancellation(business.email_on_cancellation ?? false);
      setEmailOnReminder(business.email_on_reminder ?? false);
    }
  }, [business]);

  const handleToggleChange = async (
    field: 'email_on_confirmation' | 'email_on_cancellation' | 'email_on_reminder',
    value: boolean
  ) => {
    if (!business?.id) return;

    // Update local state immediately
    if (field === 'email_on_confirmation') setEmailOnConfirmation(value);
    if (field === 'email_on_cancellation') setEmailOnCancellation(value);
    if (field === 'email_on_reminder') setEmailOnReminder(value);

    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ [field]: value })
        .eq('id', business.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Email notification settings updated",
      });
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating email settings:', error);
      // Revert on error
      if (field === 'email_on_confirmation') setEmailOnConfirmation(!value);
      if (field === 'email_on_cancellation') setEmailOnCancellation(!value);
      if (field === 'email_on_reminder') setEmailOnReminder(!value);
      toast({
        title: "Error",
        description: "Failed to update email settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isAnyEnabled = emailOnConfirmation || emailOnCancellation || emailOnReminder;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Send automated emails to customers for booking updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Status:</Label>
          <Badge variant={isAnyEnabled ? "default" : "secondary"}>
            {isAnyEnabled ? "Active" : "Disabled"}
          </Badge>
        </div>

        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Email service configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Emails will be sent from your business name. Customers need an email address on file to receive notifications.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h4 className="text-sm font-medium">Email Notification Types</h4>
          <p className="text-xs text-muted-foreground">
            Choose when to automatically send emails to customers
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-confirmation" className="text-sm">
                  Booking Confirmation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send email when a booking is confirmed
                </p>
              </div>
              <Switch
                id="email-confirmation"
                checked={emailOnConfirmation}
                onCheckedChange={(checked) => handleToggleChange('email_on_confirmation', checked)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-cancellation" className="text-sm">
                  Booking Cancellation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send email when a booking is cancelled
                </p>
              </div>
              <Switch
                id="email-cancellation"
                checked={emailOnCancellation}
                onCheckedChange={(checked) => handleToggleChange('email_on_cancellation', checked)}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="email-reminder" className="text-sm">
                  Booking Reminder
                </Label>
                <p className="text-xs text-muted-foreground">
                  Send email reminder before appointments
                </p>
              </div>
              <Switch
                id="email-reminder"
                checked={emailOnReminder}
                onCheckedChange={(checked) => handleToggleChange('email_on_reminder', checked)}
                disabled={saving}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
