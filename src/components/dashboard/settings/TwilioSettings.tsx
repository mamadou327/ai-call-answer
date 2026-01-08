import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, CheckCircle, XCircle, Lock, Phone, Send, Loader2, Clock, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export const TwilioSettings = ({ business, onUpdate }: TwilioSettingsProps) => {
  const { toast } = useToast();
  const [requesting, setRequesting] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reminderHours, setReminderHours] = useState<number>(3);
  const [savingReminder, setSavingReminder] = useState(false);

  const twilioEnabled = business?.twilio_enabled ?? false;
  const twilioNumber = business?.twilio_phone_number || null;
  const smsOnConfirmation = business?.sms_on_confirmation ?? false;
  const smsOnCancellation = business?.sms_on_cancellation ?? false;
  const smsOnReminder = business?.sms_on_reminder ?? false;
  const isAnyEnabled = twilioEnabled && (smsOnConfirmation || smsOnCancellation || smsOnReminder);

  useEffect(() => {
    if (business?.id) {
      checkPendingRequest();
      loadReminderHours();
    }
  }, [business?.id]);

  const loadReminderHours = async () => {
    if (!business?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("business_settings")
        .select("sms_reminder_hours")
        .eq("business_id", business.id)
        .maybeSingle();

      if (!error && data?.sms_reminder_hours) {
        setReminderHours(Number(data.sms_reminder_hours));
      }
    } catch (error) {
      console.error("Error loading reminder hours:", error);
    }
  };

  const checkPendingRequest = async () => {
    if (!business?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("business_id", business.id)
        .eq("request_type", "sms")
        .eq("status", "pending")
        .maybeSingle();

      if (error) throw error;
      setPendingRequest(data);
    } catch (error) {
      console.error("Error checking pending request:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReminderHours = async () => {
    if (!business?.id) return;

    setSavingReminder(true);
    try {
      const { error } = await supabase
        .from("business_settings")
        .upsert({
          business_id: business.id,
          sms_reminder_hours: reminderHours,
        }, {
          onConflict: "business_id",
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: `SMS reminders will be sent ${reminderHours} hour${reminderHours !== 1 ? 's' : ''} before appointments.`,
      });

      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving reminder hours:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSavingReminder(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!business?.id) return;

    setRequesting(true);
    try {
      const { data: newRequest, error } = await supabase
        .from("service_requests")
        .insert({
          business_id: business.id,
          request_type: "sms",
          message: "Requesting SMS notification service to send booking confirmations, cancellations, and reminders to customers.",
        })
        .select()
        .single();

      if (error) throw error;

      // Send admin notification email
      try {
        const { data: businessData } = await supabase
          .from("businesses")
          .select("business_name, main_phone")
          .eq("id", business.id)
          .single();

        await supabase.functions.invoke("send-admin-notification", {
          body: {
            signupType: "sms_request",
            businessName: businessData?.business_name || "Unknown Business",
            businessPhone: businessData?.main_phone || "Not provided",
            requestType: "SMS Notifications",
          },
        });
      } catch (emailError) {
        console.error("Error sending admin notification:", emailError);
        // Don't fail the request if email fails
      }

      toast({
        title: "Request submitted",
        description: "Your SMS access request has been sent to Aivia admin for review.",
      });

      checkPendingRequest();
    } catch (error: any) {
      console.error("Error submitting request:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit request",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

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
                
                {smsOnReminder && (
                  <div className="pt-4 border-t space-y-3">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Reminder Time
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      How many hours before the appointment should customers receive their reminder SMS?
                    </p>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={48}
                        value={reminderHours}
                        onChange={(e) => setReminderHours(Math.max(1, Math.min(48, parseInt(e.target.value) || 3)))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">hours before</span>
                      <Button 
                        size="sm" 
                        onClick={handleSaveReminderHours}
                        disabled={savingReminder}
                      >
                        {savingReminder ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
              <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">SMS notifications not enabled</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Request access to send SMS notifications to your customers for booking confirmations, cancellations, and reminders.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : pendingRequest ? (
              <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-700 dark:text-yellow-400">Request pending</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your SMS access request is being reviewed by Aivia admin. You'll be notified once it's approved.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted: {new Date(pendingRequest.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <Button onClick={handleRequestAccess} disabled={requesting} className="w-full">
                {requesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Request SMS Access
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
