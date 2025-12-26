import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, tl-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TRUELAYER-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the TL-Signature header for verification
    const tlSignature = req.headers.get("tl-signature");
    const rawBody = await req.text();
    
    logStep("Webhook received", { 
      hasSignature: !!tlSignature,
      bodyLength: rawBody.length 
    });

    // Parse the webhook payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      logStep("Failed to parse webhook body", { error: parseError });
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventType = payload.type;
    const paymentId = payload.payment_id || payload.id;
    
    logStep("Processing webhook", { eventType, paymentId });

    // Handle different event types
    switch (eventType) {
      case "payment_executed":
      case "payment_settled": {
        // Payment was successful - confirm the booking
        const metadata = payload.metadata || {};
        const bookingIds = metadata.booking_ids?.split(",").filter(Boolean) || [];
        const bookingCodes = metadata.booking_codes?.split(",").filter(Boolean) || [];
        const businessId = metadata.business_id;

        logStep("Payment successful", { bookingIds, bookingCodes, businessId });

        if (bookingIds.length > 0) {
          // Update bookings to confirmed and paid
          const { error: updateError } = await supabase
            .from("bookings")
            .update({
              status: "confirmed",
              payment_status: "deposit_paid",
              deposit_paid_at: new Date().toISOString(),
            })
            .in("id", bookingIds);

          if (updateError) {
            logStep("Failed to update bookings", { error: updateError });
          } else {
            logStep("Bookings confirmed", { bookingIds });

            // Send confirmation SMS for each booking
            for (const bookingId of bookingIds) {
              try {
                await supabase.functions.invoke("send-booking-sms", {
                  body: {
                    businessId,
                    bookingId,
                    type: "confirmation",
                  },
                });
                logStep("Confirmation SMS sent", { bookingId });
              } catch (smsError: any) {
                logStep("Failed to send SMS", { bookingId, error: smsError?.message });
              }
            }
          }
        } else if (bookingCodes.length > 0) {
          // Try to find bookings by code if IDs not available
          const { data: bookings, error: lookupError } = await supabase
            .from("bookings")
            .select("id, business_id")
            .in("booking_code", bookingCodes);

          if (!lookupError && bookings && bookings.length > 0) {
            const ids = bookings.map(b => b.id);
            const { error: updateError } = await supabase
              .from("bookings")
              .update({
                status: "confirmed",
                payment_status: "deposit_paid",
                deposit_paid_at: new Date().toISOString(),
              })
              .in("id", ids);

            if (!updateError) {
              logStep("Bookings confirmed by code", { bookingCodes });

              // Send confirmation SMS
              for (const booking of bookings) {
                try {
                  await supabase.functions.invoke("send-booking-sms", {
                    body: {
                      businessId: booking.business_id,
                      bookingId: booking.id,
                      type: "confirmation",
                    },
                  });
                } catch (smsError: any) {
                  logStep("Failed to send SMS", { error: smsError?.message });
                }
              }
            }
          }
        }

        break;
      }

      case "payment_failed": {
        // Payment failed - log and optionally notify
        const metadata = payload.metadata || {};
        const bookingIds = metadata.booking_ids?.split(",").filter(Boolean) || [];
        const failureReason = payload.failure_reason || "Unknown";

        logStep("Payment failed", { bookingIds, failureReason });

        // Keep bookings as pending - user can retry
        break;
      }

      case "payment_authorization_required": {
        // Customer needs to authorize - this is expected during the flow
        logStep("Payment awaiting authorization", { paymentId });
        break;
      }

      default:
        logStep("Unhandled event type", { eventType });
    }

    return new Response(
      JSON.stringify({ received: true }),
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
