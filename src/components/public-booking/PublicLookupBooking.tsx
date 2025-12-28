import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Search } from "lucide-react";

interface Booking {
  id: string;
  booking_code: string;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  deposit_amount: number | null;
  notes: string | null;
  service: { id: string; name: string; duration_minutes: number; price: number } | null;
  staff: { id: string; name: string } | null;
  canCancel: boolean;
  canReschedule: boolean;
  hoursUntilBooking: number;
  cancellationNoticeHours: number;
  rescheduleNoticeHours: number;
}

interface PublicLookupBookingProps {
  businessSlug: string;
  mode: "cancel" | "reschedule";
  onBack: () => void;
  onBookingFound: (booking: Booking, currency: string) => void;
}

export const PublicLookupBooking = ({
  businessSlug,
  mode,
  onBack,
  onBookingFound,
}: PublicLookupBookingProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<"code" | "phone">("code");
  const [bookingCode, setBookingCode] = useState("");
  const [phone, setPhone] = useState("");
  const [foundBookings, setFoundBookings] = useState<Booking[]>([]);
  const [currency, setCurrency] = useState("GBP");
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (searchType === "code" && !bookingCode) {
      toast({
        title: "Enter booking code",
        description: "Please enter your booking code to continue.",
        variant: "destructive",
      });
      return;
    }

    if (searchType === "phone" && !phone) {
      toast({
        title: "Enter phone number",
        description: "Please enter your phone number to continue.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-lookup-booking", {
        body: {
          businessSlug,
          bookingCode: searchType === "code" ? bookingCode : undefined,
          customerPhone: searchType === "phone" ? phone : undefined,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Not found",
          description: data.error,
          variant: "destructive",
        });
        setFoundBookings([]);
        return;
      }

      setFoundBookings(data.bookings || []);
      setCurrency(data.currency || "GBP");
    } catch (error: any) {
      toast({
        title: "Search failed",
        description: error.message || "Failed to search for bookings",
        variant: "destructive",
      });
      setFoundBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrencySymbol = (curr: string) => {
    const symbols: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
    return symbols[curr] || "$";
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "cancel" ? "Cancel Your Booking" : "Reschedule Your Booking"}
          </CardTitle>
          <CardDescription>
            Find your booking by entering your booking code or phone number
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "code" | "phone")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code">Booking Code</TabsTrigger>
              <TabsTrigger value="phone">Phone Number</TabsTrigger>
            </TabsList>
            <TabsContent value="code" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="booking-code">Booking Code</Label>
                <Input
                  id="booking-code"
                  placeholder="e.g., EXC-1234"
                  value={bookingCode}
                  onChange={(e) => setBookingCode(e.target.value.toUpperCase())}
                />
                <p className="text-xs text-muted-foreground">
                  You received this code when you made your booking
                </p>
              </div>
            </TabsContent>
            <TabsContent value="phone" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g., 07123 456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the phone number used for your booking
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <Button onClick={handleSearch} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Find Booking
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && foundBookings.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No upcoming bookings found</p>
            <p className="text-sm text-muted-foreground">
              Make sure you entered the correct {searchType === "code" ? "booking code" : "phone number"}
            </p>
          </CardContent>
        </Card>
      )}

      {foundBookings.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">
            {foundBookings.length === 1 ? "Your Booking" : `Found ${foundBookings.length} Bookings`}
          </h3>
          {foundBookings.map((booking) => {
            const canProceed = mode === "cancel" ? booking.canCancel : booking.canReschedule;
            const noticeHours = mode === "cancel" ? booking.cancellationNoticeHours : booking.rescheduleNoticeHours;

            return (
              <Card key={booking.id}>
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="font-semibold">{booking.service?.name || "Service"}</p>
                      {booking.staff && (
                        <p className="text-sm text-muted-foreground">with {booking.staff.name}</p>
                      )}
                      <p className="text-sm mt-2">
                        {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Code: {booking.booking_code}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {canProceed ? (
                        <Button
                          variant={mode === "cancel" ? "destructive" : "default"}
                          onClick={() => onBookingFound(booking, currency)}
                        >
                          {mode === "cancel" ? "Cancel This Booking" : "Reschedule This Booking"}
                        </Button>
                      ) : (
                        <div className="text-center">
                          {booking.hoursUntilBooking < 0 ? (
                            <p className="text-sm text-destructive font-medium">
                              This booking is in the past
                            </p>
                          ) : (
                            <>
                              <p className="text-sm text-destructive font-medium">
                                Cannot {mode} within {noticeHours} hours
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Your booking is in {booking.hoursUntilBooking} hours
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
