import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[LOOKUP-BOOKING] ${step}`, details ? JSON.stringify(details) : "");
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

    const { businessSlug, bookingCode, customerPhone } = await req.json();

    logStep("Looking up booking", { businessSlug, bookingCode, customerPhone: customerPhone?.slice(-4) });

    if (!businessSlug) {
      return new Response(
        JSON.stringify({ error: "Business slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bookingCode && !customerPhone) {
      return new Response(
        JSON.stringify({ error: "Booking code or phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name")
      .eq("booking_slug", businessSlug)
      .eq("online_booking_enabled", true)
      .eq("status", "approved")
      .single();

    if (businessError || !business) {
      logStep("Business not found", { businessSlug });
      return new Response(
        JSON.stringify({ error: "Business not found or booking not enabled" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business settings for policies
    const { data: settings } = await supabase
      .from("business_settings")
      .select("min_cancellation_notice_hours, min_reschedule_notice_hours, currency")
      .eq("business_id", business.id)
      .single();

    // Build query based on search type
    let query = supabase
      .from("bookings")
      .select(`
        id,
        booking_code,
        customer_name,
        customer_phone,
        start_time,
        end_time,
        status,
        payment_status,
        deposit_amount,
        notes,
        service:services(id, name, duration_minutes, price),
        staff:staff(id, name)
      `)
      .eq("business_id", business.id)
      .in("status", ["pending", "confirmed"]);

    if (bookingCode) {
      query = query.eq("booking_code", bookingCode.toUpperCase());
    } else if (customerPhone) {
      // Normalize phone number (remove spaces, dashes)
      const normalizedPhone = customerPhone.replace(/[\s\-\(\)]/g, "");
      query = query.ilike("customer_phone", `%${normalizedPhone.slice(-10)}`);
    }

    const { data: bookings, error: bookingsError } = await query;

    if (bookingsError) {
      logStep("Error fetching bookings", { error: bookingsError });
      return new Response(
        JSON.stringify({ error: "Failed to fetch bookings" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!bookings || bookings.length === 0) {
      logStep("No bookings found");
      return new Response(
        JSON.stringify({ error: "No bookings found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate if each booking can be cancelled/rescheduled based on notice policies
    const now = new Date();
    const bookingsWithPolicies = bookings.map((booking) => {
      const startTime = new Date(booking.start_time);
      const hoursUntilBooking = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      const canCancel = hoursUntilBooking >= (settings?.min_cancellation_notice_hours || 24);
      const canReschedule = hoursUntilBooking >= (settings?.min_reschedule_notice_hours || 24);

      return {
        ...booking,
        canCancel,
        canReschedule,
        hoursUntilBooking: Math.round(hoursUntilBooking),
        cancellationNoticeHours: settings?.min_cancellation_notice_hours || 24,
        rescheduleNoticeHours: settings?.min_reschedule_notice_hours || 24,
      };
    });

    logStep("Bookings found", { count: bookings.length });

    return new Response(
      JSON.stringify({ 
        bookings: bookingsWithPolicies,
        currency: settings?.currency || "GBP"
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
