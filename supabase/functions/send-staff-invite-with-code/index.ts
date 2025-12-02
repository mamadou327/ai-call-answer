import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StaffInviteWithCodeRequest {
  staffEmail: string;
  staffName?: string;
  businessId: string;
  businessName: string;
}

// Generate a new join code with business name prefix
function generateJoinCode(businessName: string): string {
  const cleaned = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  let prefix = cleaned.substring(0, 4).toUpperCase();
  while (prefix.length < 4) {
    prefix += 'X';
  }
  const randomDigits = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${randomDigits}`;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-staff-invite-with-code function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("Environment check:", {
      hasResendKey: !!resendApiKey,
      hasFromEmail: !!resendFromEmail,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseServiceKey,
    });

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    if (!resendFromEmail) {
      throw new Error("RESEND_FROM_EMAIL is not configured");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const { staffEmail, staffName, businessId, businessName }: StaffInviteWithCodeRequest = await req.json();
    console.log("Request data:", { staffEmail, staffName, businessId, businessName });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get or refresh the join code
    const { data: business, error: fetchError } = await supabase
      .from("businesses")
      .select("staff_join_code, staff_join_expires_at")
      .eq("id", businessId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch business: ${fetchError.message}`);
    }

    let joinCode = business?.staff_join_code;
    const expiresAt = business?.staff_join_expires_at ? new Date(business.staff_join_expires_at) : null;

    // If code is expired or doesn't exist, generate a new one
    if (!joinCode || !expiresAt || expiresAt < new Date()) {
      console.log("Join code expired or missing, generating new one");
      joinCode = generateJoinCode(businessName);
      const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          staff_join_code: joinCode,
          staff_join_expires_at: newExpiry,
        })
        .eq("id", businessId);

      if (updateError) {
        throw new Error(`Failed to update join code: ${updateError.message}`);
      }
      console.log("New join code generated:", joinCode);
    }

    const resend = new Resend(resendApiKey);
    const displayName = staffName || staffEmail;
    const inviteLink = "https://aiviaapp.co.uk/staff/invite";

    const emailResponse = await resend.emails.send({
      from: resendFromEmail,
      to: [staffEmail],
      subject: `Your staff join code for ${businessName} on Aivia`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5; margin-bottom: 24px;">Staff Invitation</h1>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">Hi ${displayName},</p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Here is your staff login invitation for <strong>${businessName}</strong> on Aivia.
          </p>
          
          <div style="background-color: #F3F4F6; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
            <p style="font-size: 14px; color: #6B7280; margin: 0 0 8px 0;">Your Join Code</p>
            <p style="font-size: 32px; font-family: monospace; font-weight: bold; color: #4F46E5; letter-spacing: 4px; margin: 0;">
              ${joinCode}
            </p>
          </div>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            To complete your setup:
          </p>
          
          <ol style="font-size: 16px; color: #374151; line-height: 1.8;">
            <li>Click the button below to go to the signup page</li>
            <li>Enter your email and create a password</li>
            <li>Enter the join code shown above</li>
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
            Your access will become active after the business owner approves it.
          </p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 32px 0;" />
          
          <p style="font-size: 14px; color: #9CA3AF;">
            Best regards,<br/>
            The Aivia Team
          </p>
        </div>
      `,
    });

    console.log("Invite with code email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse, joinCode }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-staff-invite-with-code function:", error);
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
