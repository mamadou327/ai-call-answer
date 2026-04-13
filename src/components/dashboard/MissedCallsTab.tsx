import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Phone, PhoneMissed, CheckCircle, RefreshCw, Clock } from "lucide-react";

interface MissedCall {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  call_time: string;
  reason: string | null;
  notified: boolean;
  followed_up: boolean;
  followed_up_at: string | null;
  notes: string | null;
}

interface MissedCallsTabProps {
  businessId: string;
}

export function MissedCallsTab({ businessId }: MissedCallsTabProps) {
  const [calls, setCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCalls = async () => {
    const { data, error } = await supabase
      .from("missed_calls")
      .select("*")
      .eq("business_id", businessId)
      .order("call_time", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading missed calls:", error);
    } else {
      setCalls(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCalls();

    const channel = supabase
      .channel("missed-calls-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "missed_calls",
          filter: `business_id=eq.${businessId}`,
        },
        () => loadCalls()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  const markFollowedUp = async (id: string) => {
    const { error } = await supabase
      .from("missed_calls")
      .update({ followed_up: true, followed_up_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } else {
      toast({ title: "Marked as followed up" });
      loadCalls();
    }
  };

  const unfollowedCount = calls.filter(c => !c.followed_up).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <PhoneMissed className="w-5 h-5 text-destructive" />
            Missed Calls
          </h2>
          {unfollowedCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {unfollowedCount} call{unfollowedCount !== 1 ? "s" : ""} need follow-up
            </p>
          )}
        </div>
      </div>

      {calls.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No missed calls — great job!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <Card key={call.id} className={!call.followed_up ? "border-destructive/30" : ""}>
              <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-full ${call.followed_up ? "bg-muted" : "bg-destructive/10"}`}>
                    <PhoneMissed className={`w-4 h-4 ${call.followed_up ? "text-muted-foreground" : "text-destructive"}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {call.caller_name || call.caller_phone}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {call.caller_name && <span>{call.caller_phone}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(call.call_time), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {call.reason && (
                      <span className="text-xs text-muted-foreground capitalize">{call.reason.replace(/_/g, " ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {call.followed_up ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Done
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => markFollowedUp(call.id)}>
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Follow Up Done
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`tel:${call.caller_phone}`}>
                      <Phone className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
