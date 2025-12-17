import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBookingEmailRequest {
  businessId: string;
  bookingId: string;
  type: "confirmation" | "cancellation" | "reminder";
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

    if (!resendApiKey) {
      console.error("[send-booking-email] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { businessId, bookingId, type }: SendBookingEmailRequest = await req.json();
    console.log(`[send-booking-email] Processing ${type} email for booking ${bookingId}`);

    // Fetch business details
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      console.error("[send-booking-email] Business not found:", businessError);
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email notifications are enabled
    const emailEnabled = 
      (type === "confirmation" && business.email_on_confirmation) ||
      (type === "cancellation" && business.email_on_cancellation) ||
      (type === "reminder" && business.email_on_reminder);

    if (!emailEnabled) {
      console.log(`[send-booking-email] Email for ${type} is disabled for business ${businessId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "Email disabled for this type" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch booking details with service and staff
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        services:service_id (name, duration_minutes, price),
        staff:staff_id (name, email)
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("[send-booking-email] Booking not found:", bookingError);
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer email from customers table (optional)
    const { data: customer } = await supabase
      .from("customers")
      .select("email")
      .eq("business_id", businessId)
      .eq("phone", booking.customer_phone)
      .maybeSingle();

    const customerEmail = (customer?.email || "").trim() || null;

    // Fetch business settings for currency + notification email
    const { data: settings } = await supabase
      .from("business_settings")
      .select("currency, notification_email")
      .eq("business_id", businessId)
      .single();

    const notificationEmail = (settings?.notification_email || "").trim() || null;
    const staffEmail = (booking.staff?.email || "").trim() || null;

    const customerRecipients = customerEmail ? [customerEmail] : [];
    const internalRecipients = Array.from(
      new Set([notificationEmail, staffEmail].filter(Boolean))
    ) as string[];

    if (customerRecipients.length === 0 && internalRecipients.length === 0) {
      console.log(`[send-booking-email] No recipients for booking ${bookingId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "No recipients" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Build email content based on type
    let subject = "";
    let headerBg = "";
    let headerTitle = "";
    let headerSubtitle = "";
    let mainMessage = "";
    let noteBox = "";

    if (type === "confirmation") {
      subject = `Booking Confirmed - ${business.business_name}`;
      headerBg = "linear-gradient(135deg, #10b981 0%, #059669 100%)";
      headerTitle = "✓ Booking Confirmed";
      headerSubtitle = "Your appointment is all set";
      mainMessage = `Great news! Your appointment at <strong>${business.business_name}</strong> has been confirmed.`;
      noteBox = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981; margin-top: 24px;">
        <tr><td style="padding: 14px 16px;">
          <p style="margin: 0; color: #166534; font-size: 13px; line-height: 1.5;">
            📞 Need to cancel or reschedule? Call us at <strong>${business.main_phone}</strong>
          </p>
        </td></tr>
      </table>`;
    } else if (type === "cancellation") {
      subject = `Booking Cancelled - ${business.business_name}`;
      headerBg = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
      headerTitle = "✕ Booking Cancelled";
      headerSubtitle = "Your appointment has been cancelled";
      mainMessage = `Your appointment at <strong>${business.business_name}</strong> has been cancelled.`;
      noteBox = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444; margin-top: 24px;">
        <tr><td style="padding: 14px 16px;">
          <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
            💬 We'd love to see you again! Call <strong>${business.main_phone}</strong> to rebook.
          </p>
        </td></tr>
      </table>`;
    } else if (type === "reminder") {
      subject = `Reminder: Appointment Tomorrow - ${business.business_name}`;
      headerBg = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
      headerTitle = "⏰ Appointment Reminder";
      headerSubtitle = "Don't forget your upcoming visit";
      mainMessage = `Just a friendly reminder about your appointment at <strong>${business.business_name}</strong>!`;
      noteBox = `<table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b; margin-top: 24px;">
        <tr><td style="padding: 14px 16px;">
          <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
            📞 Need to reschedule? Call us at <strong>${business.main_phone}</strong>
          </p>
        </td></tr>
      </table>`;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
                
                <!-- Header -->
                <tr>
                  <td style="background: ${headerBg}; padding: 32px 40px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${headerTitle}</h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${headerSubtitle}</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px;">Hi ${booking.customer_name},</p>
                    <p style="margin: 0 0 28px; color: #4b5563; font-size: 15px; line-height: 1.7;">${mainMessage}</p>
                    
                    <!-- Booking Details Card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 12px; overflow: hidden;">
                      <tr>
                        <td style="padding: 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                <span style="color: #64748b; font-size: 13px; display: inline-block; width: 90px;">📅 Date</span>
                                <span style="color: #1e293b; font-size: 14px; font-weight: 600;">${dateStr}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                <span style="color: #64748b; font-size: 13px; display: inline-block; width: 90px;">⏰ Time</span>
                                <span style="color: #1e293b; font-size: 14px; font-weight: 600;">${timeStr}</span>
                              </td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                <span style="color: #64748b; font-size: 13px; display: inline-block; width: 90px;">✂️ Service</span>
                                <span style="color: #1e293b; font-size: 14px; font-weight: 600;">${serviceName}</span>
                                <span style="color: #64748b; font-size: 12px;"> (${duration} mins)</span>
                              </td>
                            </tr>
                            ${type !== "cancellation" ? `
                            <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                <span style="color: #64748b; font-size: 13px; display: inline-block; width: 90px;">💷 Price</span>
                                <span style="color: #1e293b; font-size: 14px; font-weight: 600;">${currencySymbol}${price}</span>
                              </td>
                            </tr>
                            ` : ""}
                            <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                                <span style="color: #64748b; font-size: 13px; display: inline-block; width: 90px;">👤 With</span>
                                <span style="color: #1e293b; font-size: 14px; font-weight: 600;">${staffName}</span>
                              </td>
                            </tr>
                            ${type !== "cancellation" ? `
                            <tr>
                              <td style="padding: 10px 0;">
                                <span style="color: #64748b; font-size: 13px; display: inline-block; width: 90px;">📍 Location</span>
                                <span style="color: #1e293b; font-size: 14px; font-weight: 600;">${business.address}</span>
                              </td>
                            </tr>
                            ` : ""}
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Booking Code -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                      <tr>
                        <td align="center">
                          <p style="margin: 0 0 8px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Booking Reference</p>
                          <p style="margin: 0; font-family: 'SF Mono', Monaco, monospace; font-size: 20px; font-weight: 700; color: #4F46E5; letter-spacing: 2px; background-color: #eef2ff; padding: 10px 20px; border-radius: 8px; display: inline-block;">
                            ${bookingCode}
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Note Box -->
                    ${noteBox}
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0 0 4px; color: #1e293b; font-size: 14px; font-weight: 600;">${business.business_name}</p>
                    <p style="margin: 0; color: #64748b; font-size: 13px;">${business.address}</p>
                    <p style="margin: 8px 0 0; color: #64748b; font-size: 13px;">📞 ${business.main_phone}</p>
                  </td>
                </tr>
                
              </table>
              
              <!-- Powered by -->
              <p style="margin: 24px 0 0; color: #94a3b8; font-size: 11px; text-align: center;">
                Powered by <a href="https://aiviaapp.co.uk" style="color: #4F46E5; text-decoration: none;">Aivia</a>
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const results: any = { success: true, type, recipients: { customer: customerRecipients, internal: internalRecipients } };

    // 1) Customer email (if we have it)
    if (customerRecipients.length > 0) {
      console.log(`[send-booking-email] Sending ${type} CUSTOMER email to ${customerRecipients.join(", ")}`);

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: `${business.business_name} <${resendFromEmail}>`,
        to: customerRecipients,
        subject,
        html,
      });

      if (emailError) {
        console.error("[send-booking-email] Resend API error (customer):", emailError);
        results.customer_error = emailError;
      } else {
        results.customer_email_id = emailData?.id;
      }
    }

    // 2) Internal notification email (business + staff)
    if (internalRecipients.length > 0) {
      const internalSubject = `Booking ${type.charAt(0).toUpperCase() + type.slice(1)} - ${booking.customer_name}`;
      const internalHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 30px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                  <tr>
                    <td style="background: ${type === "cancellation" ? "#ef4444" : type === "reminder" ? "#f59e0b" : "#4F46E5"}; padding: 20px; text-align: center;">
                      <p style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                        ${type === "confirmation" ? "New Booking" : type === "cancellation" ? "Cancelled" : "Reminder"}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><span style="color: #64748b; font-size: 12px;">Customer</span><br><span style="color: #1e293b; font-size: 14px; font-weight: 600;">${booking.customer_name}</span> <span style="color: #64748b; font-size: 13px;">${booking.customer_phone || ""}</span></td></tr>
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><span style="color: #64748b; font-size: 12px;">Date & Time</span><br><span style="color: #1e293b; font-size: 14px; font-weight: 600;">${dateStr} at ${timeStr}</span></td></tr>
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><span style="color: #64748b; font-size: 12px;">Service</span><br><span style="color: #1e293b; font-size: 14px; font-weight: 600;">${serviceName}</span> <span style="color: #64748b; font-size: 12px;">(${duration} mins)</span></td></tr>
                        <tr><td style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;"><span style="color: #64748b; font-size: 12px;">Staff</span><br><span style="color: #1e293b; font-size: 14px; font-weight: 600;">${staffName}</span></td></tr>
                        <tr><td style="padding: 8px 0;"><span style="color: #64748b; font-size: 12px;">Reference</span><br><span style="color: #4F46E5; font-size: 14px; font-weight: 600; font-family: monospace;">${bookingCode}</span></td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="background-color: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #64748b; font-size: 12px;">${business.business_name}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      console.log(`[send-booking-email] Sending ${type} INTERNAL email to ${internalRecipients.join(", ")}`);

      const { data: internalData, error: internalError } = await resend.emails.send({
        from: `${business.business_name} <${resendFromEmail}>`,
        to: internalRecipients,
        subject: internalSubject,
        html: internalHtml,
      });

      if (internalError) {
        console.error("[send-booking-email] Resend API error (internal):", internalError);
        results.internal_error = internalError;
      } else {
        results.internal_email_id = internalData?.id;
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { status: 200 as any, "Content-Type": "application/json", ...corsHeaders } as any,
    });

  } catch (error: any) {
    console.error("[send-booking-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
