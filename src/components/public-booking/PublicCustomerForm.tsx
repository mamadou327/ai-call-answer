import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, CreditCard, Sparkles, RefreshCw, Calendar, Clock, Plus } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  deposit_required: boolean;
  deposit_amount: number | null;
}

interface Staff {
  id: string;
  name: string;
}

interface RecentBooking {
  id: string;
  booking_code: string;
  start_time: string;
  status: string;
  service: { id: string; name: string; price: number } | null;
  staff: { id: string; name: string } | null;
}

interface PublicCustomerFormProps {
  businessSlug: string;
  selectedService: Service;
  selectedStaff: Staff | null;
  selectedDate: Date;
  selectedTime: string;
  currency: string;
  collectDuringBooking: boolean;
  hasStripe: boolean;
  onSubmit: (data: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
    payDepositNow?: boolean;
  }) => Promise<void>;
  onBack: () => void;
  onExpressRebook?: (serviceId: string, staffId?: string) => void;
  onAddService?: () => void;
  showAddService?: boolean;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

export const PublicCustomerForm = ({
  businessSlug,
  selectedService,
  selectedStaff,
  selectedDate,
  selectedTime,
  currency,
  collectDuringBooking,
  hasStripe,
  onSubmit,
  onBack,
  onExpressRebook,
  onAddService,
  showAddService = false,
}: PublicCustomerFormProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Returning customer state
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [returningCustomer, setReturningCustomer] = useState<{
    name: string;
    email: string | null;
    totalVisits: number;
    preferredStaffName: string | null;
  } | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [customerLookedUp, setCustomerLookedUp] = useState(false);

  const depositRequired = !!(selectedService.deposit_required && selectedService.deposit_amount && selectedService.deposit_amount > 0);
  const canPayOnline = depositRequired && hasStripe;
  const depositNoStripe = depositRequired && !hasStripe;
  // Legacy single-button flow (collect during booking, no choice given) — kept for fallback
  const willPayNow = depositRequired && collectDuringBooking && hasStripe;


  // Lookup customer when phone number changes
  const lookupCustomer = async (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber.length < 8 || customerLookedUp) return;

    setLookingUpCustomer(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-lookup-customer", {
        body: {
          businessSlug,
          phone: phoneNumber,
        },
      });

      if (!error && data?.found) {
        setReturningCustomer(data.customer);
        setRecentBookings(data.recentBookings || []);
        // Pre-fill form fields
        if (data.customer.name && !name) setName(data.customer.name);
        if (data.customer.email && !email) setEmail(data.customer.email);
      }
      setCustomerLookedUp(true);
    } catch (err) {
      console.error("Customer lookup failed:", err);
    } finally {
      setLookingUpCustomer(false);
    }
  };

  const handlePhoneBlur = () => {
    if (phone.length >= 8) {
      lookupCustomer(phone);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = "Please enter your full name";
    }

    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
    } else if (!/^[+\d\s()-]{8,}$/.test(phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitWith = async (payDepositNow?: boolean) => {
    if (!validate()) return;
    if (depositNoStripe) return; // blocked — no Stripe connected
    setLoading(true);
    try {
      await onSubmit({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        payDepositNow,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Default behavior when no Pay Now/Later choice is shown
    await submitWith(willPayNow ? true : undefined);
  };


  const handleExpressRebook = (booking: RecentBooking) => {
    if (onExpressRebook && booking.service) {
      onExpressRebook(booking.service.id, booking.staff?.id);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} className="gap-2" disabled={loading}>
        <ArrowLeft className="h-4 w-4" />
        Back to date & time
      </Button>

      {/* Returning Customer Welcome */}
      {returningCustomer && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg">Welcome back, {returningCustomer.name}!</p>
                <p className="text-sm text-muted-foreground">
                  You've visited us {returningCustomer.totalVisits} time{returningCustomer.totalVisits !== 1 ? "s" : ""}
                  {returningCustomer.preferredStaffName && ` • Preferred: ${returningCustomer.preferredStaffName}`}
                </p>
              </div>
            </div>

            {/* Express Rebooking */}
            {recentBookings.length > 0 && onExpressRebook && (
              <div className="mt-4">
                <p className="text-sm font-medium mb-2">Quick rebook your recent services:</p>
                <div className="space-y-2">
                  {recentBookings.slice(0, 2).map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-2 bg-background rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{booking.service?.name || "Service"}</p>
                          <p className="text-xs text-muted-foreground">
                            {booking.staff?.name && `with ${booking.staff.name} • `}
                            {format(new Date(booking.start_time), "MMM d")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExpressRebook(booking)}
                      >
                        Book Again
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Booking summary */}
        <Card className="border-2 border-primary shadow-sm bg-secondary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Booking Summary</span>
              {showAddService && onAddService && (
                <Button variant="ghost" size="sm" onClick={onAddService} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" />
                  Add Service
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service</span>
              <span className="font-medium">{selectedService.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium">{selectedService.duration_minutes} minutes</span>
            </div>
            {selectedStaff && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staff</span>
                <span className="font-medium">{selectedStaff.name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{selectedTime}</span>
            </div>
            <div className="border-t-2 border-primary pt-3 mt-3">
              <div className="flex justify-between font-bold">
                <span>Total Price</span>
                <span>{formatCurrency(selectedService.price, currency)}</span>
              </div>
              {depositRequired && (
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>Deposit required</span>
                  <span>{formatCurrency(selectedService.deposit_amount!, currency)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer form */}
        <Card className="border-2 border-primary shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Your Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setCustomerLookedUp(false);
                    }}
                    onBlur={handlePhoneBlur}
                    placeholder="+44 7123 456789"
                    className="border-2"
                    disabled={loading}
                  />
                  {lookingUpCustomer && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                  className="border-2"
                  disabled={loading}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="border-2"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests or information..."
                  className="border-2"
                  rows={3}
                  disabled={loading}
                />
              </div>

              {depositNoStripe ? (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
                  This service requires a deposit. Please call us directly to arrange payment before your appointment.
                </div>
              ) : canPayOnline ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={loading}
                    onClick={() => submitWith(true)}
                  >
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <><CreditCard className="h-4 w-4 mr-2" />Pay {formatCurrency(selectedService.deposit_amount!, currency)} Deposit Now</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                    onClick={() => submitWith(false)}
                  >
                    Pay Later — confirm booking and pay {formatCurrency(selectedService.deposit_amount!, currency)} via SMS link
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Pay Now redirects to our secure payment page. Pay Later confirms your booking immediately and sends the payment link by SMS — pay any time before the auto-cancel window closes.
                  </p>
                </div>
              ) : (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              )}

            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
