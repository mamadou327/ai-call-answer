import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-CREATE-GROUP-BOOKING] ${step}${detailsStr}`);
};

interface CartItem {
  serviceId: string;
  staffId: string | null;
  startTime: string;
}

interface ItemWithCustomer {
  serviceId: string;
  staffId: string | null;
  startTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestBody = await req.json();
    const { 
      businessSlug, 
      items,
      itemsWithCustomers,
      customerName, 
      customerPhone, 
      customerEmail,
      notes,
    } = requestBody;

    // Determine if this is multi-person mode (itemsWithCustomers) or single-person mode (items)
    const isMultiPerson = itemsWithCustomers && Array.isArray(itemsWithCustomers) && itemsWithCustomers.length > 0;
    const bookingItems = isMultiPerson ? itemsWithCustomers : items;

    logStep("Request received", { businessSlug, itemCount: bookingItems?.length, isMultiPerson });

    // Validate required fields
    if (!businessSlug || !bookingItems || !Array.isArray(bookingItems) || bookingItems.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For single-person mode, validate customer info
    if (!isMultiPerson) {
      if (!customerName || !customerPhone) {
        return new Response(
          JSON.stringify({ error: "Missing customer name or phone" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const trimmedName = customerName.trim();
      if (trimmedName.length < 2 || /^(unknown|test|n\/a|na|none)$/i.test(trimmedName)) {
        return new Response(
          JSON.stringify({ error: "Please provide a valid customer name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(`
        id, 
        business_name, 
        online_booking_enabled, 
        status, 
        sms_on_confirmation,
        twilio_enabled,
        twilio_phone_number
      `)
      .eq("booking_slug", businessSlug)
      .single();

    if (businessError || !business) {
      logStep("Business not found", { businessSlug });
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!business.online_booking_enabled || business.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Online booking is not available for this business" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessId = business.id;
    const createdBookings: Array<{
      bookingCode: string;
      bookingId: string;
      serviceName: string;
      staffName: string | null;
      startTime: string;
      endTime: string;
    }> = [];

    // Process each item in the cart
    for (const item of bookingItems) {
      const { serviceId, staffId, startTime } = item;
      
      // Determine customer info - from item (multi-person) or from request params (single-person)
      const itemCustomerName = isMultiPerson ? (item as ItemWithCustomer).customerName : customerName;
      const itemCustomerPhone = isMultiPerson ? (item as ItemWithCustomer).customerPhone : customerPhone;
      const itemCustomerEmail = isMultiPerson ? (item as ItemWithCustomer).customerEmail : customerEmail;
      const itemNotes = isMultiPerson ? (item as ItemWithCustomer).notes : notes;

      // Validate customer name for this item
      const trimmedItemName = itemCustomerName?.trim() || "";
      if (trimmedItemName.length < 2 || /^(unknown|test|n\/a|na|none)$/i.test(trimmedItemName)) {
        logStep("Invalid customer name", { itemCustomerName });
        continue;
      }

      // Get service details
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price, deposit_required, deposit_amount")
        .eq("id", serviceId)
        .eq("business_id", businessId)
        .single();

      if (serviceError || !service) {
        logStep("Service not found", { serviceId });
        continue;
      }

      // Validate staff can provide service if staff is specified
      if (staffId) {
        const { data: staffServiceAssignment } = await supabase
          .from("staff_services")
          .select("id")
          .eq("staff_id", staffId)
          .eq("service_id", serviceId)
          .maybeSingle();

        if (!staffServiceAssignment) {
          logStep("Staff cannot provide service", { staffId, serviceId });
          continue;
        }
      }

      // Calculate times
      const startDateTime = new Date(startTime);
      const endDateTime = new Date(startDateTime.getTime() + service.duration_minutes * 60 * 1000);

      // Check for conflicts
      const { data: conflictingBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("business_id", businessId)
        .eq("staff_id", staffId)
        .neq("status", "cancelled")
        .lt("start_time", endDateTime.toISOString())
        .gt("end_time", startDateTime.toISOString());

      if (conflictingBookings && conflictingBookings.length > 0) {
        logStep("Time slot conflict", { serviceId, startTime });
        continue;
      }

      // Generate booking code
      const { data: bookingCodeData } = await supabase.rpc("generate_booking_code", {
        p_business_name: business.business_name,
      });
      const bookingCode = bookingCodeData || `BKG-${Date.now()}`;

      // Get staff name if staff is selected
      let staffName = null;
      if (staffId) {
        const { data: staffData } = await supabase
          .from("staff")
          .select("name")
          .eq("id", staffId)
          .single();
        staffName = staffData?.name || null;
      }

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          business_id: businessId,
          service_id: serviceId,
          staff_id: staffId,
          customer_name: trimmedItemName,
          customer_phone: itemCustomerPhone,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "confirmed",
          payment_status: "unpaid",
          deposit_amount: service.deposit_required ? service.deposit_amount : null,
          booking_code: bookingCode,
          notes: itemNotes || null,
          created_by: "online_booking",
        })
        .select()
        .single();

      if (bookingError) {
        logStep("Failed to create booking", { error: bookingError });
        continue;
      }

      createdBookings.push({
        bookingCode,
        bookingId: booking.id,
        serviceName: service.name,
        staffName,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      });

      logStep("Booking created", { bookingCode, serviceName: service.name });
    }

    if (createdBookings.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to create any bookings. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send confirmation SMS for first booking if enabled
    if (business.sms_on_confirmation && business.twilio_enabled && business.twilio_phone_number && createdBookings.length > 0) {
      try {
        await supabase.functions.invoke("send-booking-sms", {
          body: {
            businessId,
            bookingId: createdBookings[0].bookingId,
            type: "confirmation",
          },
        });
        logStep("Confirmation SMS sent");
      } catch (smsError: any) {
        logStep("Failed to send SMS", { error: smsError?.message || String(smsError) });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        bookings: createdBookings,
        message: `${createdBookings.length} booking${createdBookings.length > 1 ? 's' : ''} confirmed!`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error", { message: error?.message || String(error) });
    return new Response(
      JSON.stringify({ error: error?.message || "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
