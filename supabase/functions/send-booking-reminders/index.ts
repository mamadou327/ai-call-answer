import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const messagebirdApiKey = Deno.env.get("MESSAGEBIRD_API_KEY");

    if (!messagebirdApiKey) {
      console.log("[send-booking-reminders] MESSAGEBIRD_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find bookings starting in approximately 2 hours (between 1h50m and 2h10m from now)
    // This gives a 20-minute window to catch bookings even if cron runs slightly off schedule
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + 110 * 60 * 1000); // 1h50m
    const reminderWindowEnd = new Date(now.getTime() + 130 * 60 * 1000);   // 2h10m

    console.log(`[send-booking-reminders] Checking for bookings between ${reminderWindowStart.toISOString()} and ${reminderWindowEnd.toISOString()}`);

    // Get all businesses with SMS reminders enabled
    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("id, business_name, address, main_phone, messagebird_enabled, messagebird_phone_number, sms_on_reminder")
      .eq("messagebird_enabled", true)
      .eq("sms_on_reminder", true);

    if (businessesError) {
      console.error("[send-booking-reminders] Error fetching businesses:", businessesError);
      throw businessesError;
    }

    if (!businesses || businesses.length === 0) {
      console.log("[send-booking-reminders] No businesses with SMS reminders enabled");
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No businesses with SMS reminders enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessIds = businesses.map(b => b.id);
    const businessMap = new Map(businesses.map(b => [b.id, b]));

    // Find bookings needing reminders
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        *,
        services:service_id (name, duration_minutes, price),
        staff:staff_id (name)
      `)
      .in("business_id", businessIds)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .gte("start_time", reminderWindowStart.toISOString())
      .lte("start_time", reminderWindowEnd.toISOString())
      .not("customer_phone", "is", null)
      .neq("customer_phone", "");

    if (bookingsError) {
      console.error("[send-booking-reminders] Error fetching bookings:", bookingsError);
      throw bookingsError;
    }

    if (!bookings || bookings.length === 0) {
      console.log("[send-booking-reminders] No bookings need reminders");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-booking-reminders] Found ${bookings.length} bookings needing reminders`);

    // Get business settings for currency
    const { data: settingsData } = await supabase
      .from("business_settings")
      .select("business_id, currency")
      .in("business_id", businessIds);

    const settingsMap = new Map(settingsData?.map(s => [s.business_id, s]) || []);

    let sentCount = 0;
    const errors: string[] = [];

    for (const booking of bookings) {
      const business = businessMap.get(booking.business_id);
      if (!business || !business.messagebird_phone_number) continue;

      const settings = settingsMap.get(booking.business_id);
      const currency = settings?.currency || "GBP";
      const currencySymbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

      const startTime = new Date(booking.start_time);
      const dateStr = startTime.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
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

      const message = `⏰ Reminder: Your appointment is in 2 hours!

Hi ${booking.customer_name},

Your appointment at ${business.business_name}:

📅 ${dateStr}
⏰ ${timeStr}
💇 ${serviceName} (${duration} mins)
💰 ${currencySymbol}${price}
👤 With: ${staffName}
📍 ${business.address}

Ref: ${bookingCode}

Need to cancel? Call ${business.main_phone}

See you soon!
${business.business_name}`;

      try {
        const response = await fetch("https://rest.messagebird.com/messages", {
          method: "POST",
          headers: {
            "Authorization": `AccessKey ${messagebirdApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            originator: business.messagebird_phone_number,
            recipients: [booking.customer_phone.replace(/\s/g, "")],
            body: message,
          }),
        });

        const responseData = await response.json();

        if (response.ok) {
          // Mark reminder as sent
          await supabase
            .from("bookings")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", booking.id);

          console.log(`[send-booking-reminders] Sent reminder for booking ${booking.id}`);
          sentCount++;
        } else {
          console.error(`[send-booking-reminders] Failed to send reminder for ${booking.id}:`, responseData);
          errors.push(`Booking ${booking.id}: ${responseData.errors?.[0]?.description || "Unknown error"}`);
        }
      } catch (err: any) {
        console.error(`[send-booking-reminders] Error sending reminder for ${booking.id}:`, err);
        errors.push(`Booking ${booking.id}: ${err.message}`);
      }
    }

    console.log(`[send-booking-reminders] Completed. Sent: ${sentCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount, 
        total: bookings.length,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-booking-reminders] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
