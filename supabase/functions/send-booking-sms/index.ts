import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBookingSmsRequest {
  businessId: string;
  bookingId: string;
  type: "confirmation" | "cancellation" | "reminder" | "reschedule";
}

const normalizePhoneToE164 = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // Guard against common placeholders or non-numbers coming from voice/chat
  if (
    trimmed.includes("[") ||
    trimmed.includes("]") ||
    lower.includes("use existing") ||
    lower.includes("existing phone") ||
    lower.includes("phone number") ||
    lower === "unknown"
  ) {
    return null;
  }

  let cleaned = trimmed.replace(/[^\d+]/g, "");

  // Convert 00-prefix to +
  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;

  // If digits-only, try assuming it's already an international number
  if (!cleaned.startsWith("+") && /^\d{10,15}$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }

  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
  return null;
};

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

    // Check if SMS is enabled for this type (reschedule uses confirmation setting)
    const smsEnabled = 
      (type === "confirmation" && business.sms_on_confirmation) ||
      (type === "reschedule" && business.sms_on_confirmation) ||
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

    const directPhone = normalizePhoneToE164(booking.customer_phone);
    let recipientPhone = directPhone;

    // Fallback: if booking has placeholder/invalid phone, try to recover from call logs
    if (!recipientPhone) {
      const [{ data: callLog }, { data: callConvo }] = await Promise.all([
        supabase
          .from("calls_log")
          .select("caller_phone")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("call_conversations")
          .select("caller_phone")
          .eq("booking_id", bookingId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      recipientPhone =
        normalizePhoneToE164(callLog?.caller_phone) ||
        normalizePhoneToE164(callConvo?.caller_phone) ||
        null;
    }

    if (!recipientPhone) {
      console.log(
        `[send-booking-sms] Invalid/missing customer phone for booking ${bookingId}:`,
        booking.customer_phone
      );
      return new Response(
        JSON.stringify({ success: false, reason: "Invalid or missing customer phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use recovered/normalized phone going forward
    booking.customer_phone = recipientPhone;

    // Backfill the booking record to avoid future failures
    if (!directPhone || directPhone !== recipientPhone) {
      const { error: backfillError } = await supabase
        .from("bookings")
        .update({ customer_phone: recipientPhone })
        .eq("id", bookingId);

      if (backfillError) {
        console.warn("[send-booking-sms] Failed to backfill booking customer_phone:", backfillError);
      }
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
👤 With: ${staffName}
📍 ${business.address}

Booking ref: ${bookingCode}

To cancel or reschedule, please call us on ${business.main_phone}.

See you soon!
${business.business_name}

Reply POLICIES for booking terms.`;
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
👤 With: ${staffName}
📍 ${business.address}

Booking ref: ${bookingCode}

If you need to cancel or reschedule, please call us on ${business.main_phone}.

See you soon!
${business.business_name}`;
    } else if (type === "reschedule") {
      message = `📅 Booking Rescheduled

Hi ${booking.customer_name},

Your appointment at ${business.business_name} has been rescheduled!

NEW DATE & TIME:
📅 ${dateStr}
⏰ ${timeStr}
💇 ${serviceName} (${duration} mins)
👤 With: ${staffName}
📍 ${business.address}

Booking ref: ${bookingCode}

To cancel or reschedule again, please call us on ${business.main_phone}.

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
