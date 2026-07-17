import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Internal-only: require shared secret
  const internalSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!internalSecret || provided !== internalSecret) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const { business_id, caller_phone, caller_name, reason, call_sid } = body;

    if (!business_id || !caller_phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: business_id, caller_phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert missed call record
    const { data: missedCall, error: insertError } = await supabase
      .from("missed_calls")
      .insert({
        business_id,
        caller_phone,
        caller_name: caller_name || null,
        reason: reason || "abandoned",
        call_sid: call_sid || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Fire push notification (best-effort)
    try {
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (cronSecret) {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": cronSecret },
          body: JSON.stringify({
            business_id,
            title: "Missed call",
            body: `Missed call from ${caller_name || caller_phone} — no booking made`,
            url: "/dashboard?tab=missed",
          }),
        });
      }
    } catch (e) {
      console.warn("[notify-missed-call] push failed:", e);
    }

    // Get business details
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name, main_phone, owner_id, twilio_phone_number")
      .eq("id", business_id)
      .single();

    if (!business) throw new Error("Business not found");

    // Get notification email
    const { data: settings } = await supabase
      .from("business_settings")
      .select("notification_email")
      .eq("business_id", business_id)
      .single();

    let ownerEmail = settings?.notification_email;
    if (!ownerEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", business.owner_id)
        .single();
      ownerEmail = profile?.email;
    }

    const reasonText = {
      abandoned: "Caller hung up before completion",
      failed: "Call failed to connect",
      no_answer: "AI did not answer in time",
      error: "An error occurred during the call",
    }[reason || "abandoned"] || reason;

    // Send SMS notification
    if (business.main_phone && business.twilio_phone_number) {
      try {
        const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
          const smsBody = `📞 Missed call alert!\n\n` +
            `From: ${caller_name || caller_phone}\n` +
            `Reason: ${reasonText}\n\n` +
            `Please call back: ${caller_phone}`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
          await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: business.main_phone,
              From: business.twilio_phone_number,
              Body: smsBody,
            }),
          });
        }
      } catch (smsError) {
        console.error("SMS notification failed:", smsError);
      }
    }

    // Send email notification
    if (ownerEmail) {
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL");
        if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: RESEND_FROM_EMAIL,
              to: [ownerEmail],
              subject: `📞 Missed Call — ${caller_name || caller_phone}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 24px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">📞 Missed Call</h1>
                  </div>
                  <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px;">
                    <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                      <p style="margin: 4px 0;"><strong>Caller:</strong> ${caller_name || "Unknown"}</p>
                      <p style="margin: 4px 0;"><strong>Phone:</strong> <a href="tel:${caller_phone}">${caller_phone}</a></p>
                      <p style="margin: 4px 0;"><strong>Reason:</strong> ${reasonText}</p>
                      <p style="margin: 4px 0;"><strong>Time:</strong> ${new Date().toLocaleString("en-GB")}</p>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Please call this person back as soon as possible. You can mark this call as "followed up" in your AIVIA dashboard.</p>
                  </div>
                </div>
              `,
            }),
          });
        }
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
      }
    }

    // Update notified status
    await supabase
      .from("missed_calls")
      .update({ notified: true, notified_at: new Date().toISOString() })
      .eq("id", missedCall.id);

    return new Response(
      JSON.stringify({ success: true, missedCall }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
