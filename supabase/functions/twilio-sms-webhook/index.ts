import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      console.error("[twilio-sms-webhook] Twilio credentials not configured");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse incoming Twilio SMS webhook (form data)
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = (formData.get("Body") as string || "").trim().toUpperCase();

    console.log(`[twilio-sms-webhook] Received SMS from ${from} to ${to}: "${body}"`);

    // Check if message is requesting policies
    if (body !== "POLICIES" && body !== "POLICY") {
      console.log("[twilio-sms-webhook] Message is not a POLICIES request, ignoring");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Find business by Twilio phone number
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, twilio_phone_number, main_phone")
      .eq("twilio_phone_number", to)
      .eq("twilio_enabled", true)
      .single();

    if (businessError || !business) {
      console.error("[twilio-sms-webhook] Business not found for number:", to, businessError);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    console.log(`[twilio-sms-webhook] Found business: ${business.business_name} (${business.id})`);

    // Fetch business settings for policy info
    const { data: settings } = await supabase
      .from("business_settings")
      .select("min_cancellation_notice_hours, min_reschedule_notice_hours, min_booking_notice_hours, max_days_advance, cancellation_policy")
      .eq("business_id", business.id)
      .single();

    // Build policy message
    let policyMessage = `📋 ${business.business_name} Booking Policies\n\n`;

    if (settings) {
      const policies: string[] = [];

      if (settings.min_booking_notice_hours) {
        policies.push(`• Bookings require at least ${settings.min_booking_notice_hours} hours notice`);
      }

      if (settings.max_days_advance) {
        policies.push(`• You can book up to ${settings.max_days_advance} days in advance`);
      }

      if (settings.min_cancellation_notice_hours) {
        policies.push(`• Cancellations require ${settings.min_cancellation_notice_hours} hours notice`);
      }

      if (settings.min_reschedule_notice_hours) {
        policies.push(`• Rescheduling requires ${settings.min_reschedule_notice_hours} hours notice`);
      }

      if (policies.length > 0) {
        policyMessage += policies.join("\n") + "\n\n";
      }

      if (settings.cancellation_policy) {
        // Truncate if too long for SMS
        const maxPolicyLength = 300;
        const truncatedPolicy = settings.cancellation_policy.length > maxPolicyLength
          ? settings.cancellation_policy.substring(0, maxPolicyLength) + "..."
          : settings.cancellation_policy;
        policyMessage += `${truncatedPolicy}\n\n`;
      }
    } else {
      policyMessage += "Please contact us for our booking policies.\n\n";
    }

    policyMessage += `Questions? Call us: ${business.main_phone}`;

    // Send SMS reply via Twilio
    console.log(`[twilio-sms-webhook] Sending policy SMS to ${from}`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const smsFormData = new URLSearchParams();
    smsFormData.append("To", from);
    smsFormData.append("From", to);
    smsFormData.append("Body", policyMessage);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: smsFormData.toString(),
    });

    const responseData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("[twilio-sms-webhook] Twilio API error:", responseData);
    } else {
      console.log(`[twilio-sms-webhook] Policy SMS sent successfully:`, responseData.sid);
    }

    // Return empty TwiML response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );

  } catch (error: any) {
    console.error("[twilio-sms-webhook] Error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});
