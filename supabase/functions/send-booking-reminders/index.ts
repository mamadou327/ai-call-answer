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

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all businesses with SMS reminders enabled (Twilio only)
    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select("*")
      .eq("sms_on_reminder", true);

    if (businessesError) {
      console.error("[send-booking-reminders] Error fetching businesses:", businessesError);
      throw businessesError;
    }

    // Filter to businesses with Twilio configured
    const eligibleBusinesses = businesses?.filter(b =>
      b.twilio_enabled && b.twilio_phone_number
    ) || [];

    if (eligibleBusinesses.length === 0) {
      console.log("[send-booking-reminders] No businesses with SMS reminders enabled");
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No businesses with SMS reminders enabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business settings for custom reminder hours
    const businessIds = eligibleBusinesses.map(b => b.id);
    const { data: businessSettings } = await supabase
      .from("business_settings")
      .select("business_id, sms_reminder_hours")
      .in("business_id", businessIds);

    const settingsMap = new Map(
      (businessSettings || []).map(s => [s.business_id, s.sms_reminder_hours || 3])
    );
    const businessMap = new Map(eligibleBusinesses.map(b => [b.id, b]));

    // Find bookings needing reminders for each business
    // We check across a wider window and filter by each business's specific reminder time
    const now = new Date();
    
    // Check for bookings starting in the next 48 hours (max configurable reminder time)
    const maxWindowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select(`
        *,
        services:service_id (name, duration_minutes),
        staff:staff_id (name)
      `)
      .in("business_id", businessIds)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .gte("start_time", now.toISOString())
      .lte("start_time", maxWindowEnd.toISOString())
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

    // Filter bookings that are within their business's reminder window
    // Each business has a custom reminder time (default 3 hours)
    // We use a 30-minute window around the target time to account for cron scheduling
    const eligibleBookings = bookings.filter(booking => {
      const reminderHours = settingsMap.get(booking.business_id) || 3;
      const bookingTime = new Date(booking.start_time);
      const targetReminderTime = new Date(bookingTime.getTime() - reminderHours * 60 * 60 * 1000);
      
      // 30-minute window: 15 minutes before and 15 minutes after the target time
      const windowStart = new Date(targetReminderTime.getTime() - 15 * 60 * 1000);
      const windowEnd = new Date(targetReminderTime.getTime() + 15 * 60 * 1000);
      
      const isInWindow = now >= windowStart && now <= windowEnd;
      
      if (isInWindow) {
        console.log(`[send-booking-reminders] Booking ${booking.id} eligible: ${reminderHours}h before appointment at ${booking.start_time}`);
      }
      
      return isInWindow;
    });

    if (eligibleBookings.length === 0) {
      console.log("[send-booking-reminders] No bookings in their reminder window right now");
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-booking-reminders] Found ${eligibleBookings.length} bookings needing reminders`);

    let sentCount = 0;
    const errors: string[] = [];

    for (const booking of eligibleBookings) {
      const business = businessMap.get(booking.business_id);
      if (!business) continue;

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
      const staffName = booking.staff?.name || "A member of our team";
      const bookingCode = booking.booking_code || "";

      const message = `⏰ Appointment Reminder

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

      try {
        let sendSuccess = false;

        if (business.twilio_enabled && business.twilio_phone_number && twilioAccountSid && twilioAuthToken) {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
          const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

          const formData = new URLSearchParams();
          formData.append("To", booking.customer_phone.replace(/\s/g, ""));
          formData.append("From", business.twilio_phone_number);
          formData.append("Body", message);

          const response = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
          });

          const responseData = await response.json();

          if (response.ok) {
            console.log(`[send-booking-reminders] Twilio: Sent reminder for booking ${booking.id}, SID: ${responseData.sid}`);
            sendSuccess = true;
          } else {
            console.error(`[send-booking-reminders] Twilio error for ${booking.id}:`, responseData);
            errors.push(`Booking ${booking.id}: ${responseData.message || "Twilio error"}`);
          }
        }

        if (sendSuccess) {
          // Mark reminder as sent
          await supabase
            .from("bookings")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("id", booking.id);
          sentCount++;
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
        total: eligibleBookings.length,
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
