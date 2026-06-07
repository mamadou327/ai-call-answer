import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "info@aiviaapp.co.uk";
const MO_EMAIL = "mo@aiviaapp.co.uk";

async function sendEmail(subject: string, html: string, to: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Aivia <${FROM_EMAIL}>`, to: [to], subject, html }),
  });
  if (!r.ok) console.error("[send-demo-reminders] resend error", await r.text());
}

function fmtLondon(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Cron auth: accept x-cron-secret header or Authorization: Bearer <secret>
    const headerSecret = req.headers.get("x-cron-secret") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const bearerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const provided = headerSecret || bearerSecret;
    const { data: cronSecret } = await supabase.rpc("get_cron_secret");
    if (!provided || !cronSecret || provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    // 24h reminders
    const { data: d24 } = await supabase
      .from("outbound_demos")
      .select("*")
      .eq("status", "scheduled")
      .eq("reminder_24h_sent", false)
      .gt("demo_datetime", now.toISOString())
      .lte("demo_datetime", in24h);

    for (const d of d24 || []) {
      const when = fmtLondon(d.demo_datetime);
      await sendEmail(
        `Demo Tomorrow — ${d.prospect_name || "Prospect"} at ${when}`,
        `<p>Reminder that you have a demo tomorrow with <b>${d.prospect_name || ""}</b> from <b>${d.prospect_business || ""}</b> at <b>${when}</b>.</p>
         <p>Phone: ${d.prospect_phone || "—"}</p>
         <p><b>Call summary:</b><br/>${(d.call_summary || "").replace(/\n/g, "<br/>")}</p>`,
        MO_EMAIL
      );
      await supabase.from("outbound_demos").update({ reminder_24h_sent: true }).eq("id", d.id);
    }

    // 1h reminders
    const { data: d1 } = await supabase
      .from("outbound_demos")
      .select("*")
      .eq("status", "scheduled")
      .eq("reminder_1h_sent", false)
      .gt("demo_datetime", now.toISOString())
      .lte("demo_datetime", in1h);

    for (const d of d1 || []) {
      const when = fmtLondon(d.demo_datetime);
      await sendEmail(
        `Demo in 1 Hour — ${d.prospect_name || "Prospect"} from ${d.prospect_business || ""}`,
        `<p>Your demo with <b>${d.prospect_name || ""}</b> from <b>${d.prospect_business || ""}</b> is in 1 hour at <b>${when}</b>.</p>
         <p>Call them on <b>${d.prospect_phone || "—"}</b>.</p>
         <p><b>What they said on the outbound call:</b><br/>${(d.call_summary || "").replace(/\n/g, "<br/>")}</p>`,
        MO_EMAIL
      );
      await supabase.from("outbound_demos").update({ reminder_1h_sent: true }).eq("id", d.id);
    }

    return new Response(JSON.stringify({ ok: true, sent24: d24?.length || 0, sent1: d1?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-demo-reminders] error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
