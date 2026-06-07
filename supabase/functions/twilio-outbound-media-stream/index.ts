// Outbound media stream — connects Twilio <Connect><Stream> audio to OpenAI Realtime,
// runs the editable outbound sales prompt with {{first_name}} / {{business_name}} substitution,
// gives Aria live availability tools so she only books demos in approved windows,
// then on call end extracts structured outcome data and triggers emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const FROM_EMAIL = "info@aiviaapp.co.uk";
const MO_EMAIL = "mo@aiviaapp.co.uk";
const DEFAULT_ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah — calm British-ish female fallback
const ELEVENLABS_MODEL_ID = "eleven_flash_v2_5"; // ~150-300ms first-byte, supports ulaw_8000

interface AvailabilityConfig {
  weekly_hours: Record<string, { enabled: boolean; start: string; end: string }>;
  demo_duration_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  max_demos_per_day: number;
  timezone: string;
}
interface Override { date: string; start_time: string | null; end_time: string | null; reason: string | null; }

interface OutboundSession {
  leadId: string;
  lead: any | null;
  callSid: string;
  streamSid: string | null;
  openAiWs: WebSocket | null;
  twilioWs: WebSocket;
  systemPrompt: string;
  voice: string; // legacy OpenAI voice (unused now, kept for back-compat)
  elevenLabsVoiceId: string;
  elevenLabsWs: WebSocket | null;
  ttsResponseId: string | null; // OpenAI response.id currently being synthesised
  transcript: Array<{ role: "user" | "assistant"; text: string }>;
  pendingAssistant: string;
  pendingUser: string;
  closed: boolean;
  availability: AvailabilityConfig | null;
  demoBookedViaTool: { datetime: string; id: string } | null;
}

const DAY_KEYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

function applyPromptVars(template: string, lead: any): string {
  const first = (lead?.first_name || "there").toString();
  const biz = (lead?.business_name || "your business").toString();
  return template.replaceAll("{{first_name}}", first).replaceAll("{{business_name}}", biz);
}

// ─── Availability helpers ───────────────────────────────────────────────────
function partsInTz(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) if (p.type !== "literal") map[p.type] = p.value;
  return map; // year, month, day, hour, minute, weekday (Mon/Tue…)
}

