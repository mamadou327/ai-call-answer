import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { PublicBookingCart, CartItem } from "@/components/public-booking/PublicBookingCart";
import { PublicGroupTypeSelector } from "@/components/public-booking/PublicGroupTypeSelector";
import { PublicGroupCustomerForm } from "@/components/public-booking/PublicGroupCustomerForm";
import { PublicBookingHeader } from "@/components/public-booking/PublicBookingHeader";
import { PublicContactForm } from "@/components/public-booking/PublicContactForm";
import { PublicMenuSelector, MenuItem, MenuCategory, MenuItemOptionGroup, OrderItem } from "@/components/public-booking/PublicMenuSelector";
import { PublicOrderCart } from "@/components/public-booking/PublicOrderCart";
import { PublicOrderConfirmation } from "@/components/public-booking/PublicOrderConfirmation";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
interface Business {
  id: string;
  business_name: string;
  business_type: string | null;
  address: string;
  main_phone: string;
  website: string | null;
  online_booking_message: string | null;
  deposit_collection_timing: string;
  logo_url: string | null;
  hero_image_url: string | null;
  brand_color: string | null;
  about_description: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_tiktok: string | null;
  social_twitter: string | null;
  social_youtube: string | null;
  minimum_order_amount: number | null;
  delivery_enabled: boolean | null;
  delivery_fee: number | null;
  delivery_minimum_order: number | null;
  average_prep_time_minutes: number | null;
  has_stripe: boolean;
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

type BookingStep = "landing" | "service" | "staff" | "datetime" | "group-type" | "customer" | "group-customer" | "confirmation" | "lookup-cancel" | "cancel" | "lookup-reschedule" | "reschedule" | "gallery" | "menu" | "order-cart" | "order-confirmation";

const RESTAURANT_TYPES = ["restaurant_pickup", "restaurant_dine_in", "restaurant_hybrid"];

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
  const [galleryPreview, setGalleryPreview] = useState<string[]>([]);
  const [policies, setPolicies] = useState<PolicySettings | undefined>(undefined);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);
  const [resolvedSlug, setResolvedSlug] = useState<string | null>(null);
  
  // Restaurant-specific state
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderResult, setOrderResult] = useState<{
    orderNumber: string;
    total: number;
    estimatedTime?: string;
    orderType: "pickup" | "delivery";
  } | null>(null);

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
  
  // Contact dialog state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  
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

  // Check if we're on a custom domain and resolve the business
  useEffect(() => {
    const checkCustomDomain = async () => {
      const hostname = window.location.hostname.toLowerCase();
      
      // List of main app domains
      const mainDomains = ["localhost", "127.0.0.1", "aiviaapp.co.uk", "www.aiviaapp.co.uk"];
      const isMainDomain = mainDomains.some(d => 
        hostname === d || 
        hostname.endsWith(`.${d}`) || 
        hostname.includes("lovable")
      );

      // If we have a slug from URL params, use it (standard route)
      if (slug) {
        setResolvedSlug(slug);
        return;
      }

      // If we're on a custom domain, look up the business
      if (!isMainDomain) {
        try {
          // Use public_businesses view to avoid exposing sensitive columns
          const { data, error } = await supabase
            .from("public_businesses")
            .select("booking_slug, custom_domain_verified")
            .eq("custom_booking_domain", hostname)
            .eq("custom_domain_verified", true)
            .single();

          if (data && !error) {
            setResolvedSlug(data.booking_slug);
          } else {
            // Check if there's an unverified business
          // Query for unverified domains - this still needs the base table as view filters on verified only
          const { data: unverified } = await supabase
            .from("public_businesses")
            .select("business_name, custom_domain_verified")
            .eq("custom_booking_domain", hostname)
            .single();

            if (unverified && !unverified.custom_domain_verified) {
              setError("This domain is connected but not yet verified. Please contact the business owner.");
            } else {
              setError("This domain hasn't been connected to Aivia. Please contact the business owner.");
            }
            setLoading(false);
          }
        } catch (err) {
          console.error("Error looking up custom domain:", err);
          setError("Failed to load booking page");
          setLoading(false);
        }
      } else if (!slug) {
        // No slug and on main domain - this shouldn't happen normally
        setError("Booking page not found");
        setLoading(false);
      }
    };

    checkCustomDomain();
  }, [slug]);

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
      if (!resolvedSlug) return;

      try {
        // Use public_businesses view to avoid exposing sensitive columns like webhook tokens
        const { data: businessData, error: businessError } = await supabase
          .from("public_businesses")
          .select(`
            id, business_name, business_type, address, main_phone, website,
            online_booking_message, deposit_collection_timing, has_stripe,
            logo_url, hero_image_url, brand_color, about_description,
            social_instagram, social_facebook, social_tiktok, social_twitter, social_youtube,
            minimum_order_amount, delivery_enabled, delivery_fee, delivery_minimum_order, average_prep_time_minutes
          `)
          .eq("booking_slug", resolvedSlug)
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
            .from("public_business_settings")
            .select("currency, min_booking_notice_hours, max_days_advance, min_cancellation_notice_hours, min_reschedule_notice_hours, cancellation_policy")
            .eq("business_id", businessData.id)
            .single(),
          supabase
            .from("business_gallery")
            .select("image_url")
            .eq("business_id", businessData.id)
            .order("display_order", { ascending: true })
            .limit(4),
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
        const galleryUrls = (galleryResult.data ?? []).map((g: any) => g.image_url).filter(Boolean);
        setHasGallery(galleryUrls.length > 0);
        setGalleryPreview(galleryUrls);
        if (hoursResult.data) setOpeningHours(hoursResult.data);
        
        // Fetch restaurant menu if applicable
        const isRestaurant = RESTAURANT_TYPES.includes(businessData.business_type || "");
        if (isRestaurant) {
          const [categoriesRes, itemsRes] = await Promise.all([
            supabase.from("menu_categories").select("id, name, description, display_order").eq("business_id", businessData.id).eq("is_active", true).order("display_order"),
            supabase.from("menu_items").select("id, name, description, price, category_id, dietary_tags, is_available, has_sizes, preparation_time_minutes").eq("business_id", businessData.id).eq("is_available", true),
          ]);
          
          if (categoriesRes.data) setMenuCategories(categoriesRes.data);
          
          // Fetch sizes and option groups for items
          if (itemsRes.data && itemsRes.data.length > 0) {
            const itemIds = itemsRes.data.map((i: any) => i.id);
            const itemsWithSizes = itemsRes.data.filter((i: any) => i.has_sizes);
            const sizeItemIds = itemsWithSizes.map((i: any) => i.id);
            
            const [sizesRes, optionGroupsRes] = await Promise.all([
              sizeItemIds.length > 0 
                ? supabase.from("menu_item_sizes").select("*").in("menu_item_id", sizeItemIds).eq("is_available", true).order("display_order")
                : Promise.resolve({ data: [] }),
              supabase.from("menu_item_option_groups").select("*").in("menu_item_id", itemIds).order("display_order"),
            ]);
            
            const sizes = sizesRes.data || [];
            const optionGroups = optionGroupsRes.data || [];
            
            // Fetch options for all option groups
            let options: any[] = [];
            let optionSizes: any[] = [];
            if (optionGroups.length > 0) {
              const groupIds = optionGroups.map((g: any) => g.id);
              const { data: optionsData } = await supabase
                .from("menu_item_options")
                .select("*")
                .in("option_group_id", groupIds)
                .eq("is_available", true)
                .order("display_order");
              options = optionsData || [];
              
              // Fetch sizes for options that have them
              const optionsWithSizes = options.filter((o: any) => o.has_sizes);
              if (optionsWithSizes.length > 0) {
                const optionIds = optionsWithSizes.map((o: any) => o.id);
                const { data: optSizesData } = await supabase
                  .from("menu_item_option_sizes")
                  .select("*")
                  .in("option_id", optionIds)
                  .eq("is_available", true)
                  .order("display_order");
                optionSizes = optSizesData || [];
              }
            }
            
            // Enrich items with sizes and option groups
            const enrichedItems = itemsRes.data.map((item: any) => {
              const itemSizes = sizes.filter((s: any) => s.menu_item_id === item.id);
              const itemOptionGroups = optionGroups
                .filter((g: any) => g.menu_item_id === item.id)
                .map((group: any) => ({
                  ...group,
                  options: options
                    .filter((o: any) => o.option_group_id === group.id)
                    .map((opt: any) => ({
                      ...opt,
                      sizes: optionSizes.filter((os: any) => os.option_id === opt.id),
                    })),
                }));
              
              return {
                ...item,
                sizes: itemSizes,
                option_groups: itemOptionGroups,
              };
            });
            
            setMenuItems(enrichedItems);
          }
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching business data:", err);
        setError("Failed to load booking page");
        setLoading(false);
      }
    };

    fetchBusinessData();
  }, [resolvedSlug]);

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
        .from("public_staff" as any)
        .select("id, name")
        .eq("business_id", business.id)
        .in("id", assignedStaffIds)
        .order("name", { ascending: true });

      if (staffError) {
        console.error("Error fetching staff:", staffError);
        setStaff([]);
        return;
      }

      setStaff((staffData ?? []) as unknown as Staff[]);
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

  // Restaurant order handlers
  const handleAddToOrder = (item: OrderItem) => {
    setOrderItems((prev) => [...prev, item]);
  };

  const handleRemoveOrderItem = (itemId: string) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleUpdateOrderQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveOrderItem(itemId);
    } else {
      setOrderItems((prev) => prev.map((item) => item.id === itemId ? { ...item, quantity } : item));
    }
  };

  const handleOrderSubmit = async (orderData: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    orderType: "pickup" | "delivery";
    deliveryAddress?: string;
    pickupTime?: string;
    notes?: string;
  }) => {
    const effectiveSlug = resolvedSlug || slug;
    if (!effectiveSlug) return;

    try {
      const items = orderItems.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        sizeId: item.selectedSize?.id,
        sizeName: item.selectedSize?.name,
        options: item.selectedOptions.map((opt) => ({
          optionId: opt.option.id,
          optionName: opt.option.name,
          priceAdjustment: opt.option.price_adjustment,
          optionSizeId: opt.selectedSize?.id,
        })),
        specialInstructions: item.specialInstructions,
      }));

      const { data, error } = await supabase.functions.invoke("public-create-order", {
        body: { businessSlug: effectiveSlug, items, ...orderData },
      });

      if (error) throw error;

      setOrderResult({
        orderNumber: data.orderNumber,
        total: data.total,
        estimatedTime: data.estimatedTime,
        orderType: data.orderType,
      });
      setOrderItems([]);
      setStep("order-confirmation");
    } catch (err: any) {
      toast({ title: "Order failed", description: err?.message || "Failed to place order", variant: "destructive" });
    }
  };

  const isRestaurant = business && RESTAURANT_TYPES.includes(business.business_type || "");

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
    // Use resolvedSlug for API calls instead of slug
    const effectiveSlug = resolvedSlug || slug;
    if (!effectiveSlug) return;
    
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
            businessSlug: effectiveSlug,
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
          businessSlug: effectiveSlug,
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

  const handleHeaderNavigate = (navStep: "landing" | "service" | "gallery" | "menu") => {
    setStep(navStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const brandColor = business.brand_color || "#0F172A";

  return (
    <div
      className="min-h-screen bg-background"
      style={{ ["--brand-color" as any]: brandColor }}
    >
      <PublicBookingHeader
        businessName={business.business_name}
        logoUrl={business.logo_url}
        socials={{
          instagram: business.social_instagram,
          facebook: business.social_facebook,
          tiktok: business.social_tiktok,
          twitter: business.social_twitter,
          youtube: business.social_youtube,
        }}
        hasGallery={hasGallery}
        currentStep={step}
        cartItems={cartItems}
        orderItems={orderItems}
        currency={currency}
        businessType={business.business_type}
        onNavigate={handleHeaderNavigate}
        onOpenContact={() => setContactDialogOpen(true)}
        onRemoveCartItem={handleRemoveCartItem}
        onRemoveOrderItem={handleRemoveOrderItem}
        onCartContinue={isRestaurant ? () => setStep("order-cart") : handleCartContinue}
        onCartAddAnother={isRestaurant ? () => setStep("menu") : handleCartAddAnother}
      />

      {/* Contact Dialog - controlled mode */}
      <PublicContactForm 
        businessSlug={slug || ""} 
        businessName={business.business_name} 
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        showTrigger={false}
      />

      {!["landing", "confirmation", "lookup-cancel", "lookup-reschedule", "cancel", "reschedule", "gallery", "order-confirmation"].includes(step) && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            {isRestaurant ? (
              ["menu", "order-cart"].map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground">→</span>}
                  <span
                    className={step === s ? "font-bold" : "text-muted-foreground"}
                    style={step === s ? { color: brandColor } : undefined}
                  >
                    {i + 1}. {s === "menu" ? "Menu" : "Checkout"}
                  </span>
                </span>
              ))
            ) : (
              ["service", "staff", "datetime", "customer"].map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground">→</span>}
                  <span
                    className={step === s ? "font-bold" : "text-muted-foreground"}
                    style={step === s ? { color: brandColor } : undefined}
                  >
                    {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                </span>
              ))
            )}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-6 pb-32">
        {step === "landing" && (
          <PublicLandingPage
            businessName={business.business_name}
            businessSlug={slug || ""}
            businessType={business.business_type}
            welcomeMessage={business.online_booking_message}
            address={business.address}
            phone={business.main_phone}
            website={business.website}
            logoUrl={business.logo_url}
            heroImageUrl={business.hero_image_url}
            brandColor={business.brand_color}
            aboutDescription={business.about_description}
            socials={{
              instagram: business.social_instagram,
              facebook: business.social_facebook,
              tiktok: business.social_tiktok,
              twitter: business.social_twitter,
              youtube: business.social_youtube,
            }}
            services={services.map((s: any) => ({
              id: s.id,
              name: s.name,
              duration_minutes: s.duration_minutes,
              price: s.price,
            }))}
            galleryImages={galleryPreview}
            currency={currency}
            hasGallery={hasGallery}
            policies={policies}
            openingHours={openingHours}
            onMakeBooking={() => setStep(isRestaurant ? "menu" : "service")}
            onCancelBooking={() => setStep("lookup-cancel")}
            onRescheduleBooking={() => setStep("lookup-reschedule")}
            onViewGallery={() => setStep("gallery")}
          />
        )}
        {step === "menu" && isRestaurant && (
          <PublicMenuSelector
            categories={menuCategories}
            menuItems={menuItems}
            currency={currency}
            orderItems={orderItems}
            onAddToOrder={(item) => { handleAddToOrder(item); setStep("order-cart"); }}
            onBack={handleBack}
            minimumOrder={business.minimum_order_amount || undefined}
          />
        )}
        {step === "order-cart" && isRestaurant && (
          <PublicOrderCart
            orderItems={orderItems}
            currency={currency}
            businessName={business.business_name}
            businessAddress={business.address}
            minimumOrder={business.minimum_order_amount || undefined}
            deliveryEnabled={business.delivery_enabled || false}
            deliveryFee={business.delivery_fee || 0}
            deliveryMinimum={business.delivery_minimum_order || 0}
            averagePrepTime={business.average_prep_time_minutes || 20}
            onRemoveItem={handleRemoveOrderItem}
            onUpdateQuantity={handleUpdateOrderQuantity}
            onSubmit={handleOrderSubmit}
            onBack={() => setStep("menu")}
            onAddMore={() => setStep("menu")}
          />
        )}
        {step === "order-confirmation" && orderResult && (
          <PublicOrderConfirmation
            orderNumber={orderResult.orderNumber}
            businessName={business.business_name}
            businessAddress={business.address}
            businessPhone={business.main_phone}
            orderType={orderResult.orderType}
            estimatedTime={orderResult.estimatedTime}
            total={orderResult.total}
            currency={currency}
            onBackToHome={() => setStep("landing")}
          />
        )}
        {step === "service" && !isRestaurant && (
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
            openingHours={openingHours}
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
            hasStripe={business.has_stripe}
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
            hasStripe={business.has_stripe}
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
        {step === "reschedule" && slug && selectedBooking && <PublicRescheduleBooking businessSlug={slug} booking={selectedBooking} currency={currency} openingHours={openingHours} onBack={handleBack} onSuccess={() => setStep("landing")} />}
        {step === "gallery" && <PublicGallery businessId={business.id} onBack={handleBack} />}
      </main>

    </div>
  );
};

export default PublicBookingPage;
