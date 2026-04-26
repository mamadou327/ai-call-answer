import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RejectionEmailRequest {
  businessName: string;
  ownerEmail: string;
  ownerName: string;
  reason: string;
  reapplyUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    if (!apiKey || !fromEmail) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const body: RejectionEmailRequest = await req.json();
    const { businessName, ownerEmail, ownerName, reason, reapplyUrl } = body;

    if (!ownerEmail || !businessName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const safeReason = (reason || "Your application did not meet our current criteria.")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const resend = new Resend(apiKey);

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: ownerEmail,
      subject: `Update on your Aivia application`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 10px;">Hi ${ownerName || "there"},</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Thank you for applying to Aivia with <strong>${businessName}</strong>.
            Unfortunately, we're unable to approve your application at this time.
          </p>

          <div style="margin: 20px 0; padding: 15px; background-color: #fff5f5; border-left: 4px solid #ef4444; border-radius: 4px;">
            <p style="margin: 0; color: #333;"><strong>Reason:</strong></p>
            <p style="margin: 8px 0 0 0; color: #555; white-space: pre-line;">${safeReason}</p>
          </div>

          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            You're welcome to update your details and reapply. Just sign back in and
            we'll guide you through it.
          </p>

          <p style="margin: 30px 0;">
            <a href="${reapplyUrl}"
               style="background-color: #3b82f6; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Sign in & Reapply
            </a>
          </p>

          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
            If you have any questions, just reply to this email and our team will help.
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">
            This email was sent to ${ownerEmail} regarding your Aivia application.
          </p>
        </div>
      `,
    });

    return new Response(
      JSON.stringify({ success: true, id: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("send-business-rejection-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send rejection email" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
