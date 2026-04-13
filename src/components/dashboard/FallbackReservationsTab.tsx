import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Users, Clock, Phone, CheckCircle, AlertCircle, RefreshCw, CalendarDays, ExternalLink } from "lucide-react";

interface FallbackReservation {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  party_size: number;
  reservation_time: string;
  duration_minutes: number | null;
  special_requests: string | null;
  allergen_info: string | null;
  notes: string | null;
  status: string;
  notified_at: string | null;
  entered_at: string | null;
  created_at: string;
}

interface FallbackReservationsTabProps {
  businessId: string;
  reservationPlatform?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending Entry", color: "bg-yellow-500" },
  entered: { label: "Entered in System", color: "bg-blue-500" },
  confirmed: { label: "Confirmed", color: "bg-green-500" },
  cancelled: { label: "Cancelled", color: "bg-destructive" },
};

const platformLabels: Record<string, string> = {
  opentable: "OpenTable",
  sevenrooms: "SevenRooms",
  resy: "Resy",
  tock: "Tock",
  other: "your reservation system",
};

export function FallbackReservationsTab({ businessId, reservationPlatform = "other" }: FallbackReservationsTabProps) {
  const [reservations, setReservations] = useState<FallbackReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<FallbackReservation | null>(null);
  const { toast } = useToast();

  const platformName = platformLabels[reservationPlatform] || "your reservation system";

  const loadReservations = async () => {
    const { data, error } = await supabase
      .from("fallback_reservations")
      .select("*")
      .eq("business_id", businessId)
      .order("reservation_time", { ascending: true });

    if (error) {
      console.error("Error loading fallback reservations:", error);
    } else {
      setReservations(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReservations();

    const channel = supabase
      .channel("fallback-reservations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fallback_reservations",
          filter: `business_id=eq.${businessId}`,
        },
        () => loadReservations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  const updateStatus = async (id: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "entered") updates.entered_at = new Date().toISOString();

    const { error } = await supabase
      .from("fallback_reservations")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `Reservation marked as ${newStatus}` });
      setSelectedReservation(null);
      loadReservations();
    }
  };

  const filteredReservations = reservations.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return r.customer_name.toLowerCase().includes(query) || r.customer_phone?.includes(query);
  });

  const pendingCount = reservations.filter(r => r.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Fallback Reservations</h2>
          <p className="text-sm text-muted-foreground">
            Reservations captured by AIVIA — please enter them into {platformName}
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
          <p className="text-sm">
            <strong>{pendingCount}</strong> reservation{pendingCount !== 1 ? "s" : ""} need to be entered into {platformName}
          </p>
        </div>
      )}

      {filteredReservations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No fallback reservations</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReservations.map((reservation) => {
            const config = statusConfig[reservation.status] || statusConfig.pending;
            const resTime = new Date(reservation.reservation_time);

            return (
              <Card
                key={reservation.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${reservation.status === "pending" ? "border-yellow-500/50" : ""}`}
                onClick={() => setSelectedReservation(reservation)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{format(resTime, "EEE, MMM d · h:mm a")}</CardTitle>
                    <Badge className={`${config.color} text-white`}>{config.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="font-medium">{reservation.customer_name}</div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {reservation.party_size} guests
                    </span>
                  </div>
                  {reservation.customer_phone && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {reservation.customer_phone}
                    </div>
                  )}
                  {reservation.status === "pending" && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatus(reservation.id, "entered");
                      }}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark as Entered
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={() => setSelectedReservation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${statusConfig[selectedReservation.status]?.color} text-white`}>
                  {statusConfig[selectedReservation.status]?.label}
                </Badge>
              </div>

              <div>
                <div className="font-medium text-lg">{selectedReservation.customer_name}</div>
                {selectedReservation.customer_phone && (
                  <div className="text-sm text-muted-foreground">{selectedReservation.customer_phone}</div>
                )}
                {selectedReservation.customer_email && (
                  <div className="text-sm text-muted-foreground">{selectedReservation.customer_email}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Date & Time</div>
                  <div className="font-medium">{format(new Date(selectedReservation.reservation_time), "EEE, MMM d")}</div>
                  <div>{format(new Date(selectedReservation.reservation_time), "h:mm a")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Party Size</div>
                  <div className="font-medium">{selectedReservation.party_size} guests</div>
                </div>
              </div>

              {selectedReservation.allergen_info && (
                <div className="bg-destructive/10 border border-destructive/30 p-3 rounded-md text-sm">
                  <span className="font-medium text-destructive">⚠️ Allergens: </span>
                  {selectedReservation.allergen_info}
                </div>
              )}

              {selectedReservation.special_requests && (
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  <span className="font-medium">Special Requests: </span>
                  {selectedReservation.special_requests}
                </div>
              )}

              {selectedReservation.notes && (
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  <span className="font-medium">Notes: </span>
                  {selectedReservation.notes}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {selectedReservation.status === "pending" && (
                  <Button className="flex-1" onClick={() => updateStatus(selectedReservation.id, "entered")}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Mark as Entered
                  </Button>
                )}
                {selectedReservation.status === "entered" && (
                  <Button className="flex-1" onClick={() => updateStatus(selectedReservation.id, "confirmed")}>
                    Confirm
                  </Button>
                )}
                {selectedReservation.status !== "cancelled" && selectedReservation.status !== "confirmed" && (
                  <Button variant="destructive" onClick={() => updateStatus(selectedReservation.id, "cancelled")}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
