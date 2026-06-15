import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "Mo Laye <mo@aiviaapp.co.uk>";

const businessTypePlural: Record<string, string> = {
  salon: "salons",
  barbershop: "barbershops",
  restaurant: "restaurants",
  spa: "spas",
  clinic: "clinics",
  trades: "trades",
  estate_agent: "estate agencies",
  beauty: "beauty businesses",
  other: "businesses",
};

const fill = (s: string, lead: any) =>
  (s || "")
    .replaceAll("{{first_name}}", lead.first_name || "there")
    .replaceAll("{{business_name}}", lead.business_name || "your business")
    .replaceAll("{{business_type}}", lead.business_type || "business")
    .replaceAll("{{business_type_plural}}", businessTypePlural[lead.business_type] || "businesses");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, step_number } = await req.json();
    if (!campaign_id || ![1, 2, 3].includes(step_number)) {
      return new Response(JSON.stringify({ error: "campaign_id and step_number (1-3) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: template, error: tErr } = await supabase
      .from("outbound_email_templates")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("step_number", step_number)
      .maybeSingle();
    if (tErr || !template) {
      return new Response(
        JSON.stringify({
          error: `No email template saved for Step ${step_number}. Open the Email Sequence panel, fill in the subject and body, click Save, then try again.`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!template.subject?.trim() || !template.body_html?.trim()) {
      return new Response(
        JSON.stringify({
          error: `Step ${step_number} template is missing a subject or body. Edit the Email Sequence panel and save before sending.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const stepCol = `email${step_number}_status`;
    const sentCol = `email${step_number}_sent_at`;

    const { data: leads } = await supabase
      .from("outbound_leads")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("sequence_status", "active")
      .eq(stepCol, "pending")
      .not("email", "is", null);

    const eligible = (leads || []).filter(
      (l: any) =>
        l.email &&
        l.email.trim() &&
        !["responded", "demo_booked", "not_interested", "do_not_call"].includes(l.sequence_status)
    );

    let sent = 0;
    const errors: any[] = [];

    for (const lead of eligible) {
      try {
        const subjectBase = template.subject || "";
        let subject = fill(subjectBase, lead);
        let bodyHtml = fill(template.body_html, lead);

        const headers: Record<string, string> = {};

        // Reply threading for steps 2/3
        if (step_number > 1 && template.is_reply) {
          const { data: step1Log } = await supabase
            .from("outbound_email_log")
            .select("message_id, subject")
            .eq("lead_id", lead.id)
            .eq("step_number", 1)
            .order("sent_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (step1Log?.message_id) {
            headers["In-Reply-To"] = step1Log.message_id;
            headers["References"] = step1Log.message_id;
            subject = `Re: ${step1Log.subject || subject}`;
          } else {
            subject = `Re: ${subject}`;
          }
        }

        // Create log entry first to get the id for the tracking pixel
        const { data: logRow, error: logErr } = await supabase
          .from("outbound_email_log")
          .insert({
            lead_id: lead.id,
            campaign_id,
            step_number,
            subject,
            status: "pending",
          })
          .select("id")
          .single();
        if (logErr || !logRow) throw logErr || new Error("Log insert failed");

        const pixel = `<img src="${SUPABASE_URL}/functions/v1/track-email-open?id=${logRow.id}" width="1" height="1" style="display:none" alt="" />`;
        const finalHtml = `${bodyHtml}\n${pixel}`;

        const resendBody: any = {
          from: FROM,
          to: [lead.email],
          subject,
          html: finalHtml,
        };
        if (Object.keys(headers).length) resendBody.headers = headers;

        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(resendBody),
        });
        const text = await resp.text();
        if (!resp.ok) {
          await supabase
            .from("outbound_email_log")
            .update({ status: "failed" })
            .eq("id", logRow.id);
          errors.push({ lead_id: lead.id, error: text });
          continue;
        }
        const j = JSON.parse(text);
        const resendId = j?.id || null;
        // Resend doesn't return Message-ID; use synthesized ID for threading
        const messageId = `<${resendId || logRow.id}@aiviaapp.co.uk>`;

        await supabase
          .from("outbound_email_log")
          .update({
            resend_email_id: resendId,
            message_id: messageId,
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", logRow.id);

        await supabase
          .from("outbound_leads")
          .update({
            [stepCol]: "sent",
            [sentCol]: new Date().toISOString(),
            sequence_step: step_number,
          })
          .eq("id", lead.id);

        sent++;
      } catch (e: any) {
        console.error("[send-outbound-emails] lead error", lead.id, e);
        errors.push({ lead_id: lead.id, error: String(e?.message || e) });
      }
    }

    return new Response(JSON.stringify({ sent, errors, eligible: eligible.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-outbound-emails] fatal", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
