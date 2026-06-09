import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MO_EMAIL = "mo@aiviaapp.co.uk";

async function extractWithAI(transcript: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const sys = `You read sales call transcripts and reply with ONLY a JSON object (no markdown, no prose) with this exact shape:
{"interest_level":"hot|warm|cold","existing_solution":string|null,"reason_not_interested":string|null,"demo_booked":boolean,"demo_datetime":string|null,"prospect_email":string|null}
demo_datetime must be an ISO 8601 datetime string if a specific date and time were agreed, otherwise null.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Transcript:\n${transcript}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error("[retell-webhook] AI gateway error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (e) {
    console.error("[retell-webhook] AI extraction failed", e);
    return null;
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("RESEND_FROM_EMAIL") || "Aivia <noreply@aiviaapp.co.uk>";
  if (!RESEND_API_KEY) {
    console.warn("[retell-webhook] RESEND_API_KEY missing, skipping email");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    if (!res.ok) console.error("[retell-webhook] resend error", res.status, await res.text());
  } catch (e) {
    console.error("[retell-webhook] resend exception", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("[retell-webhook] event", body?.event, "call_id", body?.call?.call_id || body?.call_id);

    // Only process call_analyzed events. Retell fires call_started/call_ended/call_analyzed —
    // processing more than one causes duplicate emails and analysis runs.
    if (body?.event && body.event !== "call_analyzed") {
      console.log("[retell-webhook] ignoring event", body.event);
      return new Response(JSON.stringify({ ok: true, note: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retell sends events wrapped: { event: "call_analyzed", call: {...} }
    const call = body?.call || body;
    const callId: string | undefined = call?.call_id;
    if (!callId) {
      console.warn("[retell-webhook] no call_id");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: lead } = await supabase
      .from("outbound_leads")
      .select("*")
      .eq("retell_call_id", callId)
      .maybeSingle();

    if (!lead) {
      console.warn("[retell-webhook] no lead for call_id", callId);
      return new Response(JSON.stringify({ ok: true, note: "no lead matched" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (lead.call_transcript) {
      console.log("[retell-webhook] already processed, skipping", callId);
      return new Response(JSON.stringify({ ok: true, note: "already processed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const startMs = Number(call.start_timestamp || 0);
    const endMs = Number(call.end_timestamp || 0);
    const durationSec = startMs && endMs ? Math.max(0, Math.round((endMs - startMs) / 1000)) : null;
    const transcript: string = call.transcript || "";
    const recordingUrl: string | null = call.recording_url || null;

    const update: Record<string, unknown> = {
      call_transcript: transcript || null,
      call_recording_url: recordingUrl,
      call_duration_seconds: durationSec,
      last_called_at: new Date().toISOString(),
    };

    // Only run analysis on call_analyzed or when we have a transcript
    let analysis: any = null;
    if (transcript && transcript.trim().length > 20) {
      analysis = await extractWithAI(transcript);
    }

    if (analysis) {
      update.interest_level = analysis.interest_level || null;
      update.existing_solution = analysis.existing_solution || null;
      update.reason_not_interested = analysis.reason_not_interested || null;
      update.demo_booked = !!analysis.demo_booked;

      if (analysis.demo_booked) update.status = "demo_booked";
      else if (analysis.interest_level === "hot" || analysis.interest_level === "warm") update.status = "interested";
      else if (analysis.interest_level === "cold") update.status = "not_interested";
    }

    await supabase.from("outbound_leads").update(update).eq("id", lead.id);

    const firstName = lead.first_name || "Unknown";
    const businessName = lead.business_name || "Unknown business";

    if (analysis?.demo_booked && analysis.demo_datetime) {
      const { error: insertError } = await supabase.from("outbound_demos").insert({
        lead_id: lead.id,
        demo_datetime: analysis.demo_datetime,
        prospect_name: firstName,
        prospect_business: businessName,
        prospect_phone: lead.phone_number,
        prospect_email: analysis.prospect_email || lead.email || null,
        call_summary: transcript.slice(0, 2000),
        status: "scheduled",
      } as any);

      if (insertError) {
        // 23505 = unique_violation on outbound_demos_lead_id_unique → already booked, do NOT email again
        if ((insertError as any).code === "23505") {
          console.log("[retell-webhook] demo already exists for lead, skipping emails", lead.id);
        } else {
          console.error("[retell-webhook] demo insert failed", insertError);
        }
      } else {
        const html = `
          <h2>Demo Booked</h2>
          <p><strong>Name:</strong> ${firstName}</p>
          <p><strong>Business:</strong> ${businessName}</p>
          <p><strong>Phone:</strong> ${lead.phone_number}</p>
          <p><strong>Email:</strong> ${analysis.prospect_email || lead.email || "—"}</p>
          <p><strong>When:</strong> ${analysis.demo_datetime}</p>
          ${recordingUrl ? `<p><a href="${recordingUrl}">Recording</a></p>` : ""}
        `;
        await sendEmail(MO_EMAIL, `Demo Booked — ${firstName} from ${businessName}`, html);

        const prospectEmail = analysis.prospect_email || lead.email;
        if (prospectEmail) {
          await sendEmail(
            prospectEmail,
            `Your Aivia demo with Mo`,
            `<p>Hi ${firstName},</p><p>This is a quick note to confirm your Aivia demo on <strong>${analysis.demo_datetime}</strong>.</p><p>Mo will call you then. Reply to this email if you need to reschedule.</p><p>— Aivia</p>`
          );
        }
      }
    } else if (analysis?.interest_level === "hot") {
      const html = `
        <h2>Hot Lead Needs Follow Up</h2>
        <p><strong>Name:</strong> ${firstName}</p>
        <p><strong>Business:</strong> ${businessName}</p>
        <p><strong>Phone:</strong> ${lead.phone_number}</p>
        <p><strong>Email:</strong> ${analysis.prospect_email || lead.email || "—"}</p>
        ${recordingUrl ? `<p><a href="${recordingUrl}">Recording</a></p>` : ""}
        <hr/>
        <h3>Transcript</h3>
        <pre style="white-space:pre-wrap;font-family:inherit">${transcript.replace(/</g, "&lt;")}</pre>
      `;
      await sendEmail(MO_EMAIL, `Hot Lead Needs Follow Up — ${firstName} from ${businessName}`, html);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[retell-webhook] error", e);
    // Always return 200 so Retell doesn't retry forever
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
