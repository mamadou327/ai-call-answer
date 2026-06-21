// Sends an email to the Aivia admin when a business owner clicks an upgrade
// button (either from a locked feature card or from the billing page).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "mlaye915@gmail.com";

const TIER_NAMES: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  enterprise: "Enterprise",
};

interface UpgradeBody {
  businessId?: string;
  businessName?: string;
  requestedTier: string;
  featureName?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!resendApiKey || !resendFromEmail) {
      throw new Error("Email configuration missing");
    }

    const body = (await req.json()) as UpgradeBody;
    const tierName = TIER_NAMES[body.requestedTier] || body.requestedTier;

    // Try to enrich with current tier + owner info if we have a businessId
    let currentTier = "(unknown)";
    let currentTierKey: string | null = null;
    let ownerEmail = body.contactEmail || "(unknown)";
    let businessName = body.businessName || "(unknown)";
    let ownerId: string | null = null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (body.businessId) {
      const { data: settings } = await supabase
        .from("business_settings")
        .select("subscription_tier")
        .eq("business_id", body.businessId)
        .maybeSingle();
      currentTierKey = (settings as any)?.subscription_tier || "starter";
      currentTier = TIER_NAMES[currentTierKey || "starter"];

      const { data: business } = await supabase
        .from("businesses")
        .select("business_name, owner_id")
        .eq("id", body.businessId)
        .maybeSingle();

      if (business) {
        businessName = (business as any).business_name || businessName;
        ownerId = (business as any).owner_id || null;
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("user_id", (business as any).owner_id)
          .maybeSingle();
        if (!body.contactEmail) ownerEmail = (profile as any)?.email || ownerEmail;
      }
    }

    // Log the request so admins can see/action it in-app
    try {
      await supabase.from("upgrade_requests").insert({
        business_id: body.businessId || null,
        business_name: businessName,
        requested_by: ownerId,
        current_tier: currentTierKey,
        requested_tier: body.requestedTier,
        contact_email: ownerEmail !== "(unknown)" ? ownerEmail : null,
        feature_name: body.featureName || null,
        notes: body.notes || null,
        status: "pending",
      });
    } catch (logErr) {
      console.error("[send-upgrade-request] failed to log row:", logErr);
    }

    const isEnterprise = body.requestedTier === "enterprise";
    const subject = isEnterprise
      ? `💼 Enterprise enquiry: ${businessName}`
      : `🚀 Upgrade request: ${businessName} → ${tierName}`;

    const html = `
      <h2>${subject}</h2>
      <ul>
        <li><strong>Business:</strong> ${businessName}</li>
        <li><strong>Current tier:</strong> ${currentTier}</li>
        <li><strong>Requested tier:</strong> ${tierName}</li>
        <li><strong>Contact email:</strong> ${ownerEmail}</li>
        ${body.contactName ? `<li><strong>Contact name:</strong> ${body.contactName}</li>` : ""}
        ${body.contactPhone ? `<li><strong>Contact phone:</strong> ${body.contactPhone}</li>` : ""}
        ${body.featureName ? `<li><strong>Triggered by feature:</strong> ${body.featureName}</li>` : ""}
      </ul>
      ${body.notes ? `<p><strong>Notes:</strong><br/>${body.notes.replace(/\n/g, "<br/>")}</p>` : ""}
      <p>Reach out to close the upgrade.</p>
    `;

    const resend = new Resend(resendApiKey);
    const sendResult = await resend.emails.send({
      from: resendFromEmail,
      to: ADMIN_EMAIL,
      subject,
      html,
    });
    console.log("[send-upgrade-request] resend result:", JSON.stringify(sendResult));
    if ((sendResult as any)?.error) {
      throw new Error(`Resend error: ${JSON.stringify((sendResult as any).error)}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[send-upgrade-request] error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
