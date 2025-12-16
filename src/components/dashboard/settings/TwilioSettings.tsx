import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle, XCircle, Lock, Phone } from "lucide-react";

interface TwilioSettingsProps {
  business: {
    id: string;
    twilio_enabled?: boolean | null;
    twilio_phone_number?: string | null;
    sms_on_confirmation?: boolean;
    sms_on_cancellation?: boolean;
    sms_on_reminder?: boolean;
  } | null;
  onUpdate?: () => void;
}

export const TwilioSettings = ({ business }: TwilioSettingsProps) => {
  const twilioEnabled = business?.twilio_enabled ?? false;
  const twilioNumber = business?.twilio_phone_number || null;
  const smsOnConfirmation = business?.sms_on_confirmation ?? false;
  const smsOnCancellation = business?.sms_on_cancellation ?? false;
  const smsOnReminder = business?.sms_on_reminder ?? false;
  const isAnyEnabled = twilioEnabled && (smsOnConfirmation || smsOnCancellation || smsOnReminder);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          SMS Notifications
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Lock className="w-3 h-3" />
          Managed by Aivia admin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Status:</Label>
          <Badge variant={isAnyEnabled ? "default" : "secondary"}>
            {isAnyEnabled ? "Active" : "Disabled"}
          </Badge>
        </div>

        {isAnyEnabled ? (
          <>
            <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-green-700 dark:text-green-400">SMS notifications enabled</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your customers will receive SMS notifications for booking updates.
                </p>
              </div>
            </div>

            {twilioNumber && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">SMS sent from:</p>
                  <p className="text-sm font-medium">{twilioNumber}</p>
                </div>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-medium">Active Notifications</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Booking Confirmation</span>
                  <Badge variant={smsOnConfirmation ? "default" : "outline"} className="text-xs">
                    {smsOnConfirmation ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Booking Cancellation</span>
                  <Badge variant={smsOnCancellation ? "default" : "outline"} className="text-xs">
                    {smsOnCancellation ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Booking Reminder</span>
                  <Badge variant={smsOnReminder ? "default" : "outline"} className="text-xs">
                    {smsOnReminder ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">SMS notifications not enabled</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact Aivia support to enable SMS notifications for your business.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
