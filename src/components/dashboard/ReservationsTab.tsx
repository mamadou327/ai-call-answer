import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, isToday, isTomorrow, startOfDay, addDays } from "date-fns";
import { Search, Users, Clock, Phone, CheckCircle, XCircle, RefreshCw, CalendarDays, Plus, Armchair } from "lucide-react";
import { DEMO_RESERVATIONS } from "@/lib/demoData";

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  party_size: number;
  reservation_time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  special_requests: string | null;
  table_id: string | null;
  created_at: string;
  seated_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  table?: { table_number: string; capacity: number } | null;
}

interface Table {
  id: string;
  table_number: string;
  capacity: number;
  location: string | null;
}

interface ReservationsTabProps {
  businessId: string;
  isDemoMode?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  confirmed: { label: "Confirmed", color: "bg-blue-500", icon: <CalendarDays className="w-4 h-4" /> },
  seated: { label: "Seated", color: "bg-green-500", icon: <Armchair className="w-4 h-4" /> },
  completed: { label: "Completed", color: "bg-muted", icon: <CheckCircle className="w-4 h-4" /> },
  no_show: { label: "No Show", color: "bg-yellow-500", icon: <XCircle className="w-4 h-4" /> },
  cancelled: { label: "Cancelled", color: "bg-destructive", icon: <XCircle className="w-4 h-4" /> },
};

