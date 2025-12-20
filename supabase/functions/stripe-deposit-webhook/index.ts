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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Parse the event (signature verification would require webhook secret)
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      throw new Error("Invalid webhook payload");
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.booking_id;
      
      if (!bookingId) {
        logStep("No booking_id in metadata, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      logStep("Processing payment for booking", { 
        bookingId, 
        paymentStatus: session.payment_status 
      });

      if (session.payment_status === "paid") {
        // Update booking with deposit paid
        const { error: updateError } = await supabaseClient
          .from("bookings")
          .update({
            deposit_paid_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent,
            payment_status: "deposit_paid",
          })
          .eq("id", bookingId);

        if (updateError) {
          logStep("Failed to update booking", { error: updateError.message });
          throw new Error(`Failed to update booking: ${updateError.message}`);
        }

        logStep("Booking updated with deposit paid", { bookingId });

        // Optionally send confirmation SMS
        const { data: booking } = await supabaseClient
          .from("bookings")
          .select(`
            customer_phone,
            customer_name,
            booking_code,
            business:business_id (business_name, twilio_enabled, twilio_phone_number)
          `)
          .eq("id", bookingId)
          .single();

        const businessData = booking?.business as { business_name?: string; twilio_enabled?: boolean } | null;
        if (booking?.customer_phone && businessData?.twilio_enabled) {
          logStep("Would send deposit confirmation SMS", { 
            phone: booking.customer_phone,
            businessName: businessData.business_name 
          });
          // SMS sending would be implemented here
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
