// Checks current-month call usage against the business tier limit.
// Sends 75% / 90% / 100% threshold emails (idempotent per business per month
// via the call_usage_notifications table).
//
// Invoked from twilio-media-stream after each call is logged.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "mlaye915@gmail.com";

const TIER_LIMITS: Record<string, number | null> = {
  starter: 300,
  growth: 800,
  scale: 5000,
  enterprise: null,
};

const TIER_NAMES: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  enterprise: "Enterprise",
};

interface CheckBody {
  businessId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Internal-only: require shared secret from the caller (twilio-media-stream)
  const internalSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!internalSecret || provided !== internalSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");

    const supabase = createClient(supabaseUrl, serviceKey);
    const { businessId } = (await req.json()) as CheckBody;
    if (!businessId) {
      return new Response(JSON.stringify({ error: "businessId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull tier + business
    const { data: settings } = await supabase
      .from("business_settings")
      .select("subscription_tier")
      .eq("business_id", businessId)
      .maybeSingle();

    const tier = (settings as any)?.subscription_tier || "starter";
    const limit = TIER_LIMITS[tier];

    // Enterprise = unlimited, never notify
    if (limit === null || limit === undefined) {
      return new Response(JSON.stringify({ ok: true, tier, unlimited: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: countData } = await supabase.rpc("get_current_month_call_count", {
      p_business_id: businessId,
    });
    const calls = typeof countData === "number" ? countData : 0;
    const pct = (calls / limit) * 100;

    let threshold: 75 | 90 | 100 | null = null;
    if (pct >= 100) threshold = 100;
    else if (pct >= 90) threshold = 90;
    else if (pct >= 75) threshold = 75;

    if (!threshold) {
      return new Response(JSON.stringify({ ok: true, calls, limit, pct }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute current month start (date)
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);

    // Idempotency: try to insert the notification row; ignore if already there
    const { error: insertErr } = await supabase
      .from("call_usage_notifications")
      .insert({ business_id: businessId, month_start: monthStart, threshold });

    if (insertErr) {
      // Unique violation = already sent this month for this threshold
      if ((insertErr as any).code === "23505") {
        return new Response(JSON.stringify({ ok: true, alreadySent: true, threshold }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertErr;
    }

    // Look up business + owner email
    const { data: business } = await supabase
      .from("businesses")
      .select("id, business_name, owner_id")
      .eq("id", businessId)
      .maybeSingle();

    const { data: profile } = business?.owner_id
      ? await supabase
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("user_id", business.owner_id)
          .maybeSingle()
      : { data: null as any };

    const ownerEmail = (profile as any)?.email;
    const businessName = (business as any)?.business_name || "your business";
    const tierName = TIER_NAMES[tier];

    if (!resendApiKey || !resendFromEmail) {
      console.warn("[check-call-usage] Resend not configured, skipping emails");
      return new Response(
        JSON.stringify({ ok: true, threshold, emailSkipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resend = new Resend(resendApiKey);
    const remaining = Math.max(limit - calls, 0);

    // ---- Owner email ----
    let ownerSubject = "";
    let ownerHtml = "";

    if (threshold === 75) {
      ownerSubject = `You've used 75% of your ${tierName} call allowance`;
      ownerHtml = `
        <h2>Heads up from Aivia 👋</h2>
        <p>Hi${(profile as any)?.first_name ? ` ${(profile as any).first_name}` : ""},</p>
        <p><strong>${businessName}</strong> has used <strong>${calls} of ${limit}</strong> calls this month on your ${tierName} plan.</p>
        <p>You're getting close to your monthly cap. If you'd like to keep things running smoothly, it might be a good time to consider upgrading.</p>
        <p>Reply to this email and we'll help you find the right plan.</p>
        <p>— The Aivia team</p>
      `;
    } else if (threshold === 90) {
      ownerSubject = `Urgent: only ${remaining} calls left on your ${tierName} plan`;
      ownerHtml = `
        <h2>⚠️ You're at 90% of your call allowance</h2>
        <p>Hi${(profile as any)?.first_name ? ` ${(profile as any).first_name}` : ""},</p>
        <p><strong>${businessName}</strong> has used <strong>${calls} of ${limit}</strong> calls this month — only <strong>${remaining}</strong> remaining.</p>
        <p>To avoid any interruption to your AI receptionist, please upgrade now.</p>
        <p>Reply to this email or log in to your dashboard to request an upgrade.</p>
        <p>— The Aivia team</p>
      `;
    } else {
      ownerSubject = `Your ${tierName} call allowance is fully used`;
      ownerHtml = `
        <h2>You've reached your monthly call limit</h2>
        <p>Hi${(profile as any)?.first_name ? ` ${(profile as any).first_name}` : ""},</p>
        <p><strong>${businessName}</strong> has used all <strong>${limit}</strong> calls included in your ${tierName} plan this month.</p>
        <p>Aivia will resume answering calls automatically on the 1st of next month, or immediately if you upgrade.</p>
        <p>Reply to this email to upgrade now and resume answering today.</p>
        <p>— The Aivia team</p>
      `;
    }

    if (ownerEmail) {
      try {
        await resend.emails.send({
          from: resendFromEmail,
          to: ownerEmail,
          subject: ownerSubject,
          html: ownerHtml,
        });
      } catch (e) {
        console.error("[check-call-usage] owner email failed", e);
      }
    }

    // ---- Admin email (only at 90% and 100%) ----
    if (threshold >= 90) {
      const isHighVolumeScale = tier === "scale" && threshold === 100;
      const adminSubject = isHighVolumeScale
        ? `🚀 High-volume Scale client ready for Enterprise: ${businessName}`
        : threshold === 100
        ? `🛑 ${businessName} hit ${tierName} limit — calls paused`
        : `⚠️ ${businessName} at 90% of ${tierName} plan — close the upgrade`;

      const adminHtml = `
        <h2>${adminSubject}</h2>
        <ul>
          <li><strong>Business:</strong> ${businessName}</li>
          <li><strong>Current tier:</strong> ${tierName}</li>
          <li><strong>Usage:</strong> ${calls} / ${limit} calls this month (${pct.toFixed(0)}%)</li>
          <li><strong>Owner:</strong> ${ownerEmail || "(no email on file)"}</li>
        </ul>
        ${
          isHighVolumeScale
            ? "<p><strong>This client just hit the Scale fair-usage cap. Time to start the Enterprise conversation.</strong></p>"
            : threshold === 100
            ? "<p>Aivia has stopped answering calls for this business until they upgrade or the new month begins.</p>"
            : "<p>Reach out personally to close the upgrade before they hit 100%.</p>"
        }
      `;

      try {
        await resend.emails.send({
          from: resendFromEmail,
          to: ADMIN_EMAIL,
          subject: adminSubject,
          html: adminHtml,
        });
      } catch (e) {
        console.error("[check-call-usage] admin email failed", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, threshold, calls, limit }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[check-call-usage] error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