export function ReservationsTab({ businessId, isDemoMode = false }: ReservationsTabProps) {
  const [reservations, setReservations] = useState<Reservation[]>(isDemoMode ? DEMO_RESERVATIONS as Reservation[] : []);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(!isDemoMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newReservation, setNewReservation] = useState({
    customer_name: "",
    customer_phone: "",
    party_size: 2,
    reservation_date: format(new Date(), "yyyy-MM-dd"),
    reservation_time: "19:00",
    duration_minutes: 90,
    table_id: "",
    notes: "",
    special_requests: "",
  });
  const { toast } = useToast();

  const loadData = async () => {
    // Load tables
    const { data: tablesData } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .order("table_number");
    
    setTables(tablesData || []);

    // Build date filter
    let startDate: Date;
    let endDate: Date;

    if (dateFilter === "today") {
      startDate = startOfDay(new Date());
      endDate = addDays(startDate, 1);
    } else if (dateFilter === "tomorrow") {
      startDate = startOfDay(addDays(new Date(), 1));
      endDate = addDays(startDate, 1);
    } else if (dateFilter === "week") {
      startDate = startOfDay(new Date());
      endDate = addDays(startDate, 7);
    } else {
      startDate = startOfDay(new Date());
      endDate = addDays(startDate, 30);
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("*, table:restaurant_tables(table_number, capacity)")
      .eq("business_id", businessId)
      .gte("reservation_time", startDate.toISOString())
      .lt("reservation_time", endDate.toISOString())
      .order("reservation_time", { ascending: true });

    if (error) {
      console.error("Error loading reservations:", error);
    } else {
      setReservations((data || []) as unknown as Reservation[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isDemoMode) return; // Skip data loading in demo mode
    loadData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("reservations-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reservations",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, dateFilter]);

  const updateReservationStatus = async (reservationId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "seated") {
      updates.seated_at = new Date().toISOString();
    } else if (newStatus === "completed") {
      updates.completed_at = new Date().toISOString();
    } else if (newStatus === "cancelled") {
      updates.cancelled_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("reservations")
      .update(updates)
      .eq("id", reservationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update reservation",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reservation Updated",
        description: `Reservation marked as ${newStatus}`,
      });
      setSelectedReservation(null);
      loadData();
    }
  };

  const createReservation = async () => {
    const reservationDateTime = new Date(
      `${newReservation.reservation_date}T${newReservation.reservation_time}`
    );

    const { error } = await supabase.from("reservations").insert({
      business_id: businessId,
      customer_name: newReservation.customer_name,
      customer_phone: newReservation.customer_phone || null,
      party_size: newReservation.party_size,
      reservation_time: reservationDateTime.toISOString(),
      duration_minutes: newReservation.duration_minutes,
      table_id: newReservation.table_id || null,
      notes: newReservation.notes || null,
      special_requests: newReservation.special_requests || null,
      status: "confirmed",
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create reservation",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Reservation Created",
        description: `Reservation for ${newReservation.customer_name} confirmed`,
      });
      setShowNewDialog(false);
      setNewReservation({
        customer_name: "",
        customer_phone: "",
        party_size: 2,
        reservation_date: format(new Date(), "yyyy-MM-dd"),
        reservation_time: "19:00",
        duration_minutes: 90,
        table_id: "",
        notes: "",
        special_requests: "",
      });
      loadData();
    }
  };

  const filteredReservations = reservations.filter((reservation) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      reservation.customer_name.toLowerCase().includes(query) ||
      reservation.customer_phone?.includes(query)
    );
  });

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

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
        <h2 className="text-xl font-semibold">Reservations</h2>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reservations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>
      </div>

      {filteredReservations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No reservations found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {filteredReservations.map((reservation) => {
            const config = statusConfig[reservation.status] || statusConfig.confirmed;
            const resTime = new Date(reservation.reservation_time);

            return (
              <Card
                key={reservation.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedReservation(reservation)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {format(resTime, "h:mm a")}
                    </CardTitle>
                    <Badge className={`${config.color} text-white gap-1`}>
                      {config.icon}
                      {config.label}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateLabel(reservation.reservation_time)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="font-medium">{reservation.customer_name}</div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {reservation.party_size} guests
                    </span>
                    {reservation.table && (
                      <span className="flex items-center gap-1">
                        <Armchair className="w-3 h-3" />
                        Table {reservation.table.table_number}
                      </span>
                    )}
                  </div>
                  {reservation.customer_phone && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {reservation.customer_phone}
                    </div>
                  )}

                  {reservation.status === "confirmed" && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateReservationStatus(reservation.id, "seated");
                      }}
                    >
                      Seat Guests
                    </Button>
                  )}
                  {reservation.status === "seated" && (
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateReservationStatus(reservation.id, "completed");
                      }}
                    >
                      Complete
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reservation Details Dialog */}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Date & Time</div>
                  <div className="font-medium">
                    {format(new Date(selectedReservation.reservation_time), "EEE, MMM d")}
                  </div>
                  <div>{format(new Date(selectedReservation.reservation_time), "h:mm a")}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Party Size</div>
                  <div className="font-medium">{selectedReservation.party_size} guests</div>
                </div>
              </div>

              {selectedReservation.table && (
                <div>
                  <div className="text-sm text-muted-foreground">Table</div>
                  <div className="font-medium">
                    Table {selectedReservation.table.table_number} (seats {selectedReservation.table.capacity})
                  </div>
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
                {selectedReservation.status === "confirmed" && (
                  <>
                    <Button
                      className="flex-1"
                      onClick={() => updateReservationStatus(selectedReservation.id, "seated")}
                    >
                      Seat Guests
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updateReservationStatus(selectedReservation.id, "no_show")}
                    >
                      No Show
                    </Button>
                  </>
                )}
                {selectedReservation.status === "seated" && (
                  <Button
                    className="flex-1"
                    onClick={() => updateReservationStatus(selectedReservation.id, "completed")}
                  >
                    Complete
                  </Button>
                )}
                {selectedReservation.status !== "cancelled" && selectedReservation.status !== "completed" && (
                  <Button
                    variant="destructive"
                    onClick={() => updateReservationStatus(selectedReservation.id, "cancelled")}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Reservation Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input
                value={newReservation.customer_name}
                onChange={(e) => setNewReservation({ ...newReservation, customer_name: e.target.value })}
                placeholder="Guest name"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={newReservation.customer_phone}
                onChange={(e) => setNewReservation({ ...newReservation, customer_phone: e.target.value })}
                placeholder="+44..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newReservation.reservation_date}
                  onChange={(e) => setNewReservation({ ...newReservation, reservation_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input
                  type="time"
                  value={newReservation.reservation_time}
                  onChange={(e) => setNewReservation({ ...newReservation, reservation_time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Party Size *</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newReservation.party_size}
                  onChange={(e) => setNewReservation({ ...newReservation, party_size: parseInt(e.target.value) || 2 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Table</Label>
                <Select
                  value={newReservation.table_id || "none"}
                  onValueChange={(value) => setNewReservation({ ...newReservation, table_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-assign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Auto-assign</SelectItem>
                    {tables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        Table {table.table_number} ({table.capacity} seats)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Special Requests</Label>
              <Textarea
                value={newReservation.special_requests}
                onChange={(e) => setNewReservation({ ...newReservation, special_requests: e.target.value })}
                placeholder="Allergies, celebrations, etc."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newReservation.notes}
                onChange={(e) => setNewReservation({ ...newReservation, notes: e.target.value })}
                placeholder="Internal notes"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createReservation} disabled={!newReservation.customer_name}>
              Create Reservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
