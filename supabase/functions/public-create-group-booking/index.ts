import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0";

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

interface CreatedBooking {
  bookingCode: string;
  bookingId: string;
  serviceName: string;
  staffName: string | null;
  staffId: string | null;
  startTime: string;
  endTime: string;
  depositRequired: boolean;
  depositAmount: number | null;
}

// Helper to check if two time ranges overlap
const doTimesOverlap = (
  start1: Date, 
  end1: Date, 
  start2: Date, 
  end2: Date
): boolean => {
  return start1 < end2 && end1 > start2;
};

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
      returnUrl,
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

    // Get business with all relevant settings
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(`
        id, 
        business_name, 
        online_booking_enabled, 
        status, 
        deposit_collection_timing,
        stripe_account_id,
        sms_on_confirmation,
        email_on_confirmation,
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
    const collectDuringBooking = business.deposit_collection_timing === "during_booking";
    const hasStripeConnected = !!business.stripe_account_id;

    // Get business settings for currency
    const { data: settings } = await supabase
      .from("business_settings")
      .select("currency")
      .eq("business_id", businessId)
      .single();
    const currency = (settings?.currency || "GBP").toLowerCase();

    const createdBookings: CreatedBooking[] = [];
    
    // Track bookings we're creating in this batch to avoid self-conflict
    const batchBookings: Array<{
      staffId: string | null;
      startTime: Date;
      endTime: Date;
    }> = [];

    // First pass: validate all items can be booked
    const validatedItems: Array<{
      item: CartItem | ItemWithCustomer;
      service: any;
      staffName: string | null;
      startDateTime: Date;
      endDateTime: Date;
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      notes?: string;
    }> = [];

    for (const item of bookingItems) {
      const { serviceId, staffId, startTime } = item;
      
      // Determine customer info
      const itemCustomerName = isMultiPerson ? (item as ItemWithCustomer).customerName : customerName;
      const itemCustomerPhone = isMultiPerson ? (item as ItemWithCustomer).customerPhone : customerPhone;
      const itemCustomerEmail = isMultiPerson ? (item as ItemWithCustomer).customerEmail : customerEmail;
      const itemNotes = isMultiPerson ? (item as ItemWithCustomer).notes : notes;

      // Validate customer name for this item
      const trimmedItemName = itemCustomerName?.trim() || "";
      if (trimmedItemName.length < 2 || /^(unknown|test|n\/a|na|none)$/i.test(trimmedItemName)) {
        logStep("Invalid customer name", { itemCustomerName });
        return new Response(
          JSON.stringify({ error: `Invalid customer name: ${itemCustomerName}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
        return new Response(
          JSON.stringify({ error: `Service not found: ${serviceId}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
          return new Response(
            JSON.stringify({ error: `Staff cannot provide this service` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Calculate times
      const startDateTime = new Date(startTime);
      const endDateTime = new Date(startDateTime.getTime() + service.duration_minutes * 60 * 1000);

      // Check for conflicts with existing bookings in database (only confirmed/completed - pending unpaid don't block)
      const { data: conflictingBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("business_id", businessId)
        .eq("staff_id", staffId)
        .in("status", ["confirmed", "completed"])
        .lt("start_time", endDateTime.toISOString())
        .gt("end_time", startDateTime.toISOString());

      if (conflictingBookings && conflictingBookings.length > 0) {
        logStep("Time slot conflict with existing booking", { serviceId, startTime });
        return new Response(
          JSON.stringify({ error: `Time slot ${startTime} is no longer available for ${service.name}` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for conflicts with other items in this batch (same staff, overlapping times)
      const batchConflict = batchBookings.find(b => 
        b.staffId === staffId && doTimesOverlap(startDateTime, endDateTime, b.startTime, b.endTime)
      );

      if (batchConflict) {
        logStep("Time slot conflict within batch", { serviceId, startTime, staffId });
        return new Response(
          JSON.stringify({ error: `Cannot book overlapping times for the same staff member` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add to batch tracking
      batchBookings.push({ staffId, startTime: startDateTime, endTime: endDateTime });

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

      validatedItems.push({
        item,
        service,
        staffName,
        startDateTime,
        endDateTime,
        customerName: trimmedItemName,
        customerPhone: itemCustomerPhone,
        customerEmail: itemCustomerEmail,
        notes: itemNotes,
      });
    }

    // Check if any service requires a deposit
    const anyDepositRequired = validatedItems.some(v => v.service.deposit_required && v.service.deposit_amount > 0);
    const shouldCollectNow = anyDepositRequired && collectDuringBooking && hasStripeConnected;

    logStep("Deposit check", { anyDepositRequired, collectDuringBooking, hasStripeConnected, shouldCollectNow });

    // If collecting deposit during booking and Stripe is connected
    if (shouldCollectNow) {
      try {
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeSecretKey) throw new Error("Stripe not configured");

        const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

        // Create all bookings as pending first
        for (const validated of validatedItems) {
          const { service, staffName, startDateTime, endDateTime, customerName: custName, customerPhone: custPhone, customerEmail: custEmail, notes: custNotes } = validated;
          const staffId = validated.item.staffId;

          const { data: bookingCodeData } = await supabase.rpc("generate_booking_code", {
            p_business_name: business.business_name,
          });
          const bookingCode = bookingCodeData || `BKG-${Date.now()}`;

          const depositRequired = service.deposit_required && service.deposit_amount > 0;

          const { data: booking, error: bookingError } = await supabase
            .from("bookings")
            .insert({
              business_id: businessId,
              service_id: service.id,
              staff_id: staffId,
              customer_name: custName,
              customer_phone: custPhone,
              customer_email: custEmail || null,
              start_time: startDateTime.toISOString(),
              end_time: endDateTime.toISOString(),
              status: "pending",
              payment_status: "unpaid",
              deposit_amount: depositRequired ? service.deposit_amount : null,
              booking_code: bookingCode,
              notes: custNotes || null,
              created_by: "online_booking",
            })
            .select()
            .single();

          if (bookingError) {
            logStep("Failed to create pending booking", { error: bookingError });
            continue;
          }

          createdBookings.push({
            bookingCode,
            bookingId: booking.id,
            serviceName: service.name,
            staffName,
            staffId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            depositRequired,
            depositAmount: depositRequired ? service.deposit_amount : null,
          });
        }

        if (createdBookings.length === 0) {
          throw new Error("Failed to create any bookings");
        }

        // Calculate total deposit amount
        const totalDeposit = createdBookings.reduce((sum, b) => sum + (b.depositAmount || 0), 0);
        const depositAmountInCents = Math.round(totalDeposit * 100);

        // Create a single payment link for all deposits
        const lineItemName = createdBookings.length === 1 
          ? `Deposit for ${createdBookings[0].serviceName}`
          : `Deposit for ${createdBookings.length} bookings`;

        const price = await stripe.prices.create({
          unit_amount: depositAmountInCents,
          currency: currency,
          product_data: {
            name: lineItemName,
            metadata: {
              booking_ids: createdBookings.map(b => b.bookingId).join(","),
              business_id: businessId,
            },
          },
        }, {
          stripeAccount: business.stripe_account_id,
        });

        const allBookingCodes = createdBookings.map(b => b.bookingCode).join(",");
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [{ price: price.id, quantity: 1 }],
          after_completion: {
            type: "redirect",
            redirect: {
              url: `${returnUrl || req.headers.get("origin")}/book/${businessSlug}/success?codes=${allBookingCodes}&paid=true`,
            },
          },
          metadata: {
            booking_ids: createdBookings.map(b => b.bookingId).join(","),
            business_id: businessId,
            booking_codes: allBookingCodes,
          },
        }, {
          stripeAccount: business.stripe_account_id,
        });

        // Update all bookings with payment link
        for (const booking of createdBookings) {
          await supabase
            .from("bookings")
            .update({ deposit_payment_link: paymentLink.url })
            .eq("id", booking.bookingId);
        }

        logStep("Payment link created for group", { url: paymentLink.url, totalDeposit });

        return new Response(
          JSON.stringify({ 
            success: true,
            requiresPayment: true,
            paymentUrl: paymentLink.url,
            bookings: createdBookings,
            totalDeposit,
            message: "Please complete payment to confirm your bookings"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (stripeError: any) {
        logStep("Stripe error, falling back to confirmed booking", { error: stripeError?.message || String(stripeError) });
        // Clean up pending bookings and fall through to create confirmed ones
        for (const booking of createdBookings) {
          await supabase.from("bookings").delete().eq("id", booking.bookingId);
        }
        createdBookings.length = 0;
      }
    }

    // Create confirmed bookings (either no deposit, collect later, or Stripe failed)
    for (const validated of validatedItems) {
      const { service, staffName, startDateTime, endDateTime, customerName: custName, customerPhone: custPhone, customerEmail: custEmail, notes: custNotes } = validated;
      const staffId = validated.item.staffId;

      const { data: bookingCodeData } = await supabase.rpc("generate_booking_code", {
        p_business_name: business.business_name,
      });
      const bookingCode = bookingCodeData || `BKG-${Date.now()}`;

      const depositRequired = service.deposit_required && service.deposit_amount > 0;

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          business_id: businessId,
          service_id: service.id,
          staff_id: staffId,
          customer_name: custName,
          customer_phone: custPhone,
          customer_email: custEmail || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "confirmed",
          payment_status: depositRequired ? "unpaid" : "paid_in_full",
          deposit_amount: depositRequired ? service.deposit_amount : null,
          booking_code: bookingCode,
          notes: custNotes || null,
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
        staffId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        depositRequired,
        depositAmount: depositRequired ? service.deposit_amount : null,
      });

      // Generate deposit payment link for later collection if needed
      if (depositRequired && hasStripeConnected) {
        try {
          const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
          if (stripeSecretKey) {
            const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
            const depositAmountInCents = Math.round(service.deposit_amount * 100);

            const price = await stripe.prices.create({
              unit_amount: depositAmountInCents,
              currency: currency,
              product_data: {
                name: `Deposit for ${service.name}`,
                metadata: { booking_id: booking.id, business_id: businessId },
              },
            }, {
              stripeAccount: business.stripe_account_id,
            });

            const paymentLink = await stripe.paymentLinks.create({
              line_items: [{ price: price.id, quantity: 1 }],
              after_completion: {
                type: "redirect",
                redirect: {
                  url: `${returnUrl || req.headers.get("origin")}/book/${businessSlug}/success?code=${bookingCode}&paid=true`,
                },
              },
              metadata: {
                booking_id: booking.id,
                business_id: businessId,
                booking_code: bookingCode,
              },
            }, {
              stripeAccount: business.stripe_account_id,
            });

            await supabase
              .from("bookings")
              .update({ deposit_payment_link: paymentLink.url })
              .eq("id", booking.id);

            logStep("Deposit link generated for later collection", { bookingCode });
          }
        } catch (error: any) {
          logStep("Failed to create deposit link", { error: error?.message || String(error) });
        }
      }

      logStep("Booking created", { bookingCode, serviceName: service.name });
    }

    if (createdBookings.length === 0) {
      return new Response(
        JSON.stringify({ error: "Failed to create any bookings. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send confirmation SMS for ALL bookings if enabled
    if (business.sms_on_confirmation && business.twilio_enabled && business.twilio_phone_number && createdBookings.length > 0) {
      for (const booking of createdBookings) {
        try {
          await supabase.functions.invoke("send-booking-sms", {
            body: {
              businessId,
              bookingId: booking.bookingId,
              type: "confirmation",
            },
          });
          logStep("Confirmation SMS sent", { bookingCode: booking.bookingCode });
        } catch (smsError: any) {
          logStep("Failed to send SMS", { bookingCode: booking.bookingCode, error: smsError?.message || String(smsError) });
        }
      }
    }

    // Send confirmation email if enabled (using first booking)
    if (business.email_on_confirmation && createdBookings.length > 0) {
      try {
        await supabase.functions.invoke("send-booking-email", {
          body: {
            businessId,
            bookingId: createdBookings[0].bookingId,
            type: "confirmation",
          },
        });
        logStep("Confirmation email sent");
      } catch (emailError: any) {
        logStep("Failed to send email", { error: emailError?.message || String(emailError) });
      }
    }

    // Calculate total deposit if any
    const totalDeposit = createdBookings.reduce((sum, b) => sum + (b.depositAmount || 0), 0);

    return new Response(
      JSON.stringify({ 
        success: true,
        requiresPayment: false,
        bookings: createdBookings,
        totalDeposit,
        depositRequired: totalDeposit > 0,
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
