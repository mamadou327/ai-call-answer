import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-CREATE-BOOKING] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      businessSlug, 
      serviceId, 
      staffId, 
      startTime, 
      customerName, 
      customerPhone, 
      customerEmail,
      notes,
      returnUrl
    } = await req.json();

    logStep("Request received", { businessSlug, serviceId, staffId, startTime, customerName });

    // Validate required fields
    if (!businessSlug || !serviceId || !startTime || !customerName || !customerPhone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate customer name is real
    const trimmedName = customerName.trim();
    if (trimmedName.length < 2 || /^(unknown|test|n\/a|na|none)$/i.test(trimmedName)) {
      return new Response(
        JSON.stringify({ error: "Please provide a valid customer name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price, deposit_required, deposit_amount")
      .eq("id", serviceId)
      .eq("business_id", businessId)
      .single();

    if (serviceError || !service) {
      return new Response(
        JSON.stringify({ error: "Service not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that the staff member can provide this service
    if (staffId) {
      const { data: staffServiceAssignment } = await supabase
        .from("staff_services")
        .select("id")
        .eq("staff_id", staffId)
        .eq("service_id", serviceId)
        .maybeSingle();

      if (!staffServiceAssignment) {
        logStep("Staff cannot provide this service", { staffId, serviceId });
        return new Response(
          JSON.stringify({ error: "The selected staff member does not provide this service. Please select a different staff member." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Calculate end time
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(startDateTime.getTime() + service.duration_minutes * 60 * 1000);

    // Verify slot is still available (only check confirmed/completed bookings - pending unpaid bookings don't block)
    const { data: conflictingBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .in("status", ["confirmed", "completed"])
      .lt("start_time", endDateTime.toISOString())
      .gt("end_time", startDateTime.toISOString());

    if (conflictingBookings && conflictingBookings.length > 0) {
      return new Response(
        JSON.stringify({ error: "This time slot is no longer available. Please select another time." }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if deposit is required and when to collect
    const depositRequired = service.deposit_required && service.deposit_amount > 0;
    const collectDuringBooking = business.deposit_collection_timing === "during_booking";
    const hasStripeConnected = !!business.stripe_account_id;

    // Generate booking code using the database function
    const { data: bookingCodeData } = await supabase.rpc("generate_booking_code", {
      p_business_name: business.business_name,
    });
    const bookingCode = bookingCodeData || `BKG-${Date.now()}`;

    logStep("Creating booking", { 
      depositRequired, 
      collectDuringBooking, 
      hasStripeConnected,
      bookingCode 
    });

    // If collecting deposit during booking and Stripe is connected
    if (depositRequired && collectDuringBooking && hasStripeConnected) {
      // Create pending booking first
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          business_id: businessId,
          service_id: serviceId,
          staff_id: staffId,
          customer_name: trimmedName,
          customer_phone: customerPhone,
          customer_email: customerEmail || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "pending",
          payment_status: "unpaid",
          deposit_amount: service.deposit_amount,
          booking_code: bookingCode,
          notes: notes || null,
          created_by: "online_booking",
        })
        .select()
        .single();

      if (bookingError) {
        logStep("Failed to create booking", { error: bookingError });
        return new Response(
          JSON.stringify({ error: "Failed to create booking" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create Stripe checkout session
      try {
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (!stripeSecretKey) throw new Error("Stripe not configured");

        const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

        // Get business settings for currency
        const { data: settings } = await supabase
          .from("business_settings")
          .select("currency")
          .eq("business_id", businessId)
          .single();

        const currency = (settings?.currency || "GBP").toLowerCase();
        const depositAmountInCents = Math.round(service.deposit_amount * 100);

        // Create a price for the deposit
        const price = await stripe.prices.create({
          unit_amount: depositAmountInCents,
          currency: currency,
          product_data: {
            name: `Deposit for ${service.name}`,
            metadata: {
              booking_id: booking.id,
              business_id: businessId,
            },
          },
        }, {
          stripeAccount: business.stripe_account_id,
        });

        // Create payment link
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [{ price: price.id, quantity: 1 }],
          after_completion: {
            type: "redirect",
            redirect: {
              url: `${returnUrl || req.headers.get("origin")}/book/${businessSlug}/success?code=${bookingCode}`,
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

        // Update booking with payment link
        await supabase
          .from("bookings")
          .update({ deposit_payment_link: paymentLink.url })
          .eq("id", booking.id);

        logStep("Payment link created", { url: paymentLink.url });

        return new Response(
          JSON.stringify({ 
            success: true,
            requiresPayment: true,
            paymentUrl: paymentLink.url,
            bookingCode,
            message: "Please complete payment to confirm your booking"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (stripeError: any) {
        logStep("Stripe error", { error: stripeError?.message || String(stripeError) });
        // Fall back to creating confirmed booking without immediate payment
      }
    }

    // Create confirmed booking (either no deposit, collect later, or Stripe failed)
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        business_id: businessId,
        service_id: serviceId,
        staff_id: staffId,
        customer_name: trimmedName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: "confirmed",
        payment_status: depositRequired ? "unpaid" : "paid_in_full",
        deposit_amount: depositRequired ? service.deposit_amount : null,
        booking_code: bookingCode,
        notes: notes || null,
        created_by: "online_booking",
      })
      .select()
      .single();

    if (bookingError) {
      logStep("Failed to create booking", { error: bookingError });
      return new Response(
        JSON.stringify({ error: "Failed to create booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Booking created", { bookingId: booking.id, bookingCode });

    // Generate deposit payment link if needed (collect after booking)
    let depositPaymentLink = null;
    if (depositRequired && hasStripeConnected) {
      try {
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeSecretKey) {
          const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
          
          const { data: settings } = await supabase
            .from("business_settings")
            .select("currency")
            .eq("business_id", businessId)
            .single();

          const currency = (settings?.currency || "GBP").toLowerCase();
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

          depositPaymentLink = paymentLink.url;

          await supabase
            .from("bookings")
            .update({ deposit_payment_link: paymentLink.url })
            .eq("id", booking.id);

          logStep("Deposit link generated for later collection", { url: paymentLink.url });
        }
      } catch (error: any) {
        logStep("Failed to create deposit link", { error: error?.message || String(error) });
      }
    }

    // Send confirmation SMS if enabled
    if (business.sms_on_confirmation && business.twilio_enabled && business.twilio_phone_number) {
      try {
        await supabase.functions.invoke("send-booking-sms", {
          body: {
            businessId,
            bookingId: booking.id,
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
        requiresPayment: false,
        bookingCode,
        bookingId: booking.id,
        depositRequired,
        depositAmount: depositRequired ? service.deposit_amount : null,
        depositPaymentLink,
        message: "Your booking has been confirmed!"
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
