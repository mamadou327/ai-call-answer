import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBookingSmsRequest {
  businessId: string;
  bookingId: string;
  type: "confirmation" | "cancellation" | "reminder";
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { businessId, bookingId, type }: SendBookingSmsRequest = await req.json();

    console.log(`[send-booking-sms] Processing ${type} SMS for booking ${bookingId}`);

    // Fetch business details
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      console.error("Business not found:", businessError);
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if SMS is enabled for this type
    const smsEnabled = 
      (type === "confirmation" && business.sms_on_confirmation) ||
      (type === "cancellation" && business.sms_on_cancellation) ||
      (type === "reminder" && business.sms_on_reminder);

    if (!smsEnabled) {
      console.log(`[send-booking-sms] SMS for ${type} is disabled for business ${businessId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "SMS disabled for this type" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!business.twilio_enabled || !business.twilio_phone_number) {
      console.log(`[send-booking-sms] Twilio not configured for business ${businessId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "Twilio not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking details with service and staff
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        services:service_id (name, duration_minutes, price),
        staff:staff_id (name)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Booking not found:", bookingError);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking.customer_phone) {
      console.log(`[send-booking-sms] No customer phone for booking ${bookingId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "No customer phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business settings for currency
    const { data: settings } = await supabase
      .from("business_settings")
      .select("currency")
      .eq("business_id", businessId)
      .single();

    const currency = settings?.currency || "GBP";
    const currencySymbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

    // Format booking details
    const startTime = new Date(booking.start_time);
    const dateStr = startTime.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const timeStr = startTime.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const serviceName = booking.services?.name || "Service";
    const duration = booking.services?.duration_minutes || 0;
    const price = booking.services?.price || 0;
    const staffName = booking.staff?.name || "A member of our team";
    const bookingCode = booking.booking_code || "";

    // Build SMS message based on type
    let message = "";

    if (type === "confirmation") {
      message = `✅ Booking Confirmed

Hi ${booking.customer_name},

Your appointment at ${business.business_name} is confirmed!

📅 ${dateStr}
⏰ ${timeStr}
💇 ${serviceName} (${duration} mins)
💰 ${currencySymbol}${price}
👤 With: ${staffName}
📍 ${business.address}

Booking ref: ${bookingCode}

To cancel or reschedule, please call us on ${business.main_phone}.

See you soon!
${business.business_name}`;
    } else if (type === "cancellation") {
      message = `❌ Booking Cancelled

Hi ${booking.customer_name},

Your appointment at ${business.business_name} has been cancelled.

Original booking:
📅 ${dateStr}
⏰ ${timeStr}
💇 ${serviceName}

Booking ref: ${bookingCode}

To rebook, please call us on ${business.main_phone} or visit our website.

${business.business_name}`;
    } else if (type === "reminder") {
      message = `⏰ Appointment Reminder

Hi ${booking.customer_name},

Just a reminder about your upcoming appointment at ${business.business_name}!

📅 ${dateStr}
⏰ ${timeStr}
💇 ${serviceName} (${duration} mins)
💰 ${currencySymbol}${price}
👤 With: ${staffName}
📍 ${business.address}

Booking ref: ${bookingCode}

If you need to cancel or reschedule, please call us on ${business.main_phone}.

See you soon!
${business.business_name}`;
    }

    // Send SMS via Twilio
    console.log(`[send-booking-sms] Sending ${type} SMS to ${booking.customer_phone} via Twilio`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append("To", booking.customer_phone.replace(/\s/g, ""));
    formData.append("From", business.twilio_phone_number);
    formData.append("Body", message);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("[send-booking-sms] Twilio API error:", responseData);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: responseData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-booking-sms] SMS sent successfully via Twilio:`, responseData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: responseData.sid,
        type,
        recipient: booking.customer_phone 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-booking-sms] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
