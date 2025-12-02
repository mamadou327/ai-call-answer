import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ApprovalEmailRequest {
  businessName: string;
  ownerEmail: string;
  ownerName: string;
  assignedNumber?: string;
  portingStatus?: string;
  dashboardUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== BUSINESS APPROVAL EMAIL FUNCTION STARTED ===");
  
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    
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

    if (!fromEmail) {
      console.error("❌ RESEND_FROM_EMAIL is not set");
      return new Response(
        JSON.stringify({ error: "RESEND_FROM_EMAIL is not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { businessName, ownerEmail, ownerName, assignedNumber, portingStatus, dashboardUrl }: ApprovalEmailRequest = await req.json();
    console.log("Approval email details:", { businessName, ownerEmail, ownerName });

    const numberInfo = assignedNumber 
      ? `<p style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #3b82f6; border-radius: 4px;">
           <strong>Your Aivia Number:</strong> ${assignedNumber}<br>
           ${portingStatus ? `<strong>Porting Status:</strong> ${portingStatus}` : ''}
         </p>`
      : '';

    const resend = new Resend(apiKey);
    
    console.log("Sending approval email via Resend...");
    console.log("- From:", fromEmail);
    console.log("- To:", ownerEmail);

    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: ownerEmail,
      subject: `🎉 Your Aivia account has been approved!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; margin-bottom: 10px;">Welcome to Aivia, ${ownerName}!</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            Great news! Your business account for <strong>${businessName}</strong> has been approved and is now active.
          </p>
          
          ${numberInfo}
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            You can now access your business dashboard to:
          </p>
          <ul style="color: #666; font-size: 16px; line-height: 1.8; margin: 20px 0;">
            <li>Manage your services and staff</li>
            <li>View bookings and appointments</li>
            <li>Configure your AI assistant</li>
            <li>Monitor calls and messages</li>
          </ul>
          
          <p style="margin: 30px 0;">
            <a href="${dashboardUrl}" 
               style="background-color: #3b82f6; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Access Your Dashboard
            </a>
          </p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px;">
            If you have any questions or need assistance, please don't hesitate to reach out to our support team.
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            This email was sent to ${ownerEmail} because your business account was approved on Aivia.
          </p>
        </div>
      `,
    });

    console.log("✅ Approval email sent successfully");
    console.log("Email ID:", emailResponse.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Approval email sent successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ ERROR in send-business-approval-email:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send approval email",
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
