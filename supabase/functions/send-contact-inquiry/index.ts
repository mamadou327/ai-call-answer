import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escHtml = (s: string | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface Body {
  name: string;
  email: string;
  phone?: string;
  inquiryType: string;
  message: string;
}

const INQUIRY_LABELS: Record<string, string> = {
  general: "General Inquiry",
  demo: "Request a Demo",
  pricing: "Pricing Question",
  support: "Technical Support",
  partnership: "Partnership",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = body.phone ? String(body.phone).trim() : "";
    const inquiryType = String(body.inquiryType ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!name || !email || !inquiryType || !message) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (name.length > 100 || email.length > 255 || phone.length > 30 || message.length > 1000) {
      return json({ error: "Input exceeds maximum length" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Invalid email" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const label = INQUIRY_LABELS[inquiryType] ?? inquiryType;
    const storedMessage = `[Contact — ${label}]\n\n${message}`;

    // Store in demo_requests so it shows in the admin Demo Requests tab
    const { error: insertError } = await supabase.from("demo_requests").insert({
      name,
      email,
      phone: phone || null,
      message: storedMessage,
      status: "pending",
    });
    if (insertError) console.error("[contact-inquiry] insert failed", insertError);

    // Email admins
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    let adminUserIds: string[] = [];
    try {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["super_admin", "sub_admin"]);
      adminUserIds = Array.from(new Set((adminRoles ?? []).map((r: any) => r.user_id).filter(Boolean)));
    } catch (e) {
      console.warn("[contact-inquiry] failed to load admins", e);
    }

    if (resendKey && adminUserIds.length) {
      try {
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", adminUserIds);
        const adminEmails = (adminProfiles ?? []).map((p: any) => p.email).filter(Boolean);
        if (adminEmails.length) {
          const resend = new Resend(resendKey);
          const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#1e293b;">New Contact Inquiry</h2>
              <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0;">
                <p style="margin:4px 0;"><strong>Type:</strong> ${escHtml(label)}</p>
                <p style="margin:4px 0;"><strong>Name:</strong> ${escHtml(name)}</p>
                <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${escHtml(email)}">${escHtml(email)}</a></p>
                ${phone ? `<p style="margin:4px 0;"><strong>Phone:</strong> ${escHtml(phone)}</p>` : ""}
              </div>
              <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;">
                <p style="margin:0;white-space:pre-wrap;color:#1e293b;">${escHtml(message)}</p>
              </div>
              <p style="color:#64748b;font-size:13px;margin-top:24px;">Sent from the Aivia landing page contact form.</p>
            </div>`;
          await Promise.allSettled(
            adminEmails.map((to: string) =>
              resend.emails.send({
                from: `Aivia <${fromEmail}>`,
                to: [to],
                reply_to: email,
                subject: `New contact inquiry from ${name} — ${label}`,
                html,
              }),
            ),
          );
        }
      } catch (e) {
        console.warn("[contact-inquiry] email fanout failed", e);
      }
    }

    // Fire-and-forget push to admins
    try {
      const cronSecret = Deno.env.get("CRON_SECRET");
      if (cronSecret && adminUserIds.length) {
        await Promise.all(
          adminUserIds.map((uid) =>
            fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-internal-secret": cronSecret },
              body: JSON.stringify({
                user_id: uid,
                title: "New contact inquiry",
                body: `${name} — ${label}`,
                url: "/admin",
                tag: "admin-contact-inquiry",
              }),
            }).catch((e) => console.warn("[contact-push] failed", e)),
          ),
        );
      }
    } catch (e) {
      console.warn("[contact-push] error", e);
    }

    return json({ success: true }, 200);
  } catch (e: any) {
    console.error("[contact-inquiry] error", e);
    return json({ error: e?.message || "Failed" }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
