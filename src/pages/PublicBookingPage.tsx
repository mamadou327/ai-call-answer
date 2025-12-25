import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MapPin, Phone, Clock, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PublicServiceSelector } from "@/components/public-booking/PublicServiceSelector";
import { PublicStaffSelector } from "@/components/public-booking/PublicStaffSelector";
import { PublicDateTimePicker } from "@/components/public-booking/PublicDateTimePicker";
import { PublicCustomerForm } from "@/components/public-booking/PublicCustomerForm";
import { PublicBookingConfirmation } from "@/components/public-booking/PublicBookingConfirmation";
import { useToast } from "@/hooks/use-toast";

interface Business {
  id: string;
  business_name: string;
  address: string;
  main_phone: string;
  website: string | null;
  online_booking_message: string | null;
  deposit_collection_timing: string;
  stripe_account_id: string | null;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string;
  description: string | null;
  deposit_required: boolean;
  deposit_amount: number | null;
}

interface Staff {
  id: string;
  name: string;
}

type BookingStep = "service" | "staff" | "datetime" | "customer" | "confirmation";

const PublicBookingPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [currency, setCurrency] = useState("GBP");
  const [error, setError] = useState<string | null>(null);

  // Booking state
  const [step, setStep] = useState<BookingStep>("service");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingResult, setBookingResult] = useState<{
    bookingCode: string;
    requiresPayment: boolean;
    paymentUrl?: string;
    depositRequired: boolean;
    depositAmount?: number;
    depositPaymentLink?: string;
  } | null>(null);

  // Check if coming back from successful payment
  useEffect(() => {
    const code = searchParams.get("code");
    const paid = searchParams.get("paid");
    if (code) {
      setStep("confirmation");
      setBookingResult({
        bookingCode: code,
        requiresPayment: false,
        depositRequired: paid === "true",
        depositAmount: 0,
      });
    }
  }, [searchParams]);

  // Fetch business data
  useEffect(() => {
    const fetchBusinessData = async () => {
      if (!slug) return;

      try {
        // Fetch business
        const { data: businessData, error: businessError } = await supabase
          .from("businesses")
          .select(`
            id,
            business_name,
            address,
            main_phone,
            website,
            online_booking_message,
            deposit_collection_timing,
            stripe_account_id
          `)
          .eq("booking_slug", slug)
          .eq("online_booking_enabled", true)
          .eq("status", "approved")
          .single();

        if (businessError || !businessData) {
          setError("This booking page is not available");
          setLoading(false);
          return;
        }

        setBusiness(businessData);

        // Fetch services and settings in parallel
        const [servicesResult, settingsResult] = await Promise.all([
          supabase
            .from("services")
            .select("id, name, duration_minutes, price, category, description, deposit_required, deposit_amount")
            .eq("business_id", businessData.id)
            .order("category", { ascending: true }),
          supabase
            .from("business_settings")
            .select("currency")
            .eq("business_id", businessData.id)
            .single(),
        ]);

        if (servicesResult.data) {
          setServices(servicesResult.data);
        }

        if (settingsResult.data?.currency) {
          setCurrency(settingsResult.data.currency);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching business data:", err);
        setError("Failed to load booking page");
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, [slug]);

  // Fetch available staff when service is selected
  useEffect(() => {
    const fetchStaff = async () => {
      if (!business || !selectedService) return;

      const { data: staffData } = await supabase
        .from("staff")
        .select("id, name")
        .eq("business_id", business.id)
        .eq("ai_enabled", true);

      if (staffData) {
        setStaff(staffData);
      }
    };

    fetchStaff();
  }, [business, selectedService]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedStaff(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep("staff");
  };

  const handleStaffSelect = (staffMember: Staff | null) => {
    setSelectedStaff(staffMember);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep("datetime");
  };

  const handleDateTimeSelect = (date: Date, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
    setStep("customer");
  };

  const handleBookingSubmit = async (customerData: {
    name: string;
    phone: string;
    email?: string;
    notes?: string;
  }) => {
    if (!slug || !selectedService || !selectedDate || !selectedTime) return;

    try {
      // Construct start time
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);

      const { data, error } = await supabase.functions.invoke("public-create-booking", {
        body: {
          businessSlug: slug,
          serviceId: selectedService.id,
          staffId: selectedStaff?.id,
          startTime: startTime.toISOString(),
          customerName: customerData.name,
          customerPhone: customerData.phone,
          customerEmail: customerData.email,
          notes: customerData.notes,
          returnUrl: window.location.origin,
        },
      });

      if (error) throw error;

      if (data.requiresPayment && data.paymentUrl) {
        // Redirect to Stripe payment
        window.location.href = data.paymentUrl;
        return;
      }

      setBookingResult({
        bookingCode: data.bookingCode,
        requiresPayment: false,
        depositRequired: data.depositRequired,
        depositAmount: data.depositAmount,
        depositPaymentLink: data.depositPaymentLink,
      });
      setStep("confirmation");
    } catch (err: any) {
      console.error("Booking error:", err);
      toast({
        title: "Booking failed",
        description: err?.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    switch (step) {
      case "staff":
        setStep("service");
        break;
      case "datetime":
        setStep("staff");
        break;
      case "customer":
        setStep("datetime");
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-2 border-primary shadow-sm">
          <CardHeader className="text-center">
            <CardTitle>Booking Unavailable</CardTitle>
            <CardDescription>
              {error || "This booking page is not available"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-primary bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{business.business_name}</h1>
          <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{business.address}</span>
            </div>
            <div className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              <span>{business.main_phone}</span>
            </div>
            {business.website && (
              <div className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                <a 
                  href={business.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Website
                </a>
              </div>
            )}
          </div>
          {business.online_booking_message && (
            <p className="mt-4 text-muted-foreground">{business.online_booking_message}</p>
          )}
        </div>
      </header>

      {/* Progress indicator */}
      {step !== "confirmation" && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <span className={step === "service" ? "font-bold" : "text-muted-foreground"}>
              1. Service
            </span>
            <span className="text-muted-foreground">→</span>
            <span className={step === "staff" ? "font-bold" : "text-muted-foreground"}>
              2. Staff
            </span>
            <span className="text-muted-foreground">→</span>
            <span className={step === "datetime" ? "font-bold" : "text-muted-foreground"}>
              3. Date & Time
            </span>
            <span className="text-muted-foreground">→</span>
            <span className={step === "customer" ? "font-bold" : "text-muted-foreground"}>
              4. Your Details
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {step === "service" && (
          <PublicServiceSelector
            services={services}
            currency={currency}
            onSelect={handleServiceSelect}
          />
        )}

        {step === "staff" && selectedService && (
          <PublicStaffSelector
            staff={staff}
            selectedService={selectedService}
            currency={currency}
            onSelect={handleStaffSelect}
            onBack={handleBack}
          />
        )}

        {step === "datetime" && selectedService && slug && (
          <PublicDateTimePicker
            businessSlug={slug}
            serviceId={selectedService.id}
            staffId={selectedStaff?.id}
            serviceDuration={selectedService.duration_minutes}
            onSelect={handleDateTimeSelect}
            onBack={handleBack}
          />
        )}

        {step === "customer" && selectedService && selectedDate && selectedTime && (
          <PublicCustomerForm
            selectedService={selectedService}
            selectedStaff={selectedStaff}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            currency={currency}
            collectDuringBooking={business.deposit_collection_timing === "during_booking"}
            hasStripe={!!business.stripe_account_id}
            onSubmit={handleBookingSubmit}
            onBack={handleBack}
          />
        )}

        {step === "confirmation" && bookingResult && (
          <PublicBookingConfirmation
            businessName={business.business_name}
            bookingCode={bookingResult.bookingCode}
            serviceName={selectedService?.name}
            staffName={selectedStaff?.name}
            date={selectedDate}
            time={selectedTime}
            depositRequired={bookingResult.depositRequired}
            depositAmount={bookingResult.depositAmount}
            depositPaymentLink={bookingResult.depositPaymentLink}
            currency={currency}
          />
        )}
      </main>
    </div>
  );
};

export default PublicBookingPage;
