import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Calendar, ChevronRight, Headphones, Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CallDetailsDialog } from "../dashboard/CallDetailsDialog";

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
  business_id: string;
}

interface Business {
  id: string;
  business_name: string;
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

export const AdminCallsTab = () => {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Load businesses
    const { data: businessesData } = await supabase
      .from("businesses")
      .select("id, business_name")
      .eq("status", "approved")
      .order("business_name");
    
    setBusinesses(businessesData || []);

    // Load all calls
    const { data: callsData, error } = await supabase
      .from("calls_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Error loading calls:", error);
    } else {
      setCalls(callsData || []);
    }
    setLoading(false);
  };

  const handleCallClick = (call: CallLog) => {
    setSelectedCall(call);
    setDialogOpen(true);
  };

  const getBusinessName = (businessId: string) => {
    return businesses.find(b => b.id === businessId)?.business_name || "Unknown Business";
  };

  // Filter calls
  const filteredCalls = calls.filter(call => {
    const matchesSearch = searchQuery === "" || 
      call.caller_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.caller_phone.includes(searchQuery) ||
      getBusinessName(call.business_id).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBusiness = selectedBusinessId === "all" || call.business_id === selectedBusinessId;
    
    return matchesSearch && matchesBusiness;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            All Call Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by caller, phone, or business..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Filter by business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Businesses</SelectItem>
                {businesses.map((business) => (
                  <SelectItem key={business.id} value={business.id}>
                    {business.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Loading calls...</p>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Phone className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No calls found</p>
              <p className="text-sm">Call recordings will appear here when calls are made</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCalls.map((call) => {
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
                          <Building2 className="w-3 h-3" />
                          {getBusinessName(call.business_id)}
                        </span>
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
        isAdmin={true}
      />
    </div>
  );
};
