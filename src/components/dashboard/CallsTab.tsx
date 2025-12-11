import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Calendar, ChevronRight, Headphones } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CallDetailsDialog } from "./CallDetailsDialog";

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
  recording_url: string | null;
  transcription: string | null;
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
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleCallClick = (call: CallLog) => {
    setSelectedCall(call);
    setDialogOpen(true);
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
            <div className="space-y-2">
              {calls.map((call) => {
                const displayName = call.caller_name || call.caller_phone;
                const hasRecording = !!call.recording_url;

                return (
                  <div
                    key={call.id}
                    onClick={() => handleCallClick(call)}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{displayName}</p>
                        {hasRecording && (
                          <Headphones className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(call.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={callTypeBadgeVariants[call.call_type] || "outline"} className="hidden sm:flex">
                        {callTypeLabels[call.call_type] || call.call_type}
                      </Badge>
                      {call.needs_review && (
                        <Badge variant="destructive" className="text-xs">
                          Review
                        </Badge>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CallDetailsDialog
        call={selectedCall}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};
