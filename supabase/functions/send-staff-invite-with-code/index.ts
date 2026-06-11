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

    // AuthZ: verify caller is the owner of this business
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the caller owns the business; also fetch the join code fields
    const { data: business, error: fetchError } = await supabase
      .from("businesses")
      .select("owner_id, staff_join_code, staff_join_expires_at")
      .eq("id", businessId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch business: ${fetchError.message}`);
    }

    if (!business || business.owner_id !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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
      subject: `You're invited to join ${businessName} on Aivia`,
      html: `
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
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 32px 40px; text-align: center;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                        ✨ You're Invited
                      </h1>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                        Hi ${displayName},
                      </p>
                      
                      <p style="margin: 0 0 28px; color: #4b5563; font-size: 15px; line-height: 1.7;">
                        You've been invited to join <strong style="color: #1f2937;">${businessName}</strong> as a staff member on Aivia.
                      </p>
                      
                      <!-- Join Code Card -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 1px solid #bae6fd; margin-bottom: 28px;">
                        <tr>
                          <td style="padding: 24px; text-align: center;">
                            <p style="margin: 0 0 8px; color: #0369a1; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                              Your Join Code
                            </p>
                            <p style="margin: 0; font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 28px; font-weight: 700; color: #0c4a6e; letter-spacing: 3px;">
                              ${joinCode}
                            </p>
                            <p style="margin: 12px 0 0; color: #64748b; font-size: 12px;">
                              Valid for 24 hours
                            </p>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- Steps -->
                      <p style="margin: 0 0 16px; color: #1f2937; font-size: 14px; font-weight: 600;">
                        How to get started:
                      </p>
                      
                      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="width: 28px; height: 28px; background-color: #4F46E5; border-radius: 50%; text-align: center; vertical-align: middle; color: #fff; font-size: 13px; font-weight: 600;">1</td>
                                <td style="padding-left: 14px; color: #4b5563; font-size: 14px;">Click the button below to sign up</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="width: 28px; height: 28px; background-color: #4F46E5; border-radius: 50%; text-align: center; vertical-align: middle; color: #fff; font-size: 13px; font-weight: 600;">2</td>
                                <td style="padding-left: 14px; color: #4b5563; font-size: 14px;">Create your account with this email</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 12px 0;">
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="width: 28px; height: 28px; background-color: #4F46E5; border-radius: 50%; text-align: center; vertical-align: middle; color: #fff; font-size: 13px; font-weight: 600;">3</td>
                                <td style="padding-left: 14px; color: #4b5563; font-size: 14px;">Enter the join code above when prompted</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4);">
                              Get Started →
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 0; color: #9ca3af; font-size: 13px; text-align: center;">
                        Or paste this link: <a href="${inviteLink}" style="color: #4F46E5; text-decoration: none;">${inviteLink}</a>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Note -->
                  <tr>
                    <td style="padding: 0 40px 32px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefce8; border-radius: 8px; border-left: 4px solid #eab308;">
                        <tr>
                          <td style="padding: 14px 16px;">
                            <p style="margin: 0; color: #854d0e; font-size: 13px; line-height: 1.5;">
                              💡 <strong>Note:</strong> Your access will be activated after ${businessName} approves your request.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.6;">
                        Sent by <strong style="color: #64748b;">Aivia</strong> — Smart booking assistant<br/>
                        <a href="https://aiviaapp.co.uk" style="color: #4F46E5; text-decoration: none;">aiviaapp.co.uk</a>
                      </p>
                    </td>
                  </tr>
                  
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
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
