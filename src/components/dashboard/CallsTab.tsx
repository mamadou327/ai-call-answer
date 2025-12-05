import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Clock, User, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface CallsTabProps {
  businessId?: string;
}

interface CallLog {
  id: string;
  caller_name: string | null;
  caller_phone: string;
  call_type: string;
  call_outcome: string | null;
  summary: string | null;
  duration_ms: number | null;
  needs_review: boolean | null;
  tags: string[] | null;
  booking_id: string | null;
  created_at: string;
  provider: string | null;
}

const callTypeLabels: Record<string, string> = {
  new_booking: "Booking Created",
  reschedule: "Reschedule",
  cancel: "Cancellation",
  question: "General Enquiry",
  complaint: "Complaint",
  other: "Other",
};

const callTypeBadgeVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new_booking: "default",
  reschedule: "secondary",
  cancel: "destructive",
  question: "outline",
  complaint: "destructive",
  other: "outline",
};

export const CallsTab = ({ businessId }: CallsTabProps) => {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (businessId) {
      loadCalls();
    }
  }, [businessId]);

  const loadCalls = async () => {
    if (!businessId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("calls_log")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error loading calls:", error);
    } else {
      setCalls(data || []);
    }
    setLoading(false);
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "N/A";
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            {t("dashboard.calls")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading calls...</p>
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">{t("dashboard.noCalls")}</p>
              <p className="text-sm">{t("dashboard.callsDescription")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {calls.map((call) => (
                <div key={call.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold flex items-center gap-2">
                          <User className="w-4 h-4" />
                          {call.caller_name || "Unknown Caller"}
                        </p>
                        <p className="text-sm text-muted-foreground">{call.caller_phone}</p>
                      </div>
                      <Badge variant={callTypeBadgeVariants[call.call_type] || "outline"}>
                        {callTypeLabels[call.call_type] || call.call_type}
                      </Badge>
                    </div>
                    
                    {call.summary && (
                      <p className="text-sm text-muted-foreground mb-2">{call.summary}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(call.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(call.duration_ms)}
                      </span>
                      {call.provider && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {call.provider}
                        </Badge>
                      )}
                      {call.booking_id && (
                        <Badge variant="outline" className="text-xs">
                          Booking updated
                        </Badge>
                      )}
                      {call.needs_review && (
                        <Badge variant="destructive" className="text-xs">
                          Needs Review
                        </Badge>
                      )}
                    </div>
                    
                    {call.tags && call.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {call.tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};