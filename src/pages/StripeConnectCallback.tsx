import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const StripeConnectCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (errorParam) {
        setStatus("error");
        setError(errorDescription || errorParam);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setError("Missing authorization code or state");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus("error");
          setError("Not authenticated");
          return;
        }

        const { data, error } = await supabase.functions.invoke("stripe-connect-callback", {
          body: { code, state },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStatus("success");
        toast({
          title: "Stripe Connected!",
          description: "Your Stripe account has been connected successfully.",
        });
      } catch (err: any) {
        console.error("Stripe callback error:", err);
        setStatus("error");
        setError(err.message || "Failed to complete Stripe connection");
      }
    };

    handleCallback();
  }, [searchParams, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === "loading" && (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Connecting Stripe...
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="w-6 h-6 text-green-500" />
                Stripe Connected!
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="w-6 h-6 text-destructive" />
                Connection Failed
              </>
            )}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we connect your Stripe account..."}
            {status === "success" && "Your Stripe account has been connected. You can now collect deposits."}
            {status === "error" && error}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status !== "loading" && (
            <Button onClick={() => navigate("/dashboard?section=notifications")}>
              Go to Dashboard
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StripeConnectCallback;
