import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TestEmailRequest {
  to: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== TEST EMAIL FUNCTION STARTED ===");
  
  if (req.method === "OPTIONS") {
    console.log("Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check environment variables
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    
    console.log("Environment check:");
    console.log("- RESEND_API_KEY exists:", !!apiKey);
    console.log("- RESEND_API_KEY length:", apiKey?.length || 0);
    console.log("- RESEND_FROM_EMAIL:", fromEmail);
    
    if (!apiKey) {
      console.error("❌ RESEND_API_KEY is not set in environment");
      return new Response(
        JSON.stringify({ 
          error: "RESEND_API_KEY is not configured",
          details: "Please add the RESEND_API_KEY secret in your backend settings"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!fromEmail) {
      console.error("❌ RESEND_FROM_EMAIL is not set in environment");
      return new Response(
        JSON.stringify({ 
          error: "RESEND_FROM_EMAIL is not configured",
          details: "Please add the RESEND_FROM_EMAIL secret in your backend settings"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Parse request body
    let to: string;
    try {
      const body: TestEmailRequest = await req.json();
      to = body.to;
      console.log("Test email recipient:", to);
    } catch (error) {
      console.error("❌ Failed to parse request body:", error);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (!to) {
      console.error("❌ No recipient email provided");
      return new Response(
        JSON.stringify({ error: "Recipient email is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Resend
    console.log("Initializing Resend client...");
    const resend = new Resend(apiKey);

    // Send test email
    console.log("Attempting to send test email...");
    console.log("- From:", fromEmail);
    console.log("- To:", to);
    
    const emailPayload = {
      from: fromEmail,
      to: [to],
      subject: "Aivia Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">🎉 Test Email Successful!</h1>
          <p>This is a test email from Aivia.</p>
          <p>If you're seeing this, your Resend integration is working correctly!</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Sent at: ${new Date().toISOString()}<br>
            From: ${fromEmail}<br>
            To: ${to}
          </p>
        </div>
      `,
    };

    console.log("Email payload prepared, sending via Resend API...");
    const emailResponse = await resend.emails.send(emailPayload);

    console.log("✅ Resend API response:", JSON.stringify(emailResponse, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test email sent successfully",
        emailId: emailResponse.data?.id,
        details: {
          from: fromEmail,
          to: to,
          timestamp: new Date().toISOString()
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("❌ ERROR in send-test-email function:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Full error object:", JSON.stringify(error, null, 2));
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to send test email",
        details: error.stack,
        errorType: error.name
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
