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
    let html = "";

    const baseStyles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
        .detail-label { color: #6b7280; width: 120px; }
        .detail-value { color: #111827; font-weight: 500; }
        .footer { background: #f3f4f6; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 14px; color: #6b7280; }
        .booking-code { background: #eef2ff; color: #4f46e5; padding: 8px 16px; border-radius: 6px; font-family: monospace; font-size: 16px; }
        .cta { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
      </style>
    `;

    if (type === "confirmation") {
      subject = `✅ Booking Confirmed - ${business.business_name}`;
      html = `
        ${baseStyles}
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">Booking Confirmed!</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Your appointment is all set</p>
          </div>
          <div class="content">
            <p>Hi ${booking.customer_name},</p>
            <p>Great news! Your appointment at <strong>${business.business_name}</strong> has been confirmed.</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">📅 Date</span>
                <span class="detail-value">${dateStr}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⏰ Time</span>
                <span class="detail-value">${timeStr}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💇 Service</span>
                <span class="detail-value">${serviceName} (${duration} mins)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💰 Price</span>
                <span class="detail-value">${currencySymbol}${price}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 With</span>
                <span class="detail-value">${staffName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📍 Location</span>
                <span class="detail-value">${business.address}</span>
              </div>
            </div>
            
            <p style="text-align: center;">
              <span class="detail-label">Booking Reference:</span><br>
              <span class="booking-code">${bookingCode}</span>
            </p>
            
            <p style="font-size: 14px; color: #6b7280;">
              Need to cancel or reschedule? Please call us on <strong>${business.main_phone}</strong>
            </p>
          </div>
          <div class="footer">
            <p>See you soon! 👋</p>
            <p><strong>${business.business_name}</strong></p>
          </div>
        </div>
      `;
    } else if (type === "cancellation") {
      subject = `❌ Booking Cancelled - ${business.business_name}`;
      html = `
        ${baseStyles}
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);">
            <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Your appointment has been cancelled</p>
          </div>
          <div class="content">
            <p>Hi ${booking.customer_name},</p>
            <p>Your appointment at <strong>${business.business_name}</strong> has been cancelled.</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">📅 Date</span>
                <span class="detail-value">${dateStr}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⏰ Time</span>
                <span class="detail-value">${timeStr}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💇 Service</span>
                <span class="detail-value">${serviceName}</span>
              </div>
            </div>
            
            <p style="text-align: center;">
              <span class="detail-label">Booking Reference:</span><br>
              <span class="booking-code">${bookingCode}</span>
            </p>
            
            <p>We'd love to see you again! To rebook, please call us on <strong>${business.main_phone}</strong>.</p>
          </div>
          <div class="footer">
            <p><strong>${business.business_name}</strong></p>
          </div>
        </div>
      `;
    } else if (type === "reminder") {
      subject = `⏰ Appointment Reminder - ${business.business_name}`;
      html = `
        ${baseStyles}
        <div class="container">
          <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
            <h1 style="margin: 0; font-size: 24px;">Appointment Reminder</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Don't forget your upcoming appointment!</p>
          </div>
          <div class="content">
            <p>Hi ${booking.customer_name},</p>
            <p>Just a friendly reminder about your upcoming appointment at <strong>${business.business_name}</strong>!</p>
            
            <div class="details">
              <div class="detail-row">
                <span class="detail-label">📅 Date</span>
                <span class="detail-value">${dateStr}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">⏰ Time</span>
                <span class="detail-value">${timeStr}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💇 Service</span>
                <span class="detail-value">${serviceName} (${duration} mins)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">💰 Price</span>
                <span class="detail-value">${currencySymbol}${price}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">👤 With</span>
                <span class="detail-value">${staffName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">📍 Location</span>
                <span class="detail-value">${business.address}</span>
              </div>
            </div>
            
            <p style="text-align: center;">
              <span class="detail-label">Booking Reference:</span><br>
              <span class="booking-code">${bookingCode}</span>
            </p>
            
            <p style="font-size: 14px; color: #6b7280;">
              If you need to cancel or reschedule, please call us on <strong>${business.main_phone}</strong>
            </p>
          </div>
          <div class="footer">
            <p>See you soon! 👋</p>
            <p><strong>${business.business_name}</strong></p>
          </div>
        </div>
      `;
    }

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
      const internalSubject = `📩 Booking ${type} - ${business.business_name}`;
      const internalHtml = `
        ${baseStyles}
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px;">Booking ${type}</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Internal notification</p>
          </div>
          <div class="content">
            <div class="details">
              <div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">${booking.customer_name} (${booking.customer_phone || ""})</span></div>
              <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${dateStr}</span></div>
              <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${timeStr}</span></div>
              <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${serviceName} (${duration} mins)</span></div>
              <div class="detail-row"><span class="detail-label">Staff</span><span class="detail-value">${staffName}</span></div>
              <div class="detail-row"><span class="detail-label">Ref</span><span class="detail-value">${bookingCode}</span></div>
            </div>
          </div>
          <div class="footer">
            <p><strong>${business.business_name}</strong></p>
          </div>
        </div>
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
