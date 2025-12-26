import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PublicLandingPage } from "@/components/public-booking/PublicLandingPage";
import { PublicServiceSelector } from "@/components/public-booking/PublicServiceSelector";
import { PublicStaffSelector } from "@/components/public-booking/PublicStaffSelector";
import { PublicDateTimePicker } from "@/components/public-booking/PublicDateTimePicker";
import { PublicCustomerForm } from "@/components/public-booking/PublicCustomerForm";
import { PublicBookingConfirmation } from "@/components/public-booking/PublicBookingConfirmation";
import { PublicLookupBooking } from "@/components/public-booking/PublicLookupBooking";
import { PublicCancelBooking } from "@/components/public-booking/PublicCancelBooking";
import { PublicRescheduleBooking } from "@/components/public-booking/PublicRescheduleBooking";
import { PublicGallery } from "@/components/public-booking/PublicGallery";
import { PublicSocialLinks } from "@/components/public-booking/PublicSocialLinks";
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
  logo_url: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_tiktok: string | null;
  social_twitter: string | null;
  social_youtube: string | null;
}

interface PolicySettings {
  minBookingNoticeHours: number | null;
  maxDaysAdvance: number | null;
  minCancellationNoticeHours: number | null;
  minRescheduleNoticeHours: number | null;
  cancellationPolicy: string | null;
}

interface OpeningHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
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

