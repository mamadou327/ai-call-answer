import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Copy, RefreshCw, Clock, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface StaffJoinCodeSectionProps {
  businessId: string;
  businessName: string;
}

export const StaffJoinCodeSection = ({ businessId, businessName }: StaffJoinCodeSectionProps) => {
  const { toast } = useToast();
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadJoinCode();
  }, [businessId]);

  const loadJoinCode = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('refresh_staff_join_code_if_expired', { p_business_id: businessId });

      if (error) throw error;

      if (data && data.length > 0) {
        setJoinCode(data[0].join_code);
        setExpiresAt(data[0].expires_at);
      }
    } catch (error) {
      console.error("Error loading join code:", error);
    } finally {
      setLoading(false);
    }
  };

  const regenerateCode = async () => {
    setRegenerating(true);
    try {
      // Generate new code using the database function
      const { data: newCode, error: genError } = await supabase
        .rpc('generate_staff_join_code', { business_name: businessName });

      if (genError) throw genError;

      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // Update the business with the new code
      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          staff_join_code: newCode,
          staff_join_expires_at: newExpiry,
        })
        .eq("id", businessId);

      if (updateError) throw updateError;

      setJoinCode(newCode);
      setExpiresAt(newExpiry);

      toast({
        title: "Code Regenerated",
        description: "A new staff join code has been created. The old code is no longer valid.",
      });
    } catch (error: any) {
      console.error("Error regenerating code:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate join code",
        variant: "destructive",
      });
    } finally {
      setRegenerating(false);
    }
  };

  const copyCode = () => {
    if (joinCode) {
      navigator.clipboard.writeText(joinCode);
      toast({
        title: "Copied!",
        description: "Join code copied to clipboard",
      });
    }
  };

  const copyInviteUrl = () => {
    const url = `https://aiviaapp.co.uk/staff/invite`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied!",
      description: "Invite URL copied to clipboard",
    });
  };

  const getExpiryText = () => {
    if (!expiresAt) return "";
    const expiry = new Date(expiresAt);
    if (expiry < new Date()) {
      return "Expired";
    }
    return `expires ${formatDistanceToNow(expiry, { addSuffix: true })}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse flex items-center gap-4">
            <div className="h-12 w-32 bg-muted rounded"></div>
            <div className="h-4 w-24 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Staff Join Code
        </CardTitle>
        <CardDescription>
          Share this code with new staff members. They can use it at{" "}
          <button onClick={copyInviteUrl} className="text-primary hover:underline font-medium">
            aiviaapp.co.uk/staff/invite
          </button>{" "}
          to request access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-mono font-bold tracking-wider">
                {joinCode || "---"}
              </span>
              <Button variant="ghost" size="icon" onClick={copyCode} title="Copy code">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{getExpiryText()}</span>
            </div>
          </div>
          <Button onClick={regenerateCode} disabled={regenerating} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Code is valid for 24 hours and auto-renews when accessed</p>
          <p>• Regenerating creates a new code; old code stops working for new signups</p>
          <p>• Existing staff are not affected when the code changes</p>
        </div>
      </CardContent>
    </Card>
  );
};