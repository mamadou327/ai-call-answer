import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-DEPOSIT-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { bookingId } = await req.json();
    if (!bookingId) {
      throw new Error("bookingId is required");
    }
    logStep("Received booking ID", { bookingId });

    // Fetch the booking with service and business info
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(`
        *,
        service:services(*),
        business:businesses(stripe_account_id)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }
    logStep("Found booking", { 
      bookingCode: booking.booking_code,
      paymentStatus: booking.payment_status,
      depositPaymentLink: booking.deposit_payment_link
    });

    // If already paid, just return the current status
    if (booking.payment_status === "deposit_paid" || booking.payment_status === "paid_in_full") {
      logStep("Booking already marked as paid");
      return new Response(JSON.stringify({ 
        success: true, 
        alreadyPaid: true,
        paymentStatus: booking.payment_status,
        depositAmount: booking.deposit_amount,
        depositPaidAt: booking.deposit_paid_at
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if business has Stripe connected
    const stripeAccountId = booking.business?.stripe_account_id;
    if (!stripeAccountId) {
      throw new Error("Business does not have Stripe connected");
    }
    logStep("Found Stripe account", { stripeAccountId });

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // If we have a payment link, try to find checkout sessions for it
    if (booking.deposit_payment_link) {
      logStep("Searching for completed checkout sessions");
      
      // Extract payment link ID from URL if it's a full URL
      let paymentLinkId = booking.deposit_payment_link;
      if (paymentLinkId.includes("/")) {
        const parts = paymentLinkId.split("/");
        paymentLinkId = parts[parts.length - 1];
      }
      
      // List checkout sessions on the connected account
      const sessions = await stripe.checkout.sessions.list(
        { 
          limit: 10,
          expand: ['data.payment_intent']
        },
        { stripeAccount: stripeAccountId }
      );
      
      logStep("Found checkout sessions", { count: sessions.data.length });

      // Find a completed session that matches our booking
      // We look for sessions with our booking_id in metadata or matching payment link
      for (const session of sessions.data) {
        logStep("Checking session", { 
          sessionId: session.id, 
          status: session.payment_status,
          metadata: session.metadata,
          paymentLink: session.payment_link
        });

        // Check if this session is for our booking (by metadata or payment link match)
        const isOurBooking = session.metadata?.booking_id === bookingId || 
                            session.payment_link === paymentLinkId;
        
        if (session.payment_status === "paid" && isOurBooking) {
          logStep("Found paid session for booking!", { sessionId: session.id });
          
          // Get the amount paid
          const amountPaid = session.amount_total ? session.amount_total / 100 : booking.service?.deposit_amount || booking.deposit_amount;
          
          // Update the booking
          const { error: updateError } = await supabaseClient
            .from("bookings")
            .update({
              payment_status: "deposit_paid",
              deposit_paid_at: new Date().toISOString(),
              deposit_amount: amountPaid,
              stripe_payment_intent_id: typeof session.payment_intent === 'string' 
                ? session.payment_intent 
                : session.payment_intent?.id
            })
            .eq("id", bookingId);

          if (updateError) {
            throw new Error(`Failed to update booking: ${updateError.message}`);
          }

          logStep("Updated booking with payment info", { amountPaid });

          return new Response(JSON.stringify({ 
            success: true, 
            paymentFound: true,
            paymentStatus: "deposit_paid",
            depositAmount: amountPaid,
            depositPaidAt: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
      
      // Also check by searching for the payment link
      if (paymentLinkId.startsWith("plink_")) {
        try {
          const sessionsForLink = await stripe.checkout.sessions.list(
            { 
              payment_link: paymentLinkId,
              limit: 5
            },
            { stripeAccount: stripeAccountId }
          );
          
          logStep("Sessions for payment link", { count: sessionsForLink.data.length });
          
          for (const session of sessionsForLink.data) {
            if (session.payment_status === "paid") {
              logStep("Found paid session via payment link", { sessionId: session.id });
              
              const amountPaid = session.amount_total ? session.amount_total / 100 : booking.service?.deposit_amount || booking.deposit_amount;
              
              const { error: updateError } = await supabaseClient
                .from("bookings")
                .update({
                  payment_status: "deposit_paid",
                  deposit_paid_at: new Date().toISOString(),
                  deposit_amount: amountPaid,
                  stripe_payment_intent_id: typeof session.payment_intent === 'string' 
                    ? session.payment_intent 
                    : session.payment_intent?.id
                })
                .eq("id", bookingId);

              if (updateError) {
                throw new Error(`Failed to update booking: ${updateError.message}`);
              }

              return new Response(JSON.stringify({ 
                success: true, 
                paymentFound: true,
                paymentStatus: "deposit_paid",
                depositAmount: amountPaid,
                depositPaidAt: new Date().toISOString()
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              });
            }
          }
        } catch (linkError) {
          logStep("Error fetching sessions by payment link", { error: String(linkError) });
        }
      }
    }

    logStep("No paid session found for this booking");
    return new Response(JSON.stringify({ 
      success: true, 
      paymentFound: false,
      message: "No completed payment found for this booking yet"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