type BookingStep = "landing" | "service" | "staff" | "datetime" | "customer" | "confirmation" | "lookup-cancel" | "cancel" | "lookup-reschedule" | "reschedule" | "gallery";

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
  const [hasGallery, setHasGallery] = useState(false);
  const [policies, setPolicies] = useState<PolicySettings | undefined>(undefined);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);

  const [step, setStep] = useState<BookingStep>("landing");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [bookingResult, setBookingResult] = useState<{
    bookingCode: string;
    requiresPayment: boolean;
    paymentUrl?: string;
    depositRequired: boolean;
    depositAmount?: number;
    depositPaymentLink?: string;
  } | null>(null);

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

  useEffect(() => {
    const fetchBusinessData = async () => {
      if (!slug) return;

      try {
        const { data: businessData, error: businessError } = await supabase
          .from("businesses")
          .select(`
            id, business_name, address, main_phone, website,
            online_booking_message, deposit_collection_timing, stripe_account_id,
            logo_url, social_instagram, social_facebook, social_tiktok, social_twitter, social_youtube
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

        const [servicesResult, settingsResult, galleryResult, hoursResult] = await Promise.all([
          supabase
            .from("services")
            .select("id, name, duration_minutes, price, category, description, deposit_required, deposit_amount")
            .eq("business_id", businessData.id)
            .order("category", { ascending: true }),
          supabase
            .from("business_settings")
            .select("currency, min_booking_notice_hours, max_days_advance, min_cancellation_notice_hours, min_reschedule_notice_hours, cancellation_policy")
            .eq("business_id", businessData.id)
            .single(),
          supabase
            .from("business_gallery")
            .select("id")
            .eq("business_id", businessData.id)
            .limit(1),
          supabase
            .from("opening_hours")
            .select("day_of_week, is_closed, open_time, close_time")
            .eq("business_id", businessData.id)
            .order("day_of_week", { ascending: true }),
        ]);

        if (servicesResult.data) setServices(servicesResult.data);
        if (settingsResult.data?.currency) setCurrency(settingsResult.data.currency);
        if (settingsResult.data) {
          setPolicies({
            minBookingNoticeHours: settingsResult.data.min_booking_notice_hours,
            maxDaysAdvance: settingsResult.data.max_days_advance,
            minCancellationNoticeHours: settingsResult.data.min_cancellation_notice_hours,
            minRescheduleNoticeHours: settingsResult.data.min_reschedule_notice_hours,
            cancellationPolicy: settingsResult.data.cancellation_policy,
          });
        }
        setHasGallery((galleryResult.data?.length || 0) > 0);
        if (hoursResult.data) setOpeningHours(hoursResult.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching business data:", err);
        setError("Failed to load booking page");
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, [slug]);

  useEffect(() => {
    const fetchStaff = async () => {
      if (!business || !selectedService) return;

      // Get staff assigned to this service
      const { data: staffServiceData, error: ssError } = await supabase
        .from("staff_services")
        .select("staff_id")
        .eq("service_id", selectedService.id);

      if (ssError) {
        console.error("Error fetching staff services:", ssError);
        setStaff([]);
        return;
      }

      const assignedStaffIds = (staffServiceData ?? []).map((ss) => ss.staff_id);

      // If no staff are assigned to this service, show none (except No Preference option)
      if (assignedStaffIds.length === 0) {
        setStaff([]);
        return;
      }

      // Fetch staff details for only those assigned to this service
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("id, name")
        .eq("business_id", business.id)
        .in("id", assignedStaffIds)
        .order("name", { ascending: true });

      if (staffError) {
        console.error("Error fetching staff:", staffError);
        setStaff([]);
        return;
      }

      setStaff(staffData ?? []);
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

  const handleBookingSubmit = async (customerData: { name: string; phone: string; email?: string; notes?: string }) => {
    if (!slug || !selectedService || !selectedDate || !selectedTime) return;

    try {
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
      toast({ title: "Booking failed", description: err?.message || "Failed to create booking.", variant: "destructive" });
    }
  };

  const handleBack = () => {
    const backMap: Record<string, BookingStep> = {
      service: "landing",
      staff: "service",
      datetime: "staff",
      customer: "datetime",
      "lookup-cancel": "landing",
      "lookup-reschedule": "landing",
      cancel: "lookup-cancel",
      reschedule: "lookup-reschedule",
      gallery: "landing",
    };
    setStep(backMap[step] || "landing");
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
            <CardDescription>{error || "This booking page is not available"}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-primary bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {business.logo_url && (
                <img src={business.logo_url} alt={business.business_name} className="h-16 w-16 object-contain rounded-lg" />
              )}
              <h1 className="text-2xl font-bold">{business.business_name}</h1>
            </div>
            <PublicSocialLinks socials={{
              instagram: business.social_instagram,
              facebook: business.social_facebook,
              tiktok: business.social_tiktok,
              twitter: business.social_twitter,
              youtube: business.social_youtube,
            }} />
          </div>
        </div>
      </header>

      {!["landing", "confirmation", "lookup-cancel", "lookup-reschedule", "cancel", "reschedule", "gallery"].includes(step) && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            {["service", "staff", "datetime", "customer"].map((s, i) => (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <span className={step === s ? "font-bold" : "text-muted-foreground"}>
                  {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6">
        {step === "landing" && (
          <PublicLandingPage
            businessName={business.business_name}
            businessSlug={slug || ""}
            welcomeMessage={business.online_booking_message}
            address={business.address}
            phone={business.main_phone}
            website={business.website}
            hasGallery={hasGallery}
            policies={policies}
            openingHours={openingHours}
            onMakeBooking={() => setStep("service")}
            onCancelBooking={() => setStep("lookup-cancel")}
            onRescheduleBooking={() => setStep("lookup-reschedule")}
            onViewGallery={() => setStep("gallery")}
          />
        )}
        {step === "service" && <PublicServiceSelector services={services} currency={currency} onSelect={handleServiceSelect} onBack={handleBack} />}
        {step === "staff" && selectedService && <PublicStaffSelector staff={staff} selectedService={selectedService} currency={currency} onSelect={handleStaffSelect} onBack={handleBack} />}
        {step === "datetime" && selectedService && slug && <PublicDateTimePicker businessSlug={slug} serviceId={selectedService.id} staffId={selectedStaff?.id} serviceDuration={selectedService.duration_minutes} onSelect={handleDateTimeSelect} onBack={handleBack} />}
        {step === "customer" && selectedService && selectedDate && selectedTime && <PublicCustomerForm selectedService={selectedService} selectedStaff={selectedStaff} selectedDate={selectedDate} selectedTime={selectedTime} currency={currency} collectDuringBooking={business.deposit_collection_timing === "during_booking"} hasStripe={!!business.stripe_account_id} onSubmit={handleBookingSubmit} onBack={handleBack} />}
        {step === "confirmation" && bookingResult && <PublicBookingConfirmation businessName={business.business_name} bookingCode={bookingResult.bookingCode} serviceName={selectedService?.name} staffName={selectedStaff?.name} date={selectedDate} time={selectedTime} depositRequired={bookingResult.depositRequired} depositAmount={bookingResult.depositAmount} depositPaymentLink={bookingResult.depositPaymentLink} currency={currency} />}
        {step === "lookup-cancel" && slug && <PublicLookupBooking businessSlug={slug} mode="cancel" onBack={handleBack} onBookingFound={(b, c) => { setSelectedBooking(b); setCurrency(c); setStep("cancel"); }} />}
        {step === "cancel" && slug && selectedBooking && <PublicCancelBooking businessSlug={slug} booking={selectedBooking} currency={currency} onBack={handleBack} onSuccess={() => setStep("landing")} />}
        {step === "lookup-reschedule" && slug && <PublicLookupBooking businessSlug={slug} mode="reschedule" onBack={handleBack} onBookingFound={(b, c) => { setSelectedBooking(b); setCurrency(c); setStep("reschedule"); }} />}
        {step === "reschedule" && slug && selectedBooking && <PublicRescheduleBooking businessSlug={slug} booking={selectedBooking} currency={currency} onBack={handleBack} onSuccess={() => setStep("landing")} />}
        {step === "gallery" && <PublicGallery businessId={business.id} onBack={handleBack} />}
      </main>
    </div>
  );
};

export default PublicBookingPage;
