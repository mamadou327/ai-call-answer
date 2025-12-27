import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTxtInstructionsRequest {
  business_id: string;
  txt_value: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { business_id, txt_value }: SendTxtInstructionsRequest = await req.json();

    if (!business_id || !txt_value) {
      return new Response(
        JSON.stringify({ error: "Missing business_id or txt_value" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending TXT record instructions for business: ${business_id}`);

    // Get business info including owner
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("business_name, custom_booking_domain, owner_id")
      .eq("id", business_id)
      .single();

    if (businessError || !business) {
      console.error("Error fetching business:", businessError);
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get owner's email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, first_name")
      .eq("user_id", business.owner_id)
      .single();

    if (profileError || !profile?.email) {
      console.error("Error fetching owner profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Owner email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save the TXT value to the business
    const { error: updateError } = await supabase
      .from("businesses")
      .update({ custom_domain_txt_value: txt_value })
      .eq("id", business_id);

    if (updateError) {
      console.error("Error saving TXT value:", updateError);
    }

    // Send email with TXT record instructions
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "Aivia <notifications@aiviaapp.co.uk>",
        to: [profile.email],
        subject: `Action Required: Complete Your Custom Domain Setup for ${business.custom_booking_domain}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #2563eb;">Almost There! One More Step to Complete Your Custom Domain</h2>
            
            <p>Hi ${profile.first_name || 'there'},</p>
            
            <p>Great news! Your A record for <strong>${business.custom_booking_domain}</strong> has been verified successfully.</p>
            
            <p>To complete the setup and enable SSL (secure connection), please add one more DNS record:</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="margin-top: 0; color: #1e40af;">Add This TXT Record</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #64748b; width: 80px;">Type:</td>
                  <td style="padding: 8px 0;"><code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">TXT</code></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Name:</td>
                  <td style="padding: 8px 0;"><code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">_lovable</code></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Value:</td>
                  <td style="padding: 8px 0; word-break: break-all;"><code style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; display: inline-block;">${txt_value}</code></td>
                </tr>
              </table>
            </div>
            
            <h3 style="color: #1e40af;">How to Add This Record</h3>
            <ol style="line-height: 1.8; padding-left: 20px;">
              <li>Log in to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.)</li>
              <li>Go to DNS settings for your domain</li>
              <li>Add a new TXT record with the values above</li>
              <li>Save your changes</li>
            </ol>
            
            <p style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <strong>Note:</strong> DNS changes can take 5-30 minutes to propagate. Once we detect the TXT record, your custom domain will be fully activated.
            </p>
            
            <p>You can also see these instructions in your Aivia dashboard under Settings → Online Booking → Custom Domain.</p>
            
            <p style="margin-top: 30px;">Need help? Just reply to this email and we'll assist you.</p>
            
            <p>Best regards,<br/>The Aivia Team</p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            <p style="color: #94a3b8; font-size: 12px;">
              This email was sent regarding your custom domain setup for ${business.business_name}.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Failed to send email:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("TXT record instructions email sent successfully to:", profile.email);

    return new Response(
      JSON.stringify({ success: true, email_sent_to: profile.email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-txt-record-instructions:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
