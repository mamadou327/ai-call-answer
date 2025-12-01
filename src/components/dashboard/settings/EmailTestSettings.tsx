import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const EmailTestSettings = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const { toast } = useToast();

  const handleSendTestEmail = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      console.log("Invoking send-test-email function...");
      
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { to: email },
      });

      console.log("Function response:", { data, error });

      if (error) {
        console.error("Function invocation error:", error);
        setResult({
          success: false,
          message: error.message || "Failed to send test email",
          details: error,
        });
        toast({
          title: "Test email failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log("Test email sent successfully:", data);
        setResult({
          success: true,
          message: data.message || "Test email sent successfully",
          details: data.details,
        });
        toast({
          title: "Test email sent",
          description: `Check ${email} for the test email`,
        });
      }
    } catch (error: any) {
      console.error("Unexpected error:", error);
      setResult({
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
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email System Test
        </CardTitle>
        <CardDescription>
          Send a test email to verify your Resend integration is working correctly.
          Check your backend logs for detailed debugging information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="test-email">Test Email Address</Label>
          <div className="flex gap-2">
            <Input
              id="test-email"
              type="email"
              placeholder="your-email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <Button 
              onClick={handleSendTestEmail} 
              disabled={loading || !email}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Test
                </>
              )}
            </Button>
          </div>
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className="ml-2">
              <div className="font-semibold">{result.message}</div>
              {result.details && (
                <div className="mt-2 text-xs opacity-80">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="pt-4 border-t space-y-2">
          <h4 className="font-semibold text-sm">Debugging Checklist:</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✓ RESEND_API_KEY is set in backend secrets</li>
            <li>✓ RESEND_FROM_EMAIL is set (e.g., noreply@aiviaapp.co.uk)</li>
            <li>✓ Domain aiviaapp.co.uk is verified in Resend</li>
            <li>✓ Check backend logs after clicking "Send Test"</li>
            <li>✓ Check Resend Logs at resend.com/emails</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
