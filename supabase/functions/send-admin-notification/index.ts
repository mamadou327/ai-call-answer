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

interface AdminNotificationRequest {
  businessName?: string;
  ownerName?: string;
  ownerEmail?: string;
  phone?: string;
  website?: string;
  address?: string;
  // For staff signups
  signupType?: "business" | "staff" | "sms_request";
  staffName?: string;
  staffEmail?: string;
  staffBusinessName?: string;
  // For service requests
  businessPhone?: string;
  requestType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-admin-notification function called");

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
      fromEmail: resendFromEmail,
    });

    if (!resendApiKey || !resendFromEmail) {
      throw new Error("Email configuration missing");
    }

    const body: AdminNotificationRequest = await req.json();
    const { signupType = "business" } = body;

    const resend = new Resend(resendApiKey);

    let emailSubject: string;
    let emailHtml: string;

    if (signupType === "staff") {
      // Staff signup notification
      const { staffName, staffEmail, staffBusinessName } = body;
      console.log("Sending admin notification for staff signup:", staffEmail);

      emailSubject = `New staff signup - ${staffName || staffEmail}`;
      emailHtml = `
        <h1>New Staff Signup</h1>
        <p>A new staff member has signed up:</p>
        
        <h2>Staff Information</h2>
        <ul>
          <li><strong>Name:</strong> ${staffName || 'Not provided'}</li>
          <li><strong>Email:</strong> ${staffEmail}</li>
          ${staffBusinessName ? `<li><strong>Business:</strong> ${staffBusinessName}</li>` : ''}
        </ul>
        
        <p>Please review this in the admin dashboard if needed.</p>
        <p><a href="https://d72d0c2b-5279-4257-bb7b-30b62c3f3c85.lovableproject.com/admin" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Go to Admin Dashboard</a></p>
      `;
    } else if (signupType === "sms_request") {
      // SMS service request notification
      const { businessName, businessPhone, requestType } = body;
      console.log("Sending admin notification for SMS request from:", businessName);

      emailSubject = `New Service Request - ${requestType} - ${businessName}`;
      emailHtml = `
        <h1>New Service Request</h1>
        <p>A business has requested a new service:</p>
        
        <h2>Request Details</h2>
        <ul>
          <li><strong>Business:</strong> ${businessName}</li>
          <li><strong>Phone:</strong> ${businessPhone || 'Not provided'}</li>
          <li><strong>Service Requested:</strong> ${requestType}</li>
        </ul>
        
        <p>Please review this request in the admin dashboard under Service Requests.</p>
        <p><a href="https://d72d0c2b-5279-4257-bb7b-30b62c3f3c85.lovableproject.com/admin" style="display: inline-block; padding: 12px 24px; background-color: #f97316; color: white; text-decoration: none; border-radius: 6px;">Review Service Requests</a></p>
      `;
    } else {
      // Business signup notification
      const { businessName, ownerName, ownerEmail, phone, website, address } = body;
      console.log("Sending admin notification for business:", businessName);

      emailSubject = `New business signup awaiting approval - ${businessName}`;
      emailHtml = `
        <h1>New Business Signup</h1>
        <p>A new business has signed up and is awaiting approval:</p>
        
        <h2>Business Information</h2>
        <ul>
          <li><strong>Business Name:</strong> ${businessName}</li>
          <li><strong>Owner Name:</strong> ${ownerName}</li>
          <li><strong>Owner Email:</strong> ${ownerEmail}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          ${website ? `<li><strong>Website:</strong> ${website}</li>` : ''}
          <li><strong>Address:</strong> ${address}</li>
        </ul>
        
        <p>Please review this application in the admin dashboard.</p>
        <p><a href="https://d72d0c2b-5279-4257-bb7b-30b62c3f3c85.lovableproject.com/admin" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">Go to Admin Dashboard</a></p>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: resendFromEmail,
      to: [adminEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Admin notification sent successfully:", emailResponse);

    // Fan out PWA push to all admins (only for events the user asked for).
    if (signupType === "business") {
      const b: any = body;
      await pushToAdmins({
        title: "New business signup",
        body: `${b.businessName || "A business"} is awaiting approval`,
        url: "/admin",
        tag: "admin-signup",
      });
    } else if (signupType === "sms_request") {
      const b: any = body;
      await pushToAdmins({
        title: "New service request",
        body: `${b.businessName || "A business"} requested ${b.requestType || "a service"}`,
        url: "/admin",
        tag: "admin-service-request",
      });
    }

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-admin-notification function:", error);
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
