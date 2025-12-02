import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StaffInvitationRequest {
  staffEmail: string;
  businessId: string;
  businessName: string;
  staffName: string;
}

// Generate a secure random token
function generateInviteToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-staff-invitation function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check environment variables
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    console.log("Environment check:", {
      hasResendKey: !!resendApiKey,
      hasFromEmail: !!resendFromEmail,
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseServiceKey,
      fromEmail: resendFromEmail,
    });

    if (!resendFromEmail) {
      throw new Error("RESEND_FROM_EMAIL is not configured");
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const { staffEmail, businessId, businessName, staffName }: StaffInvitationRequest = await req.json();
    console.log("Request data:", { staffEmail, businessId, businessName, staffName });

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate invite token
    const inviteToken = generateInviteToken();

    // Create staff invite record
    const { data: inviteData, error: inviteError } = await supabase
      .from('staff_invites')
      .insert({
        business_id: businessId,
        email: staffEmail,
        role: 'staff',
        invite_token: inviteToken,
        status: 'pending',
      })
      .select()
      .single();

    if (inviteError) {
      console.error("Error creating staff invite:", inviteError);
      throw new Error(`Failed to create invite: ${inviteError.message}`);
    }

    console.log("Staff invite created:", inviteData);

    // Construct the invite link
    const appUrl = supabaseUrl.includes('lovableproject.com') 
      ? 'https://d72d0c2b-5279-4257-bb7b-30b62c3f3c85.lovableproject.com'
      : supabaseUrl.replace(/\/\/.*\.supabase\.co/, '//d72d0c2b-5279-4257-bb7b-30b62c3f3c85.lovableproject.com');
    const inviteLink = `${appUrl}/staff/accept-invite?token=${inviteToken}`;

    // Initialize Resend client
    const resend = new Resend(resendApiKey);

    const emailResponse = await resend.emails.send({
      from: resendFromEmail,
      to: [staffEmail],
      subject: `You've been invited to join ${businessName} on Aivia`,
      html: `
        <h1>Welcome to ${businessName}!</h1>
        <p>Hi ${staffName},</p>
        <p>You have been invited to join <strong>${businessName}</strong> on Aivia as a staff member.</p>
        <p>To get started, please click the link below to accept your invitation and set up your account:</p>
        <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Accept Invitation</a></p>
        <p>Or copy and paste this link into your browser:</p>
        <p style="color: #666; font-size: 14px;">${inviteLink}</p>
        <p>Best regards,<br>The Aivia Team</p>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse, inviteToken }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-staff-invitation function:", error);
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