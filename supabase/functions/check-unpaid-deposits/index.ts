import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-UNPAID-DEPOSITS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const { data: cronSecret } = await adminClient.rpc("get_cron_secret");
  if (!provided || !cronSecret || provided !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });

    // Get all unpaid deposit bookings with payment links
    const { data: unpaidBookings, error: fetchError } = await supabaseClient
      .from("bookings")
      .select(`
        id, booking_code, deposit_amount, deposit_payment_link,
        business:businesses(stripe_account_id)
      `)
      .eq("payment_status", "unpaid")
      .not("deposit_payment_link", "is", null)
      .gt("deposit_amount", 0)
      .neq("status", "cancelled");

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`);
    }

    logStep("Found unpaid bookings", { count: unpaidBookings?.length || 0 });

    if (!unpaidBookings || unpaidBookings.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No unpaid deposit bookings to check",
        checked: 0,
        updated: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Group bookings by Stripe account
    const bookingsByAccount: Record<string, typeof unpaidBookings> = {};
    for (const booking of unpaidBookings) {
      const business = booking.business as unknown as { stripe_account_id: string } | null;
      const accountId = business?.stripe_account_id;
      if (accountId) {
        if (!bookingsByAccount[accountId]) {
          bookingsByAccount[accountId] = [];
        }
        bookingsByAccount[accountId].push(booking);
      }
    }

    let totalUpdated = 0;

    // Process each Stripe account
    for (const [stripeAccountId, bookings] of Object.entries(bookingsByAccount)) {
      logStep("Processing account", { stripeAccountId, bookingCount: bookings.length });

      // Get recent paid checkout sessions for this account
      const sessions = await stripe.checkout.sessions.list(
        { limit: 100, expand: ['data.payment_intent'] },
        { stripeAccount: stripeAccountId }
      );

      const paidSessions = sessions.data.filter((s: { payment_status: string }) => s.payment_status === "paid");
      logStep("Found paid sessions", { count: paidSessions.length });

      // For each paid session, check if it matches any of our unpaid bookings
      for (const session of paidSessions) {
        if (!session.payment_link) continue;

        // Get the payment link metadata
        try {
          const paymentLink = await stripe.paymentLinks.retrieve(
            session.payment_link as string,
            { stripeAccount: stripeAccountId }
          );

          const bookingId = paymentLink.metadata?.booking_id;
          if (!bookingId) continue;

          // Check if this booking is in our unpaid list
          const matchingBooking = bookings.find(b => b.id === bookingId);
          if (!matchingBooking) continue;

          logStep("Found paid booking!", { bookingId, bookingCode: matchingBooking.booking_code });

          // Get booking details for conflict check
          const { data: bookingDetails } = await supabaseClient
            .from("bookings")
            .select("staff_id, start_time, end_time, business_id, status")
            .eq("id", bookingId)
            .single();

          if (!bookingDetails) {
            logStep("Booking not found", { bookingId });
            continue;
          }

          // Skip if already confirmed
          if (bookingDetails.status === "confirmed" || bookingDetails.status === "completed") {
            logStep("Booking already confirmed, skipping", { bookingId });
            continue;
          }

          // Check for conflicts with other confirmed/completed bookings
          const { data: conflictingBookings } = await supabaseClient
            .from("bookings")
            .select("id")
            .eq("business_id", bookingDetails.business_id)
            .eq("staff_id", bookingDetails.staff_id)
            .in("status", ["confirmed", "completed"])
            .neq("id", bookingId)
            .lt("start_time", bookingDetails.end_time)
            .gt("end_time", bookingDetails.start_time);

          if (conflictingBookings && conflictingBookings.length > 0) {
            logStep("Conflict detected - another booking was confirmed first", { bookingId });
            // Mark as cancelled
            await supabaseClient
              .from("bookings")
              .update({
                status: "cancelled",
                cancelled_at: new Date().toISOString(),
                notes: "Auto-cancelled: Time slot was confirmed by another customer before payment completed."
              })
              .eq("id", bookingId);
            continue;
          }

          const amountPaid = session.amount_total ? session.amount_total / 100 : matchingBooking.deposit_amount;

          // Update the booking - also set status to confirmed
          const { error: updateError } = await supabaseClient
            .from("bookings")
            .update({
              status: "confirmed",
              payment_status: "deposit_paid",
              deposit_paid_at: new Date().toISOString(),
              deposit_amount: amountPaid,
              stripe_payment_intent_id: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id
            })
            .eq("id", bookingId);

          if (updateError) {
            logStep("Failed to update booking", { bookingId, error: updateError.message });
          } else {
            totalUpdated++;
            logStep("Updated booking", { bookingId, amountPaid });
          }
        } catch (err) {
          logStep("Error processing payment link", { error: String(err) });
        }
      }
    }

    logStep("Completed", { checked: unpaidBookings.length, updated: totalUpdated });

    return new Response(JSON.stringify({ 
      success: true, 
      checked: unpaidBookings.length,
      updated: totalUpdated
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