import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      business_id,
      customer_name,
      customer_phone,
      customer_email,
      party_size,
      reservation_time,
      duration_minutes,
      special_requests,
      allergen_info,
      notes,
      call_id,
    } = body;

    if (!business_id || !customer_name || !reservation_time) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: business_id, customer_name, reservation_time" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert fallback reservation
    const { data: reservation, error: insertError } = await supabase
      .from("fallback_reservations")
      .insert({
        business_id,
        customer_name,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        party_size: party_size || 2,
        reservation_time,
        duration_minutes: duration_minutes || 90,
        special_requests: special_requests || null,
        allergen_info: allergen_info || null,
        notes: notes || null,
        call_id: call_id || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Get business details for notification
    const { data: business } = await supabase
      .from("businesses")
      .select("business_name, main_phone, reservation_platform")
      .eq("id", business_id)
      .single();

    // Get notification email
    const { data: settings } = await supabase
      .from("business_settings")
      .select("notification_email")
      .eq("business_id", business_id)
      .single();

    // Get owner email
    const { data: bizOwner } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", business_id)
      .single();

    let ownerEmail = settings?.notification_email;
    if (!ownerEmail && bizOwner?.owner_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", bizOwner.owner_id)
        .single();
      ownerEmail = profile?.email;
    }

    const platformName = {
      opentable: "OpenTable",
      sevenrooms: "SevenRooms",
      resy: "Resy",
      tock: "Tock",
      other: "your reservation system",
    }[business?.reservation_platform || "other"] || "your reservation system";

    const resDate = new Date(reservation_time);
    const dateStr = resDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = resDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    // Send SMS notification to business
    if (business?.main_phone) {
      try {
        const smsBody = `🍽️ New reservation via AIVIA - please enter in ${platformName}:\n\n` +
          `${customer_name}\n` +
          `${dateStr} at ${timeStr}\n` +
          `Party: ${party_size || 2}\n` +
          (customer_phone ? `Phone: ${customer_phone}\n` : "") +
          (special_requests ? `Requests: ${special_requests}\n` : "") +
          (allergen_info ? `⚠️ Allergies: ${allergen_info}` : "");

        // Try sending via Twilio
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
          // Get business's Twilio number
          const { data: bizData } = await supabase
            .from("businesses")
            .select("twilio_phone_number")
            .eq("id", business_id)
            .single();

          if (bizData?.twilio_phone_number) {
            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            await fetch(twilioUrl, {
              method: "POST",
              headers: {
                "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: business.main_phone,
                From: bizData.twilio_phone_number,
                Body: smsBody,
              }),
            });
          }
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
              subject: `🍽️ New reservation to enter in ${platformName} — ${customer_name}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 24px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">New Reservation — Please Enter in ${platformName}</h1>
                  </div>
                  <div style="background: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px;">
                    <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                      <h2 style="margin: 0 0 8px 0; font-size: 18px;">${customer_name}</h2>
                      <p style="margin: 4px 0; color: #6b7280;"><strong>Date:</strong> ${dateStr} at ${timeStr}</p>
                      <p style="margin: 4px 0; color: #6b7280;"><strong>Party Size:</strong> ${party_size || 2} guests</p>
                      ${customer_phone ? `<p style="margin: 4px 0; color: #6b7280;"><strong>Phone:</strong> ${customer_phone}</p>` : ""}
                      ${customer_email ? `<p style="margin: 4px 0; color: #6b7280;"><strong>Email:</strong> ${customer_email}</p>` : ""}
                    </div>
                    ${allergen_info ? `<div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; margin-bottom: 12px;"><strong style="color: #dc2626;">⚠️ Allergies:</strong> ${allergen_info}</div>` : ""}
                    ${special_requests ? `<div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 8px; margin-bottom: 12px;"><strong>Special Requests:</strong> ${special_requests}</div>` : ""}
                    <p style="color: #6b7280; font-size: 14px;">This reservation was captured by AIVIA. Please add it to ${platformName} and mark it as entered in your AIVIA dashboard.</p>
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
      .from("fallback_reservations")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", reservation.id);

    return new Response(
      JSON.stringify({ success: true, reservation }),
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
