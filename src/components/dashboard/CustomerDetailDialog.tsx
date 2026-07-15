import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Phone, Mail, Calendar, Clock, Heart, MessageSquare, Scissors, Languages, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  first_visit_date: string;
  total_visits: number;
  how_heard: string | null;
  marketing_consent: boolean | null;
  notes_preferences: string | null;
  preferred_staff_id: string | null;
  preferred_language?: string | null;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  service?: { name: string } | null;
  staff?: { name: string } | null;
}

interface CustomerDetailDialogProps {
  customer: Customer | null;
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CustomerDetailDialog = ({ customer, businessId, open, onOpenChange }: CustomerDetailDialogProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [preferredStaffName, setPreferredStaffName] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<string | null>(null);
  const [resettingLanguage, setResettingLanguage] = useState(false);

  useEffect(() => {
    if (customer && open) {
      loadCustomerBookings();
      setCurrentLanguage(customer.preferred_language ?? null);
      if (customer.preferred_staff_id) {
        loadPreferredStaff();
      }
    }
  }, [customer, open]);

  const resetLanguagePreference = async () => {
    if (!customer) return;
    setResettingLanguage(true);
    const { error } = await supabase
      .from("customers")
      .update({ preferred_language: null })
      .eq("id", customer.id);
    setResettingLanguage(false);
    if (error) {
      toast({ title: "Could not reset language", description: error.message, variant: "destructive" });
      return;
    }
    setCurrentLanguage(null);
    toast({ title: "Language preference reset", description: "This caller will start in the business default language on the next call." });
  };

  const loadCustomerBookings = async () => {
    if (!customer) return;
    setLoadingBookings(true);
    
    const { data } = await supabase
      .from("bookings")
      .select(`
        id,
        start_time,
        end_time,
        status,
        service:service_id(name),
        staff:staff_id(name)
      `)
      .eq("business_id", businessId)
      .eq("customer_phone", customer.phone)
      .order("start_time", { ascending: false })
      .limit(10);
    
    setBookings(data || []);
    setLoadingBookings(false);
  };

  const loadPreferredStaff = async () => {
    if (!customer?.preferred_staff_id) return;
    
    const { data } = await supabase
      .from("staff")
      .select("name")
      .eq("id", customer.preferred_staff_id)
      .single();
    
    if (data) setPreferredStaffName(data.name);
  };

  if (!customer) return null;

  const lastVisit = bookings.length > 0 ? bookings[0] : null;
  const now = new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {customer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.email}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Visit Information</h4>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>First visit: {format(new Date(customer.first_visit_date), "MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>Total visits: {customer.total_visits}</span>
              </div>
              {lastVisit && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Last visit: {format(new Date(lastVisit.start_time), "MMM d, yyyy")}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Preferences & Marketing */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Preferences & Marketing</h4>
            <div className="flex flex-wrap gap-2">
              {customer.marketing_consent && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  Marketing consent given
                </Badge>
              )}
              {customer.how_heard && (
                <Badge variant="secondary">
                  Source: {customer.how_heard}
                </Badge>
              )}
              {preferredStaffName && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Prefers: {preferredStaffName}
                </Badge>
              )}
            </div>
            {customer.notes_preferences && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Notes & Preferences
                </p>
                <p className="text-sm text-muted-foreground">{customer.notes_preferences}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Booking History */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Scissors className="w-4 h-4" />
              Recent Bookings
            </h4>
            {loadingBookings ? (
              <p className="text-sm text-muted-foreground">Loading bookings...</p>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No booking history found</p>
            ) : (
              <div className="space-y-2">
                {bookings.map((booking) => {
                  const bookingDate = new Date(booking.start_time);
                  const isUpcoming = bookingDate > now;
                  const isCancelled = booking.status === "cancelled";
                  
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[50px]">
                          <p className="text-sm font-medium">{format(bookingDate, "MMM d")}</p>
                          <p className="text-xs text-muted-foreground">{format(bookingDate, "h:mm a")}</p>
                        </div>
                        <div>
                          <p className="font-medium">{booking.service?.name || "Service"}</p>
                          {booking.staff && (
                            <p className="text-sm text-muted-foreground">with {booking.staff.name}</p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={
                          isCancelled ? "destructive" :
                          isUpcoming ? "default" : "secondary"
                        }
                      >
                        {isCancelled ? "Cancelled" : isUpcoming ? "Upcoming" : "Completed"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};