import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[auto-cancel-unpaid-bookings] ${step}${detailsStr}`);
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

    const now = new Date();
    logStep("Current time", { now: now.toISOString() });

    // Get businesses with auto-cancel enabled (plus reminder settings)
    const { data: settings, error: settingsError } = await supabaseClient
      .from("business_settings")
      .select("business_id, auto_cancel_unpaid_bookings, auto_cancel_hours, deposit_reminder_enabled, deposit_reminder_hours, notification_email")
      .eq("auto_cancel_unpaid_bookings", true);

    if (settingsError) {
      throw new Error(`Failed to fetch settings: ${settingsError.message}`);
    }

    if (!settings || settings.length === 0) {
      logStep("No businesses with auto-cancel enabled");
      return new Response(JSON.stringify({ 
        success: true, 
        cancelled: 0, 
        reason: "No businesses with auto-cancel enabled" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found businesses with auto-cancel", { count: settings.length });

    let cancelledCount = 0;
    const errors: string[] = [];

    for (const setting of settings) {
      const cancelHours = setting.auto_cancel_hours || 12;
      const cutoffTime = new Date(now.getTime() + cancelHours * 60 * 60 * 1000);

      logStep("Processing business", { 
        businessId: setting.business_id, 
        cancelHours,
        cutoffTime: cutoffTime.toISOString()
      });

      // Find bookings that:
      // 1. Belong to this business
      // 2. Have a service that requires deposit
      // 3. Deposit is not paid
      // 4. Start time is before the cutoff
      // 5. Are confirmed (not already cancelled)
      const { data: bookings, error: bookingsError } = await supabaseClient
        .from("bookings")
        .select(`
          id,
          booking_code,
          customer_name,
          customer_phone,
          start_time,
          deposit_amount,
          deposit_paid_at,
          services:service_id (deposit_required)
        `)
        .eq("business_id", setting.business_id)
        .eq("status", "confirmed")
        .is("deposit_paid_at", null)
        .not("deposit_amount", "is", null)
        .gt("deposit_amount", 0)
        .lte("start_time", cutoffTime.toISOString())
        .gte("start_time", now.toISOString());

      if (bookingsError) {
        logStep("Error fetching bookings", { error: bookingsError.message });
        errors.push(`Business ${setting.business_id}: ${bookingsError.message}`);
        continue;
      }

      if (!bookings || bookings.length === 0) {
        logStep("No unpaid bookings to cancel for this business");
        continue;
      }

      logStep("Found unpaid bookings", { count: bookings.length });

      for (const booking of bookings) {
        // Only cancel if service requires deposit
        const serviceData = booking.services as { deposit_required?: boolean } | null;
        if (!serviceData?.deposit_required) {
          continue;
        }

        const { error: cancelError } = await supabaseClient
          .from("bookings")
          .update({
            status: "cancelled",
            cancelled_at: now.toISOString(),
            notes: (booking as any).notes 
              ? `${(booking as any).notes}\n\nAuto-cancelled: Deposit not paid`
              : "Auto-cancelled: Deposit not paid",
          })
          .eq("id", booking.id);

        if (cancelError) {
          logStep("Failed to cancel booking", { 
            bookingId: booking.id, 
            error: cancelError.message 
          });
          errors.push(`Booking ${booking.id}: ${cancelError.message}`);
        } else {
          logStep("Booking cancelled", { 
            bookingId: booking.id, 
            code: booking.booking_code 
          });
          cancelledCount++;

          // TODO: Send cancellation SMS/email notification
        }
      }
    }

    logStep("Completed", { cancelled: cancelledCount, errors: errors.length });

    return new Response(JSON.stringify({ 
      success: true, 
      cancelled: cancelledCount,
      errors: errors.length > 0 ? errors : undefined
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
