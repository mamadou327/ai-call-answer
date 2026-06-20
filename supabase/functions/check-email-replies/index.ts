import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Aivia <mo@aiviaapp.co.uk>";
const NOTIFY_TO = "mo@aiviaapp.co.uk";

async function sendNotify(lead: any) {
  try {
    const html = `
      <h2>Email reply from ${lead.first_name || "lead"} at ${lead.business_name || ""}</h2>
      <p><strong>Name:</strong> ${lead.first_name || "—"}</p>
      <p><strong>Business:</strong> ${lead.business_name || "—"}</p>
      <p><strong>Phone:</strong> ${lead.phone_number || "—"}</p>
      <p><strong>Email:</strong> ${lead.email || "—"}</p>
      <p>Check your inbox to reply.</p>
    `;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [NOTIFY_TO],
        subject: `Email reply from ${lead.first_name || "lead"} at ${lead.business_name || ""}`,
        html,
      }),
    });
  } catch (e) {
    console.error("[check-email-replies] notify failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Auth: cron secret or service-role bearer (this is a polling job, not user-facing)
    const authHeader = req.headers.get("Authorization") || "";
    const headerSecret = req.headers.get("x-cron-secret") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const provided = headerSecret || bearer;
    const { data: cronSecret } = await supabase.rpc("get_cron_secret");
    const isAuthorized =
      (provided && cronSecret && provided === cronSecret) ||
      (bearer && bearer === SERVICE_KEY);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from("outbound_email_log")
      .select("id, lead_id, resend_email_id, step_number, sent_at")
      .is("replied_at", null)
      .gte("sent_at", cutoff)
      .not("resend_email_id", "is", null);

    let checked = 0;
    let repliesFound = 0;
    const bounced: string[] = [];

    for (const log of logs || []) {
      checked++;
      try {
        const r = await fetch(`https://api.resend.com/emails/${log.resend_email_id}`, {
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        if (!r.ok) continue;
        const j = await r.json();
        const last = (j?.last_event || "").toLowerCase();

        // Resend does not surface inbound replies; treat 'replied' if exposed,
        // and mark bounces so sequence stops naturally.
        if (last === "replied" || j?.replied_at) {
          repliesFound++;
          await supabase
            .from("outbound_email_log")
            .update({ replied_at: new Date().toISOString(), status: "replied" })
            .eq("id", log.id);

          if (log.lead_id) {
            const { data: lead } = await supabase
              .from("outbound_leads")
              .select("*")
              .eq("id", log.lead_id)
              .maybeSingle();
            if (lead && lead.sequence_status !== "responded") {
              await supabase
                .from("outbound_leads")
                .update({ sequence_status: "responded", status: "interested" })
                .eq("id", log.lead_id);
              await sendNotify(lead);
            }
          }
        } else if (last === "bounced" || last === "complained") {
          bounced.push(log.id);
          await supabase
            .from("outbound_email_log")
            .update({ status: last })
            .eq("id", log.id);
        }
      } catch (e) {
        console.error("[check-email-replies] log error", log.id, e);
      }
    }

    return new Response(
      JSON.stringify({ checked, repliesFound, bounced: bounced.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[check-email-replies] fatal", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
