import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[stripe-create-deposit-link] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { bookingId } = await req.json();
    if (!bookingId) throw new Error("No booking ID provided");
    logStep("Received request", { bookingId });

    // Get booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from("bookings")
      .select(`
        *,
        services:service_id (name, deposit_required, deposit_amount),
        business:business_id (business_name, stripe_account_id)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }
    logStep("Booking found", { 
      bookingId: booking.id, 
      customer: booking.customer_name,
      service: booking.services?.name
    });

    // Check if service requires deposit
    if (!booking.services?.deposit_required || !booking.services?.deposit_amount) {
      throw new Error("This service does not require a deposit");
    }

    // Check if business has connected Stripe
    if (!booking.business?.stripe_account_id) {
      throw new Error("Business has not connected Stripe for payments");
    }

    const depositAmount = Number(booking.services.deposit_amount);
    const stripeAccountId = booking.business.stripe_account_id;
    logStep("Deposit details", { 
      amount: depositAmount, 
      stripeAccount: stripeAccountId 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Create a price for the deposit amount on the connected account
    const price = await stripe.prices.create({
      currency: "gbp",
      unit_amount: Math.round(depositAmount * 100), // Convert to pence
      product_data: {
        name: `Deposit for ${booking.services.name}`,
      },
    }, {
      stripeAccount: stripeAccountId,
    });
    logStep("Price created", { priceId: price.id });

    // Create a Payment Link (generates short URLs like buy.stripe.com/xxx)
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        booking_id: bookingId,
        booking_code: booking.booking_code,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
      },
    }, {
      stripeAccount: stripeAccountId,
    });

    logStep("Payment Link created", { paymentLinkId: paymentLink.id, url: paymentLink.url });

    // Store the payment link on the booking
    const { error: updateError } = await supabaseClient
      .from("bookings")
      .update({
        deposit_payment_link: paymentLink.url,
        deposit_amount: depositAmount,
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Failed to update booking with payment link:", updateError);
    }

    return new Response(JSON.stringify({ 
      url: paymentLink.url,
      payment_link_id: paymentLink.id,
      deposit_amount: depositAmount,
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
