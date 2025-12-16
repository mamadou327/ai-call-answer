import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle, XCircle, Lock } from "lucide-react";

interface EmailNotificationSettingsProps {
  business: {
    id: string;
    email_on_confirmation?: boolean;
    email_on_cancellation?: boolean;
    email_on_reminder?: boolean;
  } | null;
  onUpdate?: () => void;
}

export const EmailNotificationSettings = ({ business }: EmailNotificationSettingsProps) => {
  const emailOnConfirmation = business?.email_on_confirmation ?? false;
  const emailOnCancellation = business?.email_on_cancellation ?? false;
  const emailOnReminder = business?.email_on_reminder ?? false;
  const isAnyEnabled = emailOnConfirmation || emailOnCancellation || emailOnReminder;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Notifications
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
          <div className="flex items-start gap-3 p-4 bg-green-500/10 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">Email notifications enabled</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your customers will receive email notifications for booking updates.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Email notifications not enabled</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact Aivia support to enable email notifications for your business.
              </p>
            </div>
          </div>
        )}

        {isAnyEnabled && (
          <div className="space-y-4 pt-2">
            <h4 className="text-sm font-medium">Active Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Booking Confirmation</span>
                <Badge variant={emailOnConfirmation ? "default" : "outline"} className="text-xs">
                  {emailOnConfirmation ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Booking Cancellation</span>
                <Badge variant={emailOnCancellation ? "default" : "outline"} className="text-xs">
                  {emailOnCancellation ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Booking Reminder</span>
                <Badge variant={emailOnReminder ? "default" : "outline"} className="text-xs">
                  {emailOnReminder ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
