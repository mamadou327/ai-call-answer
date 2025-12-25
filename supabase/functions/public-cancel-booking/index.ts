import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[CANCEL-BOOKING] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bookingId, businessSlug } = await req.json();

    logStep("Cancelling booking", { bookingId, businessSlug });

    if (!bookingId || !businessSlug) {
      return new Response(
        JSON.stringify({ error: "Booking ID and business slug are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, sms_on_cancellation, twilio_enabled")
      .eq("booking_slug", businessSlug)
      .eq("online_booking_enabled", true)
      .eq("status", "approved")
      .single();

    if (businessError || !business) {
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business settings
    const { data: settings } = await supabase
      .from("business_settings")
      .select("min_cancellation_notice_hours")
      .eq("business_id", business.id)
      .single();

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed"])
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found or already cancelled" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cancellation notice policy
    const now = new Date();
    const startTime = new Date(booking.start_time);
    const hoursUntilBooking = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const minNotice = settings?.min_cancellation_notice_hours || 24;

    if (hoursUntilBooking < minNotice) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot cancel within ${minNotice} hours of appointment. Your booking is in ${Math.round(hoursUntilBooking)} hours.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      logStep("Error updating booking", { error: updateError });
      return new Response(
        JSON.stringify({ error: "Failed to cancel booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Booking cancelled successfully", { bookingId });

    // Send cancellation SMS if enabled
    if (business.sms_on_cancellation && business.twilio_enabled) {
      try {
        await supabase.functions.invoke("send-booking-sms", {
          body: {
            bookingId,
            type: "cancellation",
          },
        });
        logStep("Cancellation SMS sent");
      } catch (smsError) {
        logStep("Failed to send cancellation SMS", { error: smsError });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Booking cancelled successfully"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
