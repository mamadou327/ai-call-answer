import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[RESCHEDULE-BOOKING] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bookingId, businessSlug, newStartTime } = await req.json();

    logStep("Rescheduling booking", { bookingId, businessSlug, newStartTime });

    if (!bookingId || !businessSlug || !newStartTime) {
      return new Response(
        JSON.stringify({ error: "Booking ID, business slug, and new start time are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, sms_on_confirmation, twilio_enabled")
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
      .select("min_reschedule_notice_hours")
      .eq("business_id", business.id)
      .single();

    // Fetch booking with service info
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        service:services(id, name, duration_minutes)
      `)
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

    // Check reschedule notice policy
    const now = new Date();
    const originalStartTime = new Date(booking.start_time);
    const hoursUntilBooking = (originalStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const minNotice = settings?.min_reschedule_notice_hours || 24;

    if (hoursUntilBooking < minNotice) {
      return new Response(
        JSON.stringify({ 
          error: `Cannot reschedule within ${minNotice} hours of appointment. Your booking is in ${Math.round(hoursUntilBooking)} hours.`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate new end time
    const newStart = new Date(newStartTime);
    const duration = booking.service?.duration_minutes || 60;
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    // Check availability at new time using the existing availability check function
    const { data: availabilityResult, error: availError } = await supabase.functions.invoke("public-check-availability", {
      body: {
        businessSlug,
        date: newStart.toISOString().split("T")[0],
        serviceId: booking.service_id,
        staffId: booking.staff_id,
      },
    });

    if (availError) {
      logStep("Error checking availability", { error: availError });
      return new Response(
        JSON.stringify({ error: "Failed to check availability" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if the requested time slot is available
    const requestedTimeSlot = newStart.toTimeString().slice(0, 5);
    const isSlotAvailable = availabilityResult.slots?.some(
      (slot: { time: string; available: boolean }) => 
        slot.time === requestedTimeSlot && slot.available
    );

    if (!isSlotAvailable) {
      return new Response(
        JSON.stringify({ error: "The selected time slot is not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update booking with new time
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      logStep("Error updating booking", { error: updateError });
      return new Response(
        JSON.stringify({ error: "Failed to reschedule booking" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Booking rescheduled successfully", { bookingId, newStartTime });

    // Send confirmation SMS if enabled
    if (business.sms_on_confirmation && business.twilio_enabled) {
      try {
        await supabase.functions.invoke("send-booking-sms", {
          body: {
            businessId: business.id,
            bookingId,
            type: "reschedule",
          },
        });
        logStep("Reschedule SMS sent");
      } catch (smsError) {
        logStep("Failed to send reschedule SMS", { error: smsError });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Booking rescheduled successfully",
        newStartTime: newStart.toISOString(),
        newEndTime: newEnd.toISOString(),
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
