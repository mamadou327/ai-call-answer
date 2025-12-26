import { useState, useEffect, useRef } from "react";
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
import { PublicBookingCart, CartItem } from "@/components/public-booking/PublicBookingCart";
import { PublicMiniCart } from "@/components/public-booking/PublicMiniCart";
import { PublicGroupTypeSelector } from "@/components/public-booking/PublicGroupTypeSelector";
import { PublicGroupCustomerForm } from "@/components/public-booking/PublicGroupCustomerForm";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

type BookingStep = "landing" | "service" | "staff" | "datetime" | "group-type" | "customer" | "group-customer" | "confirmation" | "lookup-cancel" | "cancel" | "lookup-reschedule" | "reschedule" | "gallery";

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
  
  // Group booking cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentCartItemId, setCurrentCartItemId] = useState<string | null>(null);
  const [groupBookingMode, setGroupBookingMode] = useState<"single" | "multiple" | null>(null);
  const [groupPersonCount, setGroupPersonCount] = useState(1);
  
  const [bookingResult, setBookingResult] = useState<{
    bookingCode: string;
    requiresPayment: boolean;
    paymentUrl?: string;
    depositRequired: boolean;
    depositAmount?: number;
    depositPaymentLink?: string;
    totalDeposit?: number;
    groupBookings?: Array<{
      bookingCode: string;
      serviceName: string;
      staffName: string | null;
      startTime: string;
      endTime: string;
      depositRequired?: boolean;
      depositAmount?: number | null;
    }>;
  } | null>(null);

  useEffect(() => {
    const fetchBookingsFromPayment = async () => {
      const singleCode = searchParams.get("code");
      const multipleCodes = searchParams.get("codes");
      const paid = searchParams.get("paid");
      
      if (!singleCode && !multipleCodes) return;
      
      // Parse booking codes (handle both single and multiple)
      const bookingCodes = multipleCodes 
        ? multipleCodes.split(",").filter(Boolean)
        : singleCode ? [singleCode] : [];
      
      if (bookingCodes.length === 0) return;
      
      // Fetch all booking details from database
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(`
          booking_code,
          start_time,
          end_time,
          customer_name,
          services:service_id (name, deposit_required, deposit_amount),
          staff:staff_id (name)
        `)
        .in("booking_code", bookingCodes);
      
      if (error || !bookings || bookings.length === 0) {
        // Fallback to showing just the codes
        setStep("confirmation");
        setBookingResult({
          bookingCode: bookingCodes[0],
          requiresPayment: false,
          depositRequired: paid === "true",
          depositAmount: 0,
          groupBookings: bookingCodes.length > 1 ? bookingCodes.map(code => ({
            bookingCode: code,
            serviceName: "Service",
            staffName: null,
            startTime: "",
            endTime: "",
          })) : undefined,
        });
        return;
      }
      
      // Build full booking result with all details
      setStep("confirmation");
      setBookingResult({
        bookingCode: bookings[0].booking_code,
        requiresPayment: false,
        depositRequired: paid === "true",
        depositAmount: 0,
        groupBookings: bookings.length > 1 ? bookings.map(b => ({
          bookingCode: b.booking_code,
          serviceName: (b.services as any)?.name || "Service",
          staffName: (b.staff as any)?.name || null,
          startTime: b.start_time,
          endTime: b.end_time,
          depositRequired: (b.services as any)?.deposit_required,
          depositAmount: (b.services as any)?.deposit_amount,
        })) : undefined,
      });
    };
    
    fetchBookingsFromPayment();
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

      if (assignedStaffIds.length === 0) {
        setStaff([]);
        return;
      }

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

  const handleAddToCart = (service: Service) => {
    const newItem: CartItem = {
      id: crypto.randomUUID(),
      service: {
        id: service.id,
        name: service.name,
        price: service.price,
        duration_minutes: service.duration_minutes,
        deposit_required: service.deposit_required,
        deposit_amount: service.deposit_amount,
      },
      staff: null,
      date: null,
      time: null,
    };
    setCartItems((prev) => [...prev, newItem]);
    setCurrentCartItemId(newItem.id);
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
    
    // If we have a current cart item, update it and stay on service selection
    if (currentCartItemId) {
      setCartItems((prev) =>
        prev.map((item) =>
          item.id === currentCartItemId
            ? { ...item, staff: selectedStaff, date, time }
            : item
        )
      );
      setCurrentCartItemId(null);
      setSelectedService(null);
      setSelectedStaff(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setStep("service");
    } else {
      setStep("customer");
    }
  };

  const handleRemoveCartItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleCartContinue = () => {
    if (cartItems.length > 0 && cartItems.every((item) => item.date && item.time)) {
      // If multiple services, ask who's booking
      if (cartItems.length > 1) {
        setStep("group-type");
      } else {
        setGroupBookingMode("single");
        setStep("customer");
      }
    }
  };

  const handleCartAddAnother = () => {
    setStep("service");
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to service page to view cart
  const handleViewCart = () => {
    setStep("service");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Get booked slots from cart for filtering in DateTimePicker
  const getBookedSlotsFromCart = () => {
    return cartItems
      .filter((item) => item.date && item.time)
      .map((item) => ({
        staffId: item.staff?.id || null,
        date: format(item.date!, "yyyy-MM-dd"),
        time: item.time!,
        durationMinutes: item.service.duration_minutes,
      }));
  };

  const getEdgeFunctionErrorMessage = (err: any) => {
    const body = err?.context?.body;

    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        if (parsed?.error) return String(parsed.error);
      } catch {
        // ignore
      }
    }

    if (body && typeof body === "object" && (body as any).error) {
      return String((body as any).error);
    }

    return err?.message || "Failed to create bookings.";
  };

  const handleGroupTypeSelect = (mode: "single" | "multiple", personCount?: number) => {
    setGroupBookingMode(mode);
    if (mode === "multiple" && personCount) {
      setGroupPersonCount(personCount);
      setStep("group-customer");
    } else {
      setStep("customer");
    }
  };

  const handleGroupBookingSubmit = async (people: Array<{ name: string; phone: string; email: string; notes: string; assignedServiceIds: string[] }>) => {
    if (!slug) return;

    try {
      // Build items with customer data per service
      const itemsWithCustomers = people.flatMap((person) =>
        person.assignedServiceIds.map((serviceItemId) => {
          const item = cartItems.find((ci) => ci.id === serviceItemId);
          if (!item) return null;
          const [hours, minutes] = (item.time || "00:00").split(":").map(Number);
          const startTime = new Date(item.date!);
          startTime.setHours(hours, minutes, 0, 0);
          return {
            serviceId: item.service.id,
            staffId: item.staff?.id || null,
            startTime: startTime.toISOString(),
            customerName: person.name,
            customerPhone: person.phone,
            customerEmail: person.email || undefined,
            notes: person.notes || undefined,
          };
        })
      ).filter(Boolean);

      const { data, error } = await supabase.functions.invoke("public-create-group-booking", {
        body: {
          businessSlug: slug,
          itemsWithCustomers,
          returnUrl: window.location.origin,
        },
      });

      if (error) throw error;

      // Handle payment redirect if required
      if (data.requiresPayment && data.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      setBookingResult({
        bookingCode: data.bookings[0]?.bookingCode || "N/A",
        requiresPayment: false,
        depositRequired: data.depositRequired || false,
        totalDeposit: data.totalDeposit,
        groupBookings: data.bookings,
      });
      setCartItems([]);
      setGroupBookingMode(null);
      setStep("confirmation");
    } catch (err: any) {
      toast({ title: "Booking failed", description: getEdgeFunctionErrorMessage(err), variant: "destructive" });
    }
  };

  const handleBookingSubmit = async (customerData: { name: string; phone: string; email?: string; notes?: string }) => {
    if (!slug) return;

    // Group booking flow
    if (cartItems.length > 0) {
      try {
        const items = cartItems.map((item) => {
          const [hours, minutes] = (item.time || "00:00").split(":").map(Number);
          const startTime = new Date(item.date!);
          startTime.setHours(hours, minutes, 0, 0);
          return {
            serviceId: item.service.id,
            staffId: item.staff?.id || null,
            startTime: startTime.toISOString(),
          };
        });

        const { data, error } = await supabase.functions.invoke("public-create-group-booking", {
          body: {
            businessSlug: slug,
            items,
            customerName: customerData.name,
            customerPhone: customerData.phone,
            customerEmail: customerData.email,
            notes: customerData.notes,
            returnUrl: window.location.origin,
          },
        });

        if (error) throw error;

        // Handle payment redirect if required
        if (data.requiresPayment && data.paymentUrl) {
          window.location.href = data.paymentUrl;
          return;
        }

        setBookingResult({
          bookingCode: data.bookings[0]?.bookingCode || "N/A",
          requiresPayment: false,
          depositRequired: data.depositRequired || false,
          totalDeposit: data.totalDeposit,
          groupBookings: data.bookings,
        });
        setCartItems([]);
        setStep("confirmation");
      } catch (err: any) {
        toast({ title: "Booking failed", description: getEdgeFunctionErrorMessage(err), variant: "destructive" });
      }
      return;
    }

    // Single booking flow
    if (!selectedService || !selectedDate || !selectedTime) return;

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
    // If we're in cart mode and going back from datetime, cancel current item selection
    if (currentCartItemId && step === "datetime") {
      setCartItems((prev) => prev.filter((item) => item.id !== currentCartItemId));
      setCurrentCartItemId(null);
      setSelectedService(null);
      setStep("service");
      return;
    }
    
    if (currentCartItemId && step === "staff") {
      setCartItems((prev) => prev.filter((item) => item.id !== currentCartItemId));
      setCurrentCartItemId(null);
      setSelectedService(null);
      setStep("service");
      return;
    }

    const backMap: Record<string, BookingStep> = {
      service: "landing",
      staff: cartItems.length > 0 ? "service" : "service",
      datetime: "staff",
      "group-type": "service",
      customer: cartItems.length > 0 ? "group-type" : "datetime",
      "group-customer": "group-type",
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

  const showCart = step === "service" && cartItems.length > 0;

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
            <div className="flex items-center gap-3">
              {cartItems.length > 0 && !["landing", "confirmation"].includes(step) && (
                <PublicMiniCart
                  items={cartItems}
                  currency={currency}
                  onRemoveItem={handleRemoveCartItem}
                  onContinue={handleCartContinue}
                  onAddAnother={handleCartAddAnother}
                />
              )}
              <PublicSocialLinks socials={{
                instagram: business.social_instagram,
                facebook: business.social_facebook,
                tiktok: business.social_tiktok,
                twitter: business.social_twitter,
                youtube: business.social_youtube,
              }} />
            </div>
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

      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
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
        {step === "service" && (
          <PublicServiceSelector 
            services={services} 
            currency={currency} 
            onSelect={cartItems.length > 0 ? handleAddToCart : handleServiceSelect}
            onAddToCart={handleAddToCart}
            onBack={handleBack}
            showAddToCart={true}
            cartItemCount={cartItems.length}
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
            bookedSlots={getBookedSlotsFromCart()}
          />
        )}
        {step === "group-type" && cartItems.length > 1 && (
          <PublicGroupTypeSelector
            serviceCount={cartItems.length}
            onSelect={handleGroupTypeSelect}
            onBack={handleBack}
          />
        )}
        {step === "customer" && (cartItems.length > 0 || (selectedService && selectedDate && selectedTime)) && slug && (
          <PublicCustomerForm
            businessSlug={slug}
            selectedService={cartItems.length > 0 ? cartItems[0].service as any : selectedService}
            selectedStaff={cartItems.length > 0 ? cartItems[0].staff : selectedStaff}
            selectedDate={cartItems.length > 0 ? cartItems[0].date : selectedDate}
            selectedTime={cartItems.length > 0 ? cartItems[0].time : selectedTime}
            currency={currency}
            collectDuringBooking={business.deposit_collection_timing === "during_booking"}
            hasStripe={!!business.stripe_account_id}
            onSubmit={handleBookingSubmit}
            onBack={handleBack}
            onExpressRebook={(serviceId, staffId) => {
              const service = services.find(s => s.id === serviceId);
              if (service) {
                setSelectedService(service);
                const staffMember = staffId ? staff.find(s => s.id === staffId) : null;
                setSelectedStaff(staffMember || null);
                setStep("datetime");
              }
            }}
            showAddService={true}
            onAddService={() => {
              setStep("service");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
        {step === "group-customer" && cartItems.length > 0 && slug && (
          <PublicGroupCustomerForm
            cartItems={cartItems}
            currency={currency}
            personCount={groupPersonCount}
            collectDuringBooking={business.deposit_collection_timing === "during_booking"}
            hasStripe={!!business.stripe_account_id}
            onSubmit={handleGroupBookingSubmit}
            onBack={handleBack}
            onAddService={() => {
              setStep("service");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
        {step === "confirmation" && bookingResult && (
          <PublicBookingConfirmation
            businessName={business.business_name}
            businessAddress={business.address}
            bookingCode={bookingResult.bookingCode}
            serviceName={selectedService?.name}
            staffName={selectedStaff?.name}
            date={selectedDate}
            time={selectedTime}
            serviceDuration={selectedService?.duration_minutes}
            depositRequired={bookingResult.depositRequired}
            depositAmount={bookingResult.depositAmount}
            depositPaymentLink={bookingResult.depositPaymentLink}
            currency={currency}
            groupBookings={bookingResult.groupBookings}
          />
        )}
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
