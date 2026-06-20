import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escHtml = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escUri = (s: string | null | undefined) => encodeURIComponent(String(s ?? ""));

interface InquiryRequest {
  businessSlug: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  message: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: InquiryRequest = await req.json();
    const { businessSlug, customerName, customerEmail, customerPhone, message } = body;

    // Validate required fields
    if (!businessSlug || !customerName || !customerEmail || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input lengths
    if (customerName.length > 100 || customerEmail.length > 255 || message.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Input exceeds maximum length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, owner_id")
      .eq("booking_slug", businessSlug)
      .eq("online_booking_enabled", true)
      .single();

    if (businessError || !business) {
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business settings for notification email
    const { data: settings } = await supabase
      .from("business_settings")
      .select("notification_email")
      .eq("business_id", business.id)
      .single();

    // Get owner email as fallback
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", business.owner_id)
      .single();

    const recipientEmail = settings?.notification_email || ownerProfile?.email;

    if (!recipientEmail) {
      console.error("No recipient email found for business:", business.id);
      return new Response(
        JSON.stringify({ error: "Unable to send inquiry at this time" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert inquiry into messages table so it appears in dashboard
    const messageContent = `[Online Booking Inquiry]\n\nFrom: ${customerName}\nEmail: ${customerEmail}${customerPhone ? `\nPhone: ${customerPhone}` : ""}\n\nMessage:\n${message}`;
    
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        business_id: business.id,
        caller_name: customerName,
        caller_phone: customerEmail, // Using email as identifier since phone is optional
        content: messageContent,
        recipient_type: "all",
        is_urgent: false,
        is_read: false,
      });

    if (messageError) {
      console.error("Error inserting message:", messageError);
    } else {
      console.log("Message inserted into messages table for business:", business.id);
    }

    // Send email if Resend is configured
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);

      await resend.emails.send({
        from: "Aivia <notifications@aivia.app>",
        to: [recipientEmail],
        reply_to: customerEmail,
        subject: `New inquiry from ${customerName} - ${business.business_name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
            <table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">New Customer Inquiry</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px;">
                  <div style="background-color: #f8fafc; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #1e293b;">Contact Details</h2>
                    <p style="margin: 8px 0; color: #475569;"><strong>Name:</strong> ${customerName}</p>
                    <p style="margin: 8px 0; color: #475569;"><strong>Email:</strong> <a href="mailto:${customerEmail}" style="color: #3b82f6;">${customerEmail}</a></p>
                    ${customerPhone ? `<p style="margin: 8px 0; color: #475569;"><strong>Phone:</strong> <a href="tel:${customerPhone}" style="color: #3b82f6;">${customerPhone}</a></p>` : ""}
                  </div>
                  
                  <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 0 8px 8px 0;">
                    <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #1e40af;">Message</h3>
                    <p style="margin: 0; color: #1e293b; white-space: pre-wrap;">${message}</p>
                  </div>
                  
                  <div style="margin-top: 24px; text-align: center;">
                    <a href="mailto:${customerEmail}?subject=Re: Your inquiry to ${business.business_name}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reply to Customer</a>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8fafc; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Powered by <strong>Aivia</strong></p>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });

      console.log("Inquiry email sent successfully to:", recipientEmail);
    } else {
      console.log("RESEND_API_KEY not configured, skipping email notification");
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing inquiry:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send inquiry" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
