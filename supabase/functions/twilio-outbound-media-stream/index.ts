// Outbound media stream — connects Twilio <Connect><Stream> audio to OpenAI Realtime,
// runs the editable outbound sales prompt with {{first_name}} / {{business_name}} substitution,
// then on call end extracts structured outcome data and triggers emails / demo booking.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FROM_EMAIL = "info@aiviaapp.co.uk";
const MO_EMAIL = "mo@aiviaapp.co.uk";

interface OutboundSession {
  leadId: string;
  lead: any | null;
  callSid: string;
  streamSid: string | null;
  openAiWs: WebSocket | null;
  twilioWs: WebSocket;
  systemPrompt: string;
  transcript: Array<{ role: "user" | "assistant"; text: string }>;
  pendingAssistant: string;
  pendingUser: string;
  closed: boolean;
}

function applyPromptVars(template: string, lead: any): string {
  const first = (lead?.first_name || "there").toString();
  const biz = (lead?.business_name || "your business").toString();
  return template.replaceAll("{{first_name}}", first).replaceAll("{{business_name}}", biz);
}

async function sendResendEmail(subject: string, html: string, to: string) {
  if (!RESEND_API_KEY) return;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: `Aivia <${FROM_EMAIL}>`, to: [to], subject, html }),
    });
    if (!r.ok) console.error("[outbound] resend error", await r.text());
  } catch (e) {
    console.error("[outbound] resend send failed", e);
  }
}

