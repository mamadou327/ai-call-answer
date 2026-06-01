import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[CANCEL-BOOKING] ${step}`, details ? JSON.stringify(details) : "");
};

// Simple in-memory rate limiting (per function instance)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 10; // max requests per minute per IP
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    
    if (!checkRateLimit(clientIp)) {
      logStep("Rate limit exceeded", { clientIp });
      return new Response(
        JSON.stringify({ error: "Too many requests. Please try again in a minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bookingId, businessSlug, bookingCode } = await req.json();

    logStep("Cancelling booking", { bookingId, businessSlug, hasBookingCode: !!bookingCode });

    // SECURITY: Require booking code for verification
    if (!bookingId || !businessSlug || !bookingCode) {
      return new Response(
        JSON.stringify({ error: "Booking ID, business slug, and booking code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, sms_on_cancellation, twilio_enabled, booking_slug")
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
      .select("min_cancellation_notice_hours, notification_email, timezone")
      .eq("business_id", business.id)
      .single();

    // SECURITY: Fetch booking with booking code verification
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, service:services(name)")
      .eq("id", bookingId)
      .eq("booking_code", bookingCode.toUpperCase())
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed"])
      .single();

    if (bookingError || !booking) {
      logStep("Booking verification failed", { bookingId, bookingCode: bookingCode?.slice(0, 4) });
      return new Response(
        JSON.stringify({ error: "Booking not found or verification failed" }),
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
            businessId: business.id,
            bookingId,
            type: "cancellation",
          },
        });
        logStep("Cancellation SMS sent");
      } catch (smsError) {
        logStep("Failed to send cancellation SMS", { error: smsError });
      }
    }

    // Notify business owner by email
    const ownerEmail = settings?.notification_email;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (ownerEmail && resendApiKey) {
      try {
        const tz = settings?.timezone || "UTC";
        const fmt = new Intl.DateTimeFormat("en-GB", {
          dateStyle: "full", timeStyle: "short", timeZone: tz,
        });
        const when = fmt.format(startTime);
        const serviceName = booking.service?.name || "appointment";
        const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
        const html = `
          <p>Hi,</p>
          <p><strong>${booking.customer_name || "A client"}</strong> has cancelled their <strong>${serviceName}</strong> appointment on <strong>${when}</strong>.</p>
          <p>Their booking code was <strong>${booking.booking_code}</strong>.</p>
          <p>— ${business.business_name}</p>
        `;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [ownerEmail],
            subject: `Booking cancelled — ${booking.customer_name || "Client"} (${booking.booking_code})`,
            html,
          }),
        });
        logStep("Owner cancellation email sent", { ownerEmail });
      } catch (emailError) {
        logStep("Failed to send owner cancellation email", { error: String(emailError) });
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
