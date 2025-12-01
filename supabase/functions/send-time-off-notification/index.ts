import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TimeOffNotification {
  staffName: string;
  staffEmail: string;
  businessName: string;
  startTime: string;
  endTime: string;
  reason: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { staffName, staffEmail, businessName, startTime, endTime, reason, notes }: TimeOffNotification = await req.json();

    console.log("Sending time-off notification to:", staffEmail);

    const formattedStart = new Date(startTime).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formattedEnd = new Date(endTime).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const emailContent = {
      to: staffEmail,
      subject: `Time Off Approved - ${businessName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Time Off Approved</h1>
          <p>Hi ${staffName},</p>
          <p>Your time off request has been approved by ${businessName}.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Time Off Details</h3>
            <p style="margin: 10px 0;"><strong>Reason:</strong> ${reason.replace("_", " ")}</p>
            <p style="margin: 10px 0;"><strong>Start:</strong> ${formattedStart}</p>
            <p style="margin: 10px 0;"><strong>End:</strong> ${formattedEnd}</p>
            ${notes ? `<p style="margin: 10px 0;"><strong>Notes:</strong> ${notes}</p>` : ""}
          </div>

          <p style="color: #666;">
            During this time, the AI assistant will not schedule any appointments for you.
          </p>

          <p style="color: #999; font-size: 12px; margin-top: 40px;">
            This notification was sent by ${businessName} via Aivia.
          </p>
        </div>
      `,
    };

    console.log("Sending email via Resend...");

    // Send email using Resend with verified domain
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@aiviaapp.co.uk";
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: staffEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Time-off notification email sent successfully"
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-time-off-notification:", error);
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