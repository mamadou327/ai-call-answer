import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[stripe-deposit-webhook] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Verify the webhook signature
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("No stripe-signature header found");
      return new Response(JSON.stringify({ error: "No signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("Signature verification failed", { error: errorMessage });
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      
      // Support both single booking_id and multiple booking_ids (for group bookings)
      const singleBookingId = session.metadata?.booking_id;
      const multipleBookingIds = session.metadata?.booking_ids;
      
      // Parse booking IDs - could be a single ID or comma-separated list
      let bookingIds: string[] = [];
      if (multipleBookingIds) {
        bookingIds = multipleBookingIds.split(",").map((id: string) => id.trim()).filter(Boolean);
      } else if (singleBookingId) {
        bookingIds = [singleBookingId];
      }
      
      if (bookingIds.length === 0) {
        logStep("No booking_id(s) in metadata, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      logStep("Processing payment for bookings", { 
        bookingIds, 
        count: bookingIds.length,
        paymentStatus: session.payment_status 
      });

      if (session.payment_status === "paid") {
        // Process each booking - check for conflicts before confirming
        for (const bookingId of bookingIds) {
          // Get the booking details first
          const { data: booking, error: bookingFetchError } = await supabaseClient
            .from("bookings")
            .select("staff_id, start_time, end_time, business_id, status")
            .eq("id", bookingId)
            .single();

          if (bookingFetchError || !booking) {
            logStep("Failed to fetch booking", { bookingId, error: bookingFetchError?.message });
            continue;
          }

          // If already confirmed, skip
          if (booking.status === "confirmed" || booking.status === "completed") {
            logStep("Booking already confirmed, skipping", { bookingId });
            continue;
          }

          // Check for conflicts with other confirmed/completed bookings (excluding this one)
          const { data: conflictingBookings } = await supabaseClient
            .from("bookings")
            .select("id, customer_name, start_time, end_time")
            .eq("business_id", booking.business_id)
            .eq("staff_id", booking.staff_id)
            .in("status", ["confirmed", "completed"])
            .neq("id", bookingId)
            .lt("start_time", booking.end_time)
            .gt("end_time", booking.start_time);

          if (conflictingBookings && conflictingBookings.length > 0) {
            logStep("Conflict detected - another booking confirmed first", { 
              bookingId, 
              conflictingBookingId: conflictingBookings[0].id,
              conflictingCustomer: conflictingBookings[0].customer_name
            });
            // Mark booking as cancelled due to conflict
            await supabaseClient
              .from("bookings")
              .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
                notes: `Auto-cancelled: Time slot was confirmed by another customer (${conflictingBookings[0].customer_name}) before payment completed.`
              })
              .eq("id", bookingId);
            
            // TODO: In future, trigger a refund via Stripe
            continue;
          }

          // No conflicts - confirm the booking
          const { error: updateError } = await supabaseClient
            .from("bookings")
            .update({
              status: "confirmed",
              deposit_paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent,
              payment_status: "deposit_paid",
            })
            .eq("id", bookingId);

          if (updateError) {
            logStep("Failed to update booking", { bookingId, error: updateError.message });
          } else {
            logStep("Booking updated - confirmed and deposit paid", { bookingId });
          }
        }

        // Send confirmation SMS for each successfully confirmed booking
        for (const bookingId of bookingIds) {
          const { data: booking } = await supabaseClient
            .from("bookings")
            .select(`
              customer_phone,
              customer_name,
              booking_code,
              business_id,
              status,
              business:business_id (business_name, twilio_enabled, twilio_phone_number, sms_on_confirmation)
            `)
            .eq("id", bookingId)
            .single();

          // Only send SMS if booking is confirmed (not cancelled due to conflict)
          if (booking?.status !== "confirmed") continue;

          const businessData = booking?.business as { 
            business_name?: string; 
            twilio_enabled?: boolean;
            sms_on_confirmation?: boolean;
          } | null;
          
          if (booking && businessData?.twilio_enabled && businessData?.sms_on_confirmation) {
            try {
              await supabaseClient.functions.invoke("send-booking-sms", {
                body: {
                  businessId: booking.business_id,
                  bookingId: bookingId,
                  type: "confirmation",
                },
              });
              logStep("Confirmation SMS sent after payment", { bookingCode: booking.booking_code });
            } catch (smsError: any) {
              logStep("Failed to send SMS", { bookingId, error: smsError?.message || String(smsError) });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
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
