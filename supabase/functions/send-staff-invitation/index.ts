import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  staffName: string;
  staffEmail: string;
  businessName: string;
  inviteLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== STAFF INVITATION EMAIL FUNCTION STARTED ===");
  
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check environment variables
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@aiviaapp.co.uk";
    
    console.log("Environment check:");
    console.log("- RESEND_API_KEY exists:", !!apiKey);
    console.log("- RESEND_FROM_EMAIL:", fromEmail);
    
    if (!apiKey) {
      console.error("❌ RESEND_API_KEY is not set");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { staffName, staffEmail, businessName, inviteLink }: InvitationRequest = await req.json();
    console.log("Invitation details:", { staffName, staffEmail, businessName });

    console.log("Sending invitation to:", staffEmail);

    // In production, integrate with Resend or another email service
    // For now, we'll just log the email details
    const emailContent = {
      to: staffEmail,
      subject: `You've been invited to ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to ${businessName}!</h1>
          <p>Hi ${staffName},</p>
          <p>You've been invited to join ${businessName}'s team on Aivia.</p>
          <p>You'll be able to:</p>
          <ul>
            <li>View your own calendar and bookings</li>
            <li>Manage your availability</li>
            <li>See customer appointments</li>
          </ul>
          <p style="margin: 30px 0;">
            <a href="${inviteLink}" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            ${inviteLink}
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 40px;">
            This invitation was sent by ${businessName}. The business owner will approve your access.
          </p>
        </div>
      `,
    };

    console.log("Initializing Resend client...");
    const resend = new Resend(apiKey);
    
    console.log("Sending email via Resend...");
    console.log("- From:", fromEmail);
    console.log("- To:", staffEmail);

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: staffEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log("✅ Email sent successfully");
    console.log("Email ID:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation email sent successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ ERROR in send-staff-invitation:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send invitation",
        details: error.stack
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);