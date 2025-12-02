import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StaffWelcomeRequest {
  staffEmail: string;
  staffName?: string;
  businessName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-staff-welcome function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    console.log("Environment check:", {
      hasResendKey: !!resendApiKey,
      hasFromEmail: !!resendFromEmail,
    });

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    if (!resendFromEmail) {
      throw new Error("RESEND_FROM_EMAIL is not configured");
    }

    const { staffEmail, staffName, businessName }: StaffWelcomeRequest = await req.json();
    console.log("Request data:", { staffEmail, staffName, businessName });

    const resend = new Resend(resendApiKey);
    const displayName = staffName || staffEmail;
    const inviteLink = "https://aiviaapp.co.uk/staff/invite";

    const emailResponse = await resend.emails.send({
      from: resendFromEmail,
      to: [staffEmail],
      subject: `You've been invited to join ${businessName} on Aivia`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5; margin-bottom: 24px;">Welcome to ${businessName}!</h1>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">Hi ${displayName},</p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            You've been invited to join <strong>${businessName}</strong> on Aivia as a staff member.
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            To complete your setup, please:
          </p>
          
          <ol style="font-size: 16px; color: #374151; line-height: 1.8;">
            <li>Ask your manager for your <strong>staff join code</strong></li>
            <li>Visit the link below to create your password and enter the code</li>
          </ol>
          
          <div style="margin: 32px 0;">
            <a href="${inviteLink}" 
               style="display: inline-block; padding: 14px 28px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
              Complete Your Setup
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6B7280; line-height: 1.6;">
            Or copy and paste this link into your browser:<br/>
            <a href="${inviteLink}" style="color: #4F46E5;">${inviteLink}</a>
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6; margin-top: 24px;">
            Once you've completed the signup, your access will be pending approval by the business owner.
          </p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
          
          <p style="font-size: 14px; color: #9CA3AF;">
            Best regards,<br/>
            The Aivia Team
          </p>
        </div>
      `,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-staff-welcome function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
