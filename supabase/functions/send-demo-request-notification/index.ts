import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

async function pushToAdmins(payload: { title: string; body: string; url?: string; tag?: string }) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!supabaseUrl || !serviceKey || !cronSecret) return;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role", ["super_admin", "sub_admin"]);
    const userIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean)));
    await Promise.all(
      userIds.map((uid) =>
        fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-internal-secret": cronSecret },
          body: JSON.stringify({ user_id: uid, ...payload }),
        }).catch((e) => console.warn("[admin-push] failed", e)),
      ),
    );
  } catch (e) {
    console.warn("[admin-push] error", e);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DemoRequestNotification {
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  businessType?: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-demo-request-notification function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    const adminEmail = "mlaye915@gmail.com";

    console.log("Environment check:", {
      hasResendKey: !!resendApiKey,
      hasFromEmail: !!resendFromEmail,
    });

    if (!resendApiKey || !resendFromEmail) {
      throw new Error("Email configuration missing");
    }

    const body: DemoRequestNotification = await req.json();
    const { name, email, phone, businessName, businessType, message } = body;

    console.log("Sending demo request notification for:", email);

    const resend = new Resend(resendApiKey);

    const emailHtml = `
      <h1>🎯 New Demo Request</h1>
      <p>Someone wants to hear a demo of Aivia!</p>
      
      <h2>Contact Details</h2>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ''}
      </ul>
      
      ${businessName || businessType ? `
        <h2>Business Information</h2>
        <ul>
          ${businessName ? `<li><strong>Business Name:</strong> ${businessName}</li>` : ''}
          ${businessType ? `<li><strong>Business Type:</strong> ${businessType}</li>` : ''}
        </ul>
      ` : ''}
      
      ${message ? `
        <h2>Message</h2>
        <p>${message}</p>
      ` : ''}
      
      <hr />
      <p>View this request in the admin dashboard under Demo Requests.</p>
      <p><a href="https://aiviaapp.lovable.app/admin" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Go to Admin Dashboard</a></p>
    `;

    const emailResponse = await resend.emails.send({
      from: resendFromEmail,
      to: [adminEmail],
      subject: `🎯 Demo Request from ${name}${businessName ? ` - ${businessName}` : ''}`,
      html: emailHtml,
    });

    console.log("Demo request notification sent successfully:", emailResponse);

    await pushToAdmins({
      title: "New demo request",
      body: `${name}${businessName ? ` (${businessName})` : ""} requested a demo`,
      url: "/admin",
      tag: "admin-demo",
    });

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-demo-request-notification function:", error);
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