function dateInTz(d: Date, tz: string): string {
  const p = partsInTz(d, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

function weekdayKey(d: Date, tz: string): string {
  const wd = partsInTz(d, tz).weekday.toLowerCase(); // mon, tue…
  const map: Record<string, string> = { mon:"monday", tue:"tuesday", wed:"wednesday", thu:"thursday", fri:"friday", sat:"saturday", sun:"sunday" };
  return map[wd] || "monday";
}

// Convert a local "YYYY-MM-DD HH:MM" in tz to a UTC Date by trial+offset.
function localToUtc(dateStr: string, timeStr: string, tz: string): Date {
  // Try interpreting as UTC, then measure offset, then correct.
  const naive = new Date(`${dateStr}T${timeStr}:00Z`);
  const p = partsInTz(naive, tz);
  const asLocalUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  const diff = asLocalUtc - naive.getTime();
  return new Date(naive.getTime() - diff);
}

async function computeSlots(
  supabase: any,
  cfg: AvailabilityConfig,
  fromDate: Date,
  days = 7,
  limit = 8,
): Promise<{ datetime_iso: string; local_label: string }[]> {
  const tz = cfg.timezone || "Europe/London";
  const minNoticeMs = cfg.min_notice_hours * 3600 * 1000;
  const earliestStart = new Date(Date.now() + minNoticeMs);
  const lastDay = new Date(fromDate.getTime() + days * 86400000);

  // Pull overrides + existing demos in window.
  const fromYmd = dateInTz(fromDate, tz);
  const toYmd = dateInTz(lastDay, tz);
  const [{ data: overrides }, { data: demos }] = await Promise.all([
    supabase.from("outbound_availability_overrides").select("*").gte("date", fromYmd).lte("date", toYmd),
    supabase.from("outbound_demos").select("demo_datetime,status").gte("demo_datetime", fromDate.toISOString()).lte("demo_datetime", lastDay.toISOString()).neq("status", "cancelled"),
  ]);
  const overridesByDate: Record<string, Override[]> = {};
  (overrides || []).forEach((o: Override) => { (overridesByDate[o.date] ||= []).push(o); });
  const bookedTimes = (demos || []).map((d: any) => new Date(d.demo_datetime).getTime());
  const bookedByDate: Record<string, number> = {};
  (demos || []).forEach((d: any) => {
    const k = dateInTz(new Date(d.demo_datetime), tz);
    bookedByDate[k] = (bookedByDate[k] || 0) + 1;
  });

  const slots: { datetime_iso: string; local_label: string }[] = [];
  const duration = cfg.demo_duration_minutes;
  const step = duration + cfg.buffer_minutes;

  for (let i = 0; i < days && slots.length < limit; i++) {
    const day = new Date(fromDate.getTime() + i * 86400000);
    const ymd = dateInTz(day, tz);
    const wkKey = weekdayKey(day, tz);
    const wh = cfg.weekly_hours?.[wkKey];
    if (!wh?.enabled) continue;
    if ((bookedByDate[ymd] || 0) >= cfg.max_demos_per_day) continue;

    // Full-day block?
    const dayOverrides = overridesByDate[ymd] || [];
    const fullBlock = dayOverrides.some(o => !o.start_time && !o.end_time);
    if (fullBlock) continue;

    // Build candidate slot times for the day.
    const [sh, sm] = wh.start.split(":").map(Number);
    const [eh, em] = wh.end.split(":").map(Number);
    const dayStart = localToUtc(ymd, `${String(sh).padStart(2,"0")}:${String(sm).padStart(2,"0")}`, tz);
    const dayEnd = localToUtc(ymd, `${String(eh).padStart(2,"0")}:${String(em).padStart(2,"0")}`, tz);

    for (let t = dayStart.getTime(); t + duration * 60000 <= dayEnd.getTime() && slots.length < limit; t += step * 60000) {
      const slotStart = new Date(t);
      const slotEnd = new Date(t + duration * 60000);
      if (slotStart < earliestStart) continue;

      // Range block?
      const blocked = dayOverrides.some(o => {
        if (!o.start_time || !o.end_time) return false;
        const bStart = localToUtc(ymd, o.start_time.slice(0,5), tz).getTime();
        const bEnd = localToUtc(ymd, o.end_time.slice(0,5), tz).getTime();
        return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
      });
      if (blocked) continue;

      // Existing demo conflict (with buffer)?
      const conflict = bookedTimes.some(b => {
        const bStart = b;
        const bEnd = b + duration * 60000;
        return slotStart.getTime() < bEnd + cfg.buffer_minutes * 60000
            && slotEnd.getTime() + cfg.buffer_minutes * 60000 > bStart;
      });
      if (conflict) continue;

      const label = slotStart.toLocaleString("en-GB", {
        timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      });
      slots.push({ datetime_iso: slotStart.toISOString(), local_label: label });
    }
  }
  return slots;
}

async function validateAndBook(
  supabase: any,
  session: OutboundSession,
  args: { datetime_iso: string; prospect_email?: string },
): Promise<{ ok: boolean; reason?: string; id?: string; local_label?: string }> {
  if (!session.availability) return { ok: false, reason: "Availability config missing." };
  const cfg = session.availability;
  const tz = cfg.timezone || "Europe/London";
  const target = new Date(args.datetime_iso);
  if (isNaN(target.getTime())) return { ok: false, reason: "Invalid datetime." };

  // Re-validate against fresh availability for that single day.
  const dayStart = new Date(target.getTime() - 60000); // small fudge to include
  const candidates = await computeSlots(supabase, cfg, dayStart, 2, 50);
  const match = candidates.find(s => Math.abs(new Date(s.datetime_iso).getTime() - target.getTime()) < 60000);
  if (!match) return { ok: false, reason: "That slot is no longer available." };

  const prospectName = session.lead?.first_name || "";
  const prospectBiz = session.lead?.business_name || "";
  const prospectPhone = session.lead?.phone_number || "";
  const prospectEmail = (args.prospect_email || session.lead?.email || "").trim() || null;
  const dt = new Date(match.datetime_iso);

  const { data: inserted, error } = await supabase.from("outbound_demos").insert({
    lead_id: session.leadId,
    demo_date: dt.toISOString().slice(0, 10),
    demo_time: dt.toISOString().slice(11, 19),
    demo_datetime: dt.toISOString(),
    prospect_name: prospectName,
    prospect_business: prospectBiz,
    prospect_phone: prospectPhone,
    prospect_email: prospectEmail,
    status: "scheduled",
  }).select("id").maybeSingle();
  if (error || !inserted) return { ok: false, reason: error?.message || "Could not save demo." };

  await supabase.from("outbound_leads").update({
    demo_booked: true, status: "demo_booked", email: prospectEmail || session.lead?.email || null,
  }).eq("id", session.leadId);

  session.demoBookedViaTool = { datetime: match.datetime_iso, id: inserted.id };

  // Fire confirmation emails (best effort, non-blocking failures).
  const whenLondon = dt.toLocaleString("en-GB", {
    timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
  sendResendEmail(
    `Demo Booked — ${prospectName} from ${prospectBiz}`,
    `<p>A demo has been booked during an outbound call.</p>
     <ul>
       <li><b>Prospect:</b> ${prospectName}</li>
       <li><b>Business:</b> ${prospectBiz}</li>
       <li><b>Phone:</b> ${prospectPhone}</li>
       <li><b>Email:</b> ${prospectEmail || "—"}</li>
       <li><b>Demo date/time:</b> ${whenLondon}</li>
     </ul>`,
    MO_EMAIL,
  );
  if (prospectEmail) {
    sendResendEmail(
      "Your Aivia Demo is Confirmed",
      `<p>Hi ${prospectName || "there"},</p>
       <p>Your 15 minute demo with Mo, the founder of Aivia, is confirmed for <b>${whenLondon}</b>.</p>
       <p>Mo will call you on ${prospectPhone}.</p>
       <p>If you need to reschedule contact Mo at mo@aiviaapp.co.uk.</p>`,
      prospectEmail,
    );
  }
  return { ok: true, id: inserted.id, local_label: match.local_label };
}

function buildAvailabilitySummary(cfg: AvailabilityConfig | null, overrides: Override[]): string {
  if (!cfg) return "Availability: not configured. Do not propose any specific times.";
  const lines: string[] = [];
  lines.push(`Demo length: ${cfg.demo_duration_minutes} min. Buffer: ${cfg.buffer_minutes} min. Min notice: ${cfg.min_notice_hours}h. Max ${cfg.max_demos_per_day} demos/day. Timezone: ${cfg.timezone}.`);
  lines.push("Weekly working hours:");
  for (const k of ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]) {
    const wh = cfg.weekly_hours?.[k];
    lines.push(`  ${k[0].toUpperCase()+k.slice(1)}: ${wh?.enabled ? `${wh.start}–${wh.end}` : "closed"}`);
  }
  if (overrides.length) {
    lines.push("Upcoming overrides:");
    overrides.slice(0, 10).forEach(o => {
      if (!o.start_time && !o.end_time) lines.push(`  ${o.date}: blocked all day${o.reason ? ` (${o.reason})` : ""}`);
      else lines.push(`  ${o.date} ${o.start_time}–${o.end_time}: blocked${o.reason ? ` (${o.reason})` : ""}`);
    });
  }
  return lines.join("\n");
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
  call_summary: string;
}> {
  const fallback = { interest_level: null, existing_solution: null, reason_not_interested: null, call_summary: transcript.slice(0, 800) } as any;
  if (!LOVABLE_API_KEY || !transcript.trim()) return fallback;
  try {
    const today = new Date().toISOString();
    const sys = `You analyse an outbound sales call transcript between Aria (AI sales rep) and a business owner. Today is ${today}. Reply with ONLY raw JSON, no markdown. Schema:
{"interest_level":"hot|warm|cold|null","existing_solution":"string or null","reason_not_interested":"string or null","call_summary":"3-5 sentences"}`;
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: transcript }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return fallback;
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.replace(/^```json|```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      interest_level: ["hot", "warm", "cold"].includes(parsed.interest_level) ? parsed.interest_level : null,
      existing_solution: parsed.existing_solution || null,
      reason_not_interested: parsed.reason_not_interested || null,
      call_summary: parsed.call_summary || transcript.slice(0, 800),
    };
  } catch {
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
    const demoBooked = !!session.demoBookedViaTool;

    let newStatus: string;
    if (demoBooked) newStatus = "demo_booked";
    else if (outcome.interest_level === "hot" || outcome.interest_level === "warm") newStatus = "interested";
    else if (outcome.reason_not_interested) newStatus = "not_interested";
    else newStatus = "answered";

    await supabase.from("outbound_leads").update({
      call_transcript: transcriptText,
      interest_level: outcome.interest_level,
      existing_solution: outcome.existing_solution,
      reason_not_interested: outcome.reason_not_interested,
      status: newStatus,
    }).eq("id", session.leadId);

    // Update demo summary if one was booked via the tool.
    if (session.demoBookedViaTool) {
      await supabase.from("outbound_demos")
        .update({ call_summary: outcome.call_summary })
        .eq("id", session.demoBookedViaTool.id);
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

const TOOLS = [
  {
    type: "function",
    name: "get_available_slots",
    description: "Returns the next available demo slots that respect Mo's working hours, calendar blocks, existing demos, buffer, and minimum-notice rules. Always call this before proposing any time to the prospect.",
    parameters: {
      type: "object",
      properties: {
        days_ahead: { type: "integer", description: "How many days from now to scan. Default 7.", default: 7 },
      },
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "book_demo_slot",
    description: "Books the demo for the prospect at the given ISO datetime. Must be one of the slots returned by get_available_slots. Only call this after the prospect explicitly agreed to that specific time.",
    parameters: {
      type: "object",
      properties: {
        datetime_iso: { type: "string", description: "ISO 8601 UTC datetime of the chosen slot (copy from get_available_slots)." },
        prospect_email: { type: "string", description: "Email address the prospect gave for confirmation. Optional." },
      },
      required: ["datetime_iso"],
      additionalProperties: false,
    },
  },
];

// ─── ElevenLabs streaming TTS ───────────────────────────────────────────────
// Opens a fresh WS per OpenAI assistant response, streams text in, forwards
// μ-law audio frames out to the Twilio media stream.
function openElevenLabsStream(session: OutboundSession) {
  if (session.elevenLabsWs) {
    try { session.elevenLabsWs.close(); } catch (_) {}
    session.elevenLabsWs = null;
  }
  const voiceId = session.elevenLabsVoiceId || DEFAULT_ELEVENLABS_VOICE_ID;
  const url = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input` +
    `?model_id=${ELEVENLABS_MODEL_ID}` +
    `&output_format=ulaw_8000` +
    `&inactivity_timeout=20` +
    `&auto_mode=true`;
  const ws = new WebSocket(url);
  session.elevenLabsWs = ws;

  ws.onopen = () => {
    // BOS — must be sent first.
    try {
      ws.send(JSON.stringify({
        text: " ",
        voice_settings: { stability: 0.5, similarity_boost: 0.8, speed: 1.0 },
        xi_api_key: ELEVENLABS_API_KEY,
      }));
    } catch (e) { console.error("[outbound] EL BOS failed", e); }
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
      if (data.audio && session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
        session.twilioWs.send(JSON.stringify({
          event: "media",
          streamSid: session.streamSid,
          media: { payload: data.audio },
        }));
      }
      if (data.error) console.error("[outbound] EL error", data.error);
    } catch (e) { console.error("[outbound] EL parse", e); }
  };

  ws.onerror = (e) => console.error("[outbound] EL WS error", e);
  ws.onclose = () => {
    if (session.elevenLabsWs === ws) session.elevenLabsWs = null;
  };
}

function sendTextToElevenLabs(session: OutboundSession, text: string) {
  if (!text) return;
  if (!session.elevenLabsWs || session.elevenLabsWs.readyState !== WebSocket.OPEN) return;
  try {
    session.elevenLabsWs.send(JSON.stringify({ text }));
  } catch (e) { console.error("[outbound] EL send text failed", e); }
}

function closeElevenLabsStream(session: OutboundSession) {
  if (!session.elevenLabsWs) return;
  try {
    if (session.elevenLabsWs.readyState === WebSocket.OPEN) {
      // EOS — empty string signals end-of-stream and triggers final flush.
      session.elevenLabsWs.send(JSON.stringify({ text: "" }));
    }
  } catch (_) {}
  // Don't close immediately — let final audio chunks arrive. EL will close after EOS.
}

function interruptElevenLabsStream(session: OutboundSession) {
  if (session.elevenLabsWs) {
    try { session.elevenLabsWs.close(); } catch (_) {}
    session.elevenLabsWs = null;
  }
  // Tell Twilio to drop any buffered audio so the prospect doesn't hear leftovers.
  if (session.twilioWs.readyState === WebSocket.OPEN && session.streamSid) {
    try {
      session.twilioWs.send(JSON.stringify({
        event: "clear",
        streamSid: session.streamSid,
      }));
    } catch (_) {}
  }
}

async function connectOpenAi(session: OutboundSession, supabase: any) {
  // OpenAI Realtime GA endpoint — STT + LLM + tools only. Audio synthesis goes
  // via ElevenLabs so we can use the same voice library businesses pick from.
  const ws = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-realtime",
    ["realtime", `openai-insecure-api-key.${OPENAI_API_KEY}`],
  );
  session.openAiWs = ws;

  const sendSessionConfig = () => {
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime",
        model: "gpt-realtime",
        instructions: session.systemPrompt,
        output_modalities: ["text"], // text only — ElevenLabs speaks it
        audio: {
          input: {
            format: { type: "audio/pcmu" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.6,
              prefix_padding_ms: 400,
              silence_duration_ms: 900,
              create_response: true,
              interrupt_response: true,
            },
            transcription: { model: "whisper-1" },
          },
        },
        tools: TOOLS,
        tool_choice: "auto",
      },
    }));
  };

  ws.onopen = () => {
    console.log("[outbound] OpenAI WS open");
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "session.created":
          console.log("[outbound] session.created — sending config");
          sendSessionConfig();
          break;
        case "session.updated":
          console.log("[outbound] session.updated — triggering greeting");
          try {
            ws.send(JSON.stringify({
              type: "response.create",
              response: { output_modalities: ["text"] },
            }));
          } catch (_) {}
          break;

        // Prospect started speaking — kill any in-flight TTS and cancel the response.
        case "input_audio_buffer.speech_started":
          interruptElevenLabsStream(session);
          if (session.ttsResponseId) {
            try { ws.send(JSON.stringify({ type: "response.cancel" })); } catch (_) {}
            session.ttsResponseId = null;
          }
          break;

        case "response.created":
          session.ttsResponseId = msg.response?.id || null;
          openElevenLabsStream(session);
          break;

        // GA event for streamed text deltas.
        case "response.output_text.delta":
        case "response.text.delta": {
          const delta: string = msg.delta || "";
          if (delta) {
            session.pendingAssistant += delta;
            sendTextToElevenLabs(session, delta);
          }
          break;
        }

        case "response.output_text.done":
        case "response.text.done":
          if (session.pendingAssistant.trim()) {
            session.transcript.push({ role: "assistant", text: session.pendingAssistant.trim() });
            session.pendingAssistant = "";
          }
          break;

        case "response.done":
          closeElevenLabsStream(session);
          session.ttsResponseId = null;
          break;

        case "conversation.item.input_audio_transcription.completed":
          if (msg.transcript) session.transcript.push({ role: "user", text: msg.transcript });
          break;

        case "response.function_call_arguments.done": {
          const name = msg.name;
          const callId = msg.call_id;
          let args: any = {};
          try { args = JSON.parse(msg.arguments || "{}"); } catch (_) {}
          let output: any = { ok: false, reason: "Unknown tool" };
          try {
            if (name === "get_available_slots") {
              const days = Math.min(Math.max(args.days_ahead || 7, 1), 14);
              const slots = session.availability
                ? await computeSlots(supabase, session.availability, new Date(), days, 8)
                : [];
              output = { slots };
            } else if (name === "book_demo_slot") {
              output = await validateAndBook(supabase, session, args);
            }
          } catch (e) {
            console.error("[outbound] tool error", e);
            output = { ok: false, reason: "Server error." };
          }
          ws.send(JSON.stringify({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: callId, output: JSON.stringify(output) },
          }));
          ws.send(JSON.stringify({ type: "response.create" }));
          break;
        }
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
  if (!ELEVENLABS_API_KEY) return new Response("Missing ELEVENLABS_API_KEY", { status: 500 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  const session: OutboundSession = {
    leadId: "", lead: null, callSid: "", streamSid: null,
    openAiWs: null, twilioWs, systemPrompt: "", voice: "cedar",
    elevenLabsVoiceId: DEFAULT_ELEVENLABS_VOICE_ID,
    elevenLabsWs: null, ttsResponseId: null,
    transcript: [], pendingAssistant: "", pendingUser: "",
    closed: false, availability: null, demoBookedViaTool: null,
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
          if (!session.leadId) { console.error("[outbound] missing lead_id"); twilioWs.close(); return; }
          const { data: lead } = await supabase.from("outbound_leads").select("*").eq("id", session.leadId).maybeSingle();
          if (!lead) { console.error("[outbound] lead not found"); twilioWs.close(); return; }
          session.lead = lead;

          const { data: campaign } = await supabase.from("outbound_campaigns").select("voice").eq("id", lead.campaign_id).maybeSingle();
          if (campaign?.voice) session.voice = campaign.voice;

          const [{ data: settings }, { data: avail }, { data: overrides }] = await Promise.all([
            supabase.from("outbound_settings").select("outbound_prompt, default_voice_id").limit(1).maybeSingle(),
            supabase.from("outbound_availability").select("*").limit(1).maybeSingle(),
            supabase.from("outbound_availability_overrides").select("*")
              .gte("date", new Date().toISOString().slice(0,10))
              .lte("date", new Date(Date.now() + 14 * 86400000).toISOString().slice(0,10))
              .order("date", { ascending: true }),
          ]);
          session.availability = avail as AvailabilityConfig | null;
          if ((settings as any)?.default_voice_id) {
            session.elevenLabsVoiceId = (settings as any).default_voice_id;
          }
          console.log("[outbound] using ElevenLabs voice", session.elevenLabsVoiceId);

          const tpl = settings?.outbound_prompt || "";
          const baseInjected = applyPromptVars(tpl, lead);
          const availSummary = buildAvailabilitySummary(session.availability, (overrides as Override[]) || []);
          const today = new Date().toLocaleString("en-GB", { timeZone: session.availability?.timezone || "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

          session.systemPrompt = `${baseInjected}

Today is ${today} (${session.availability?.timezone || "Europe/London"}).

CONVERSATION STYLE — NON-NEGOTIABLE:
- Speak ONE short thought at a time. Never deliver more than 1–2 sentences in a single turn before stopping to listen.
- After you ask ANY question, STOP TALKING completely and wait for the prospect to answer. Do NOT continue with the next line of your script until they have spoken.
- Your opening MUST be only the greeting + the confirmation question, e.g. "Good afternoon — am I speaking with {{first_name}}?" Then stop. Do not introduce yourself, do not mention Aivia, do not pitch anything until they actually confirm it is them.
- If they say "yes" or "speaking", THEN do your AI disclosure in one short sentence and ask if now is an okay moment. Then stop again.
- If they interrupt, immediately stop talking and listen.
- Match the prospect's energy. Be warm, human, a little casual. Use natural fillers ("right", "got it", "totally") sparingly.
- Never monologue. Never stack 3 things in one breath. If you catch yourself about to say "and also" — stop instead.
- When you don't know something, say so honestly and offer to have Mo follow up.
- If they say no twice, gracefully wrap up and end the call.

DEMO BOOKING RULES — FOLLOW EXACTLY:
1. Before proposing ANY specific date or time, call the tool get_available_slots.
2. Offer only 2 or 3 of the returned slots, spoken naturally (e.g. "I've got Tuesday at 10am or Wednesday at 2pm, which works better?"). Never invent times. Then stop and wait.
3. When the prospect picks a specific slot, call book_demo_slot with the exact datetime_iso from get_available_slots.
4. WAIT for the tool result. If ok: true, then verbally confirm the booking. If ok: false, briefly apologise and offer one of the other slots.
5. Ask for their email so we can send the confirmation, and pass it as prospect_email when you book.
6. Never claim a demo is booked before book_demo_slot returns ok: true.

CURRENT AVAILABILITY (for your context — always re-check via get_available_slots before offering):
${availSummary}`;


          await connectOpenAi(session, supabase);
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