async function extractOutcome(transcript: string): Promise<{
  interest_level: "hot" | "warm" | "cold" | null;
  existing_solution: string | null;
  reason_not_interested: string | null;
  demo_agreed: boolean;
  demo_datetime_iso: string | null;
  prospect_email: string | null;
  call_summary: string;
}> {
  const fallback = {
    interest_level: null, existing_solution: null, reason_not_interested: null,
    demo_agreed: false, demo_datetime_iso: null, prospect_email: null,
    call_summary: transcript.slice(0, 800),
  } as any;
  if (!LOVABLE_API_KEY || !transcript.trim()) return fallback;
  try {
    const today = new Date().toISOString();
    const sys = `You analyse an outbound sales call transcript between Aria (AI sales rep) and a business owner. Today is ${today}. Reply with ONLY raw JSON, no markdown. Schema:
{"interest_level":"hot|warm|cold|null","existing_solution":"string or null","reason_not_interested":"string or null","demo_agreed":true|false,"demo_datetime_iso":"ISO8601 future datetime or null","prospect_email":"string or null","call_summary":"3-5 sentences"}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: transcript }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) { console.error("[outbound] extract error", await r.text()); return fallback; }
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/^```json|```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      interest_level: ["hot", "warm", "cold"].includes(parsed.interest_level) ? parsed.interest_level : null,
      existing_solution: parsed.existing_solution || null,
      reason_not_interested: parsed.reason_not_interested || null,
      demo_agreed: !!parsed.demo_agreed,
      demo_datetime_iso: parsed.demo_datetime_iso || null,
      prospect_email: parsed.prospect_email || null,
      call_summary: parsed.call_summary || transcript.slice(0, 800),
    };
  } catch (e) {
    console.error("[outbound] extract failed", e);
    return fallback;
  }
}

async function finalizeCall(session: OutboundSession, supabase: any) {
  if (session.closed) return;
  session.closed = true;
  try {
    const transcriptText = session.transcript
      .map((t) => `${t.role === "assistant" ? "Aria" : "Prospect"}: ${t.text}`)
      .join("\n");
    const outcome = await extractOutcome(transcriptText);

    let newStatus: string = "answered";
    if (outcome.demo_agreed) newStatus = "demo_booked";
    else if (outcome.interest_level === "hot" || outcome.interest_level === "warm") newStatus = "interested";
    else if (outcome.reason_not_interested) newStatus = "not_interested";

    const update: Record<string, unknown> = {
      call_transcript: transcriptText,
      interest_level: outcome.interest_level,
      existing_solution: outcome.existing_solution,
      reason_not_interested: outcome.reason_not_interested,
      demo_booked: outcome.demo_agreed,
      status: newStatus,
      email: outcome.prospect_email || session.lead?.email || null,
    };
    await supabase.from("outbound_leads").update(update).eq("id", session.leadId);

    if (outcome.demo_agreed && outcome.demo_datetime_iso) {
      const dt = new Date(outcome.demo_datetime_iso);
      const dateStr = dt.toISOString().slice(0, 10);
      const timeStr = dt.toISOString().slice(11, 19);
      const prospectName = session.lead?.first_name || "";
      const prospectBiz = session.lead?.business_name || "";
      const prospectPhone = session.lead?.phone_number || "";
      const prospectEmail = outcome.prospect_email || session.lead?.email || "";

      await supabase.from("outbound_demos").insert({
        lead_id: session.leadId,
        demo_date: dateStr,
        demo_time: timeStr,
        demo_datetime: dt.toISOString(),
        prospect_name: prospectName,
        prospect_business: prospectBiz,
        prospect_phone: prospectPhone,
        prospect_email: prospectEmail,
        call_summary: outcome.call_summary,
        status: "scheduled",
      });

      const whenLondon = dt.toLocaleString("en-GB", {
        timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      });

      await sendResendEmail(
        `Demo Booked — ${prospectName} from ${prospectBiz}`,
        `<p>A demo has been booked during an outbound call.</p>
         <ul>
           <li><b>Prospect:</b> ${prospectName}</li>
           <li><b>Business:</b> ${prospectBiz}</li>
           <li><b>Phone:</b> ${prospectPhone}</li>
           <li><b>Email:</b> ${prospectEmail || "—"}</li>
           <li><b>Demo date/time:</b> ${whenLondon}</li>
           <li><b>What they currently use:</b> ${outcome.existing_solution || "—"}</li>
         </ul>
         <p><b>Key points from the call:</b><br/>${outcome.call_summary.replace(/\n/g, "<br/>")}</p>`,
        MO_EMAIL,
      );

      if (prospectEmail) {
        await sendResendEmail(
          "Your Aivia Demo is Confirmed",
          `<p>Hi ${prospectName || "there"},</p>
           <p>Your 15 minute demo with Mo, the founder of Aivia, is confirmed for <b>${whenLondon}</b>.</p>
           <p>Mo will call you on ${prospectPhone}.</p>
           <p>Aivia is an AI receptionist that answers every call for your business 24 hours a day, takes bookings, handles enquiries and sends confirmation texts automatically.</p>
           <p>If you need to reschedule contact Mo at mo@aiviaapp.co.uk.</p>
           <p>We look forward to speaking with you.</p>`,
          prospectEmail,
        );
      }
    } else if (outcome.interest_level === "hot") {
      await sendResendEmail(
        `Hot Lead Needs Follow Up — ${session.lead?.first_name || ""} from ${session.lead?.business_name || ""}`,
        `<p>A prospect showed strong interest but did not book a demo.</p>
         <ul>
           <li><b>Name:</b> ${session.lead?.first_name || ""}</li>
           <li><b>Business:</b> ${session.lead?.business_name || ""}</li>
           <li><b>Phone:</b> ${session.lead?.phone_number || ""}</li>
         </ul>
         <p><b>What was said on the call:</b><br/>${outcome.call_summary.replace(/\n/g, "<br/>")}</p>`,
        MO_EMAIL,
      );
    }
  } catch (e) {
    console.error("[outbound] finalize error", e);
  }
}

async function connectOpenAi(session: OutboundSession) {
  const ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-realtime",
    ["realtime", `openai-insecure-api-key.${OPENAI_API_KEY}`, "openai-beta.realtime-v1"],
  );
  session.openAiWs = ws;

  ws.onopen = () => {
    console.log("[outbound] OpenAI WS open");
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions: session.systemPrompt,
        voice: "alloy",
        input_audio_format: "g711_ulaw",
        output_audio_format: "g711_ulaw",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 },
        temperature: 0.8,
      },
    }));
    // Aria speaks first (outbound call — we initiated it).
    setTimeout(() => {
      try {
        ws.send(JSON.stringify({
          type: "response.create",
          response: { modalities: ["text", "audio"] },
        }));
      } catch (_) {}
    }, 400);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "response.audio.delta":
          if (session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
            session.twilioWs.send(JSON.stringify({
              event: "media",
              streamSid: session.streamSid,
              media: { payload: msg.delta },
            }));
          }
          break;
        case "response.audio_transcript.delta":
          session.pendingAssistant += msg.delta || "";
          break;
        case "response.audio_transcript.done":
          if (session.pendingAssistant.trim()) {
            session.transcript.push({ role: "assistant", text: session.pendingAssistant.trim() });
            session.pendingAssistant = "";
          }
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (msg.transcript) session.transcript.push({ role: "user", text: msg.transcript });
          break;
        case "error":
          console.error("[outbound] OpenAI error", msg);
          break;
      }
    } catch (e) {
      console.error("[outbound] OpenAI msg parse", e);
    }
  };

  ws.onerror = (e) => console.error("[outbound] OpenAI WS error", e);
  ws.onclose = () => console.log("[outbound] OpenAI WS closed");
}

Deno.serve(async (req) => {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket", { status: 400 });
  }
  if (!OPENAI_API_KEY) return new Response("Missing OPENAI_API_KEY", { status: 500 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  const session: OutboundSession = {
    leadId: "",
    lead: null,
    callSid: "",
    streamSid: null,
    openAiWs: null,
    twilioWs,
    systemPrompt: "",
    transcript: [],
    pendingAssistant: "",
    pendingUser: "",
    closed: false,
  };

  twilioWs.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      switch (data.event) {
        case "start": {
          session.streamSid = data.start.streamSid;
          session.callSid = data.start.callSid;
          session.leadId = data.start.customParameters?.lead_id || "";
          console.log("[outbound] stream start", { callSid: session.callSid, leadId: session.leadId });
          if (!session.leadId) {
            console.error("[outbound] missing lead_id");
            twilioWs.close();
            return;
          }
          const { data: lead } = await supabase.from("outbound_leads").select("*").eq("id", session.leadId).maybeSingle();
          if (!lead) { console.error("[outbound] lead not found"); twilioWs.close(); return; }
          session.lead = lead;
          const { data: settings } = await supabase.from("outbound_settings").select("outbound_prompt").limit(1).maybeSingle();
          const tpl = settings?.outbound_prompt || "";
          session.systemPrompt = applyPromptVars(tpl, lead);
          await connectOpenAi(session);
          break;
        }
        case "media":
          if (session.openAiWs?.readyState === WebSocket.OPEN) {
            session.openAiWs.send(JSON.stringify({
              type: "input_audio_buffer.append",
              audio: data.media.payload,
            }));
          }
          break;
        case "stop":
          console.log("[outbound] stream stop");
          try { session.openAiWs?.close(); } catch (_) {}
          await finalizeCall(session, supabase);
          break;
      }
    } catch (e) {
      console.error("[outbound] twilio msg error", e);
    }
  };

  twilioWs.onclose = async () => {
    try { session.openAiWs?.close(); } catch (_) {}
    await finalizeCall(session, supabase);
  };

  twilioWs.onerror = (e) => console.error("[outbound] twilio WS error", e);

  return response;
});
