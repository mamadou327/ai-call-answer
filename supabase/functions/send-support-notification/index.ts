import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  service_request_id: string;
  sender_type: "admin" | "business";
  message: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { service_request_id, sender_type, message }: NotificationRequest = await req.json();
    
    console.log("Sending support notification:", { service_request_id, sender_type });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the service request with business info
    const { data: serviceRequest, error: srError } = await supabase
      .from("service_requests")
      .select(`
        id,
        message,
        business_id,
        business:businesses(
          business_name,
          owner_id
        )
      `)
      .eq("id", service_request_id)
      .single();

    if (srError || !serviceRequest) {
      console.error("Error fetching service request:", srError);
      throw new Error("Service request not found");
    }

    // Extract business info (handle array from join)
    const businessData = Array.isArray(serviceRequest.business) 
      ? serviceRequest.business[0] 
      : serviceRequest.business;
    const businessOwnerId = businessData?.owner_id;
    const businessName = businessData?.business_name || "A business";

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    let recipientEmail: string | null = null;
    let recipientName: string = "";
    let subject: string = "";
    let emailHtml: string = "";

    // Parse the original subject from the service request
    const originalSubject = serviceRequest.message?.match(/\*\*Subject:\*\* (.+?)(\n|$)/)?.[1] || "Support Request";

    if (sender_type === "admin") {
      // Admin sent a message, notify the business owner
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", businessOwnerId)
        .single();

      if (profileError || !profile?.email) {
        console.error("Error fetching business owner profile:", profileError);
        throw new Error("Business owner email not found");
      }

      recipientEmail = profile.email;
      recipientName = profile.first_name || "Business Owner";
      subject = `New Reply: ${originalSubject}`;
      emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">You have a new reply from Admin</h2>
          <p>Hi ${recipientName},</p>
          <p>An admin has replied to your support request: <strong>${originalSubject}</strong></p>
          
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <p style="margin: 0; white-space: pre-wrap;">${message}</p>
          </div>
          
          <p>Log in to your dashboard to view the full conversation and reply.</p>
          
          <p style="color: #666; margin-top: 30px;">Best regards,<br>The Aivia Team</p>
        </div>
      `;
    } else {
      // Business sent a message, notify all super admins
      const { data: superAdmins, error: adminsError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      if (adminsError) {
        console.error("Error fetching super admins:", adminsError);
        throw new Error("Failed to fetch admins");
      }

      if (!superAdmins || superAdmins.length === 0) {
        console.log("No super admins found to notify");
        return new Response(JSON.stringify({ success: true, message: "No admins to notify" }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      // Get admin emails
      const adminUserIds = superAdmins.map(a => a.user_id);
      const { data: adminProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("email, first_name")
        .in("user_id", adminUserIds);

      if (profilesError || !adminProfiles?.length) {
        console.error("Error fetching admin profiles:", profilesError);
        throw new Error("Admin emails not found");
      }

      subject = `New Support Message from ${businessName}`;
      
      // Send to all admins
      const emailPromises = adminProfiles
        .filter(p => p.email)
        .map(admin => {
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Support Message</h2>
              <p>Hi ${admin.first_name || "Admin"},</p>
              <p><strong>${businessName}</strong> has sent a new message regarding: <strong>${originalSubject}</strong></p>
              
              <div style="background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
                <p style="margin: 0; white-space: pre-wrap;">${message}</p>
              </div>
              
              <p>Log in to your admin dashboard to view and respond to this message.</p>
              
              <p style="color: #666; margin-top: 30px;">Best regards,<br>The Aivia System</p>
            </div>
          `;
          
          console.log("Sending email to admin:", admin.email);
          return resend.emails.send({
            from: `Aivia Support <${fromEmail}>`,
            to: [admin.email!],
            subject,
            html,
          });
        });

      const results = await Promise.allSettled(emailPromises);
      const successful = results.filter(r => r.status === "fulfilled").length;
      console.log(`Sent ${successful}/${emailPromises.length} admin notification emails`);

      // Fire-and-forget PWA push to all admins
      try {
        const cronSecret = Deno.env.get("CRON_SECRET");
        if (cronSecret) {
          const preview = message.length > 80 ? `${message.slice(0, 80)}…` : message;
          await Promise.all(
            adminUserIds.map((uid) =>
              fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-internal-secret": cronSecret },
                body: JSON.stringify({
                  user_id: uid,
                  title: "New support message",
                  body: `${businessName}: ${preview}`,
                  url: "/admin",
                  tag: "admin-support-message",
                }),
              }).catch((e) => console.warn("[support-push] failed", e)),
            ),
          );
        }
      } catch (e) {
        console.warn("[support-push] error", e);
      }

      return new Response(
        JSON.stringify({ success: true, sent: successful }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send single email (for business owner)
    if (recipientEmail) {
      console.log("Sending email to:", recipientEmail);
      const emailResponse = await resend.emails.send({
        from: `Aivia Support <${fromEmail}>`,
        to: [recipientEmail],
        subject,
        html: emailHtml,
      });

      console.log("Email sent successfully:", emailResponse);
      return new Response(
        JSON.stringify({ success: true, emailResponse }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: "No recipient found" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-support-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
