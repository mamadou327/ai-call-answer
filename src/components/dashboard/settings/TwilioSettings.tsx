import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Phone, AlertCircle, PhoneCall, Bot, Loader2, CheckCircle, MessageSquare, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TwilioSettingsProps {
  business: {
    id: string;
    twilio_phone_number: string | null;
    twilio_enabled: boolean | null;
    twilio_webhook_token: string | null;
    aivia_active: boolean | null;
  } | null;
  onUpdate?: () => void;
}

export const TwilioSettings = ({ business, onUpdate }: TwilioSettingsProps) => {
  const [phoneNumber, setPhoneNumber] = useState(business?.twilio_phone_number || "");
  const [testPhone, setTestPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [smsResult, setSmsResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const { toast } = useToast();

  const isConfigured = business?.twilio_enabled && business?.twilio_phone_number;
  const isFullyActive = isConfigured && business?.aivia_active;

  const handleSavePhoneNumber = async () => {
    if (!business?.id) return;
    
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ 
          twilio_phone_number: phoneNumber || null,
          twilio_enabled: !!phoneNumber 
        })
        .eq('id', business.id);

      if (error) throw error;

      toast({
        title: "Phone number saved",
        description: phoneNumber 
          ? "Your Twilio phone number has been updated" 
          : "Twilio phone number removed",
      });
      onUpdate?.();
    } catch (error: any) {
      console.error("Error saving phone number:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save phone number",
        variant: "destructive",
      });
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSendTestSms = async () => {
    if (!testPhone || !business?.id) {
      toast({
        title: "Phone number required",
        description: "Please enter a phone number to send the test SMS to",
        variant: "destructive",
      });
      return;
    }

    if (!business?.twilio_phone_number) {
      toast({
        title: "Twilio number not set",
        description: "Please save your Twilio phone number first",
        variant: "destructive",
      });
      return;
    }

    setSendingSms(true);
    setSmsResult(null);

    try {
      console.log("Invoking send-test-sms-twilio function...");
      
      const { data, error } = await supabase.functions.invoke("send-test-sms-twilio", {
        body: { 
          to: testPhone,
          business_id: business.id 
        },
      });

      console.log("Function response:", { data, error });

      if (error) {
        console.error("Function invocation error:", error);
        setSmsResult({
          success: false,
          message: error.message || "Failed to send test SMS",
          details: error,
        });
        toast({
          title: "Test SMS failed",
          description: error.message,
          variant: "destructive",
        });
      } else if (data?.error) {
        setSmsResult({
          success: false,
          message: data.error,
          details: data.details,
        });
        toast({
          title: "Test SMS failed",
          description: data.error,
          variant: "destructive",
        });
      } else {
        setSmsResult({
          success: true,
          message: "Test SMS sent successfully",
          details: data,
        });
        toast({
          title: "Test SMS sent",
          description: `Check ${testPhone} for the test message`,
        });
      }
    } catch (error: any) {
      console.error("Unexpected error:", error);
      setSmsResult({
        success: false,
        message: error.message || "Unexpected error occurred",
        details: error,
      });
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Twilio & Voice Calls
        </CardTitle>
        <CardDescription>
          Configure your Twilio phone number for voice calls and SMS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
        ) : isConfigured ? (
          <div className="flex items-start gap-3 p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <PhoneCall className="w-5 h-5 text-warning mt-0.5" />
            <div>
              <p className="text-sm font-medium text-warning">Aivia Not Active</p>
              <p className="text-xs text-muted-foreground mt-1">
                Twilio is enabled but Aivia is not active. Enable Aivia to start handling calls with AI.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Twilio Not Configured</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add your Twilio phone number below to enable voice calls and SMS for your business.
              </p>
            </div>
          </div>
        )}

        {/* Status Badge */}
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

        {/* Phone Number Input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Twilio Phone Number</Label>
          <div className="flex gap-2">
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+447886082029"
              className="flex-1"
            />
            <Button 
              onClick={handleSavePhoneNumber} 
              disabled={savingPhone || phoneNumber === (business?.twilio_phone_number || "")}
            >
              {savingPhone ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            This number will be used for incoming calls and outgoing SMS. Make sure it's SMS-enabled in Twilio.
          </p>
        </div>

        {/* SMS Test Section */}
        {business?.twilio_phone_number && (
          <div className="pt-4 border-t space-y-4">
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Test SMS
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Send a test SMS to verify your Twilio integration is working
              </p>
            </div>
            
            <div className="flex gap-2">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Enter phone number to receive test SMS"
                disabled={sendingSms}
              />
              <Button 
                onClick={handleSendTestSms} 
                disabled={sendingSms || !testPhone}
              >
                {sendingSms ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Send Test
                  </>
                )}
              </Button>
            </div>

            {smsResult && (
              <Alert variant={smsResult.success ? "default" : "destructive"}>
                {smsResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription className="ml-2">
                  <div className="font-semibold">{smsResult.message}</div>
                  {smsResult.details && (
                    <div className="mt-2 text-xs opacity-80">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(smsResult.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
