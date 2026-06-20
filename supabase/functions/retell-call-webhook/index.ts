import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MO_EMAIL = "mo@aiviaapp.co.uk";
const BUSINESS_TIME_ZONE = "Europe/London";

function getBusinessCurrentYear(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: BUSINESS_TIME_ZONE,
      year: "numeric",
    }).format(date)
  );
}

function transcriptMentionsExplicitYear(transcript: string): boolean {
  return /\b20\d{2}\b/.test(transcript);
}

function normalizeInferredDemoDatetime(rawValue: string, transcript: string): string | null {
  const parsed = new Date(rawValue);
  if (isNaN(parsed.getTime())) return null;

  if (transcriptMentionsExplicitYear(transcript)) {
    return parsed.toISOString();
  }

  const now = new Date();
  const currentYear = getBusinessCurrentYear(now);
  const inferred = new Date(parsed);

  if (inferred.getUTCFullYear() !== currentYear) {
    inferred.setUTCFullYear(currentYear);
    if (inferred.getTime() < now.getTime() - 5 * 60 * 1000) {
      inferred.setUTCFullYear(currentYear + 1);
    }
  }

  return inferred.toISOString();
}

async function extractWithAI(transcript: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: BUSINESS_TIME_ZONE,
  });
  const nowIso = new Date().toISOString();
  const currentYear = getBusinessCurrentYear();

  const sys = `You read sales call transcripts and reply with ONLY a JSON object (no markdown, no prose) with this exact shape:
{"interest_level":"hot|warm|cold","existing_solution":string|null,"reason_not_interested":string|null,"demo_booked":boolean,"demo_datetime":string|null,"prospect_email":string|null}

CRITICAL DATE CONTEXT:
- Today is ${todayStr}. Current instant: ${nowIso}. Timezone: ${BUSINESS_TIME_ZONE}. Current year: ${currentYear}.
- Resolve every relative phrase ("tomorrow", "next Tuesday", "the 15th", "in two weeks") against TODAY.
- If the caller does NOT explicitly say a year, you MUST infer the year from today: use ${currentYear}, or ${currentYear + 1} only if the ${currentYear} date would already be in the past.
- demo_datetime MUST be an ISO 8601 datetime string on or AFTER today. Never output a date in the past or in a prior year.
- If no specific date and time were agreed, set demo_datetime to null and demo_booked to false.`;

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

async function verifyRetellSignature(rawBody: string, signature: string | null, apiKey: string): Promise<boolean> {
  if (!signature || !apiKey) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(apiKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
    const bytes = new Uint8Array(sig);
    let hex = "";
    for (const b of bytes) hex += b.toString(16).padStart(2, "0");
    const expected = hex.toLowerCase();
    const got = signature.replace(/^sha256=/i, "").toLowerCase();
    return expected === got;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const RETELL_API_KEY = Deno.env.get("RETELL_API_KEY") || "";
    const signature = req.headers.get("x-retell-signature") || req.headers.get("retell-signature");
    const sigOk = await verifyRetellSignature(rawBody, signature, RETELL_API_KEY);
    if (!sigOk) {
      console.warn("[retell-webhook] invalid signature");
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = JSON.parse(rawBody);
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
      if (analysis.demo_booked && analysis.demo_datetime) {
        const normalized = normalizeInferredDemoDatetime(analysis.demo_datetime, transcript);
        if (!normalized) {
          console.warn("[retell-webhook] rejecting demo_booked with unparseable datetime", analysis.demo_datetime);
          analysis.demo_booked = false;
          analysis.demo_datetime = null;
        } else {
          if (normalized !== analysis.demo_datetime) {
            console.warn("[retell-webhook] corrected inferred demo year", {
              from: analysis.demo_datetime,
              to: normalized,
            });
          }
          analysis.demo_datetime = normalized;
        }
      }

      // Guard: reject demo bookings with missing, unparseable, or past datetimes
      if (analysis.demo_booked) {
        const dt = analysis.demo_datetime ? new Date(analysis.demo_datetime) : null;
        const valid = dt && !isNaN(dt.getTime()) && dt.getTime() >= Date.now() - 5 * 60 * 1000;
        if (!valid) {
          console.warn("[retell-webhook] rejecting demo_booked with invalid/past datetime", analysis.demo_datetime);
          analysis.demo_booked = false;
          analysis.demo_datetime = null;
        }
      }

      update.interest_level = analysis.interest_level || null;
      update.existing_solution = analysis.existing_solution || null;
      update.reason_not_interested = analysis.reason_not_interested || null;
      update.demo_booked = !!analysis.demo_booked;

      // If Twilio already flagged this call as no_answer (e.g. voicemail picked up via AMD),
      // don't overwrite the status based on a voicemail-greeting transcript.
      const alreadyNoAnswer = lead.status === "no_answer";
      if (analysis.demo_booked) {
        update.status = "demo_booked";
        update.sequence_status = "demo_booked";
      } else if (analysis.interest_level === "hot" || analysis.interest_level === "warm") {
        update.status = "interested";
      } else if (analysis.interest_level === "cold" && !alreadyNoAnswer) {
        update.status = "not_interested";
        update.sequence_status = "not_interested";
      } else if (alreadyNoAnswer) {
        console.info(`[retell-webhook] preserving no_answer status for lead=${lead.id}`);
      }
      if (analysis.do_not_call) {
        update.status = "do_not_call";
        update.sequence_status = "do_not_call";
      }
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
