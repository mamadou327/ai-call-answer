import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// ============================================================================
// HELPERS
// ============================================================================

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getPollyVoice(voiceGender: string, primaryLanguage: string): string {
  // Use neural voices for more natural UK English sound
  if (primaryLanguage?.toLowerCase().includes("english")) {
    return voiceGender === "male" ? "Polly.Brian-Neural" : "Polly.Amy-Neural";
  }
  // US English neural voices as fallback
  return voiceGender === "male" ? "Polly.Matthew-Neural" : "Polly.Joanna-Neural";
}

// TwiML response with Gather for continuing conversation (no extra prompt - AI reply handles the question)
function twimlContinue(sayText: string, actionUrl: string, voice: string, timeout: number = 6): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-GB">${escapeXml(sayText)}</Say>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="auto" language="en-GB"/>
  <Say voice="${voice}" language="en-GB">I didn't hear anything. If you need help, just give us another call. Goodbye!</Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// TwiML response for ending the call
function twimlEnd(sayText: string, voice: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-GB">${escapeXml(sayText)}</Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// TwiML response for clarification
function twimlClarify(sayText: string, actionUrl: string, voice: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="6" speechTimeout="auto" language="en-GB">
    <Say voice="${voice}" language="en-GB">${escapeXml(sayText)}</Say>
  </Gather>
  <Say voice="${voice}" language="en-GB">I still didn't catch that. Please call back if you need help. Goodbye!</Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Simple error TwiML
function twimlError(message: string, voice: string = "Polly.Amy-Neural"): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-GB">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Day name mappings (DB: Monday=0...Sunday=6, JS: Sunday=0...Saturday=6)
const DB_DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function jsToDbDay(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

// ============================================================================
// AI VOICE ASSISTANT LOGIC
// ============================================================================

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

async function processWithAI(
  lovableApiKey: string,
  businessContext: string,
  conversationHistory: Message[],
  userInput: string
): Promise<{ reply: string; action?: any; shouldEnd: boolean }> {
  
  const systemPrompt = `You are an AI phone receptionist for a UK-based business. Speak naturally, warmly, and concisely.

${businessContext}

═══════════════════════════════════════════════════════════════
YOUR ROLE AS PHONE RECEPTIONIST
═══════════════════════════════════════════════════════════════

Handle phone calls for bookings and inquiries. You can:
1. CREATE BOOKINGS - Must collect: service, date/time, customer name
2. CANCEL BOOKINGS - Need booking code or customer name
3. RESCHEDULE BOOKINGS - Find booking first, then new date/time  
4. ANSWER QUESTIONS - Services, pricing, opening hours, etc.
5. TAKE MESSAGES - For the business owner/staff

═══════════════════════════════════════════════════════════════
CRITICAL: SERVICE SELECTION FOR BOOKINGS
═══════════════════════════════════════════════════════════════

When creating a booking, you MUST know which service the caller wants.
- If the caller says "I want to book an appointment" WITHOUT specifying a service, you MUST ask which service they'd like.
- Look at the SERVICES list above and offer them as options.
- Example: "Sure! We offer haircuts, beard trims, and skin fades. Which service would you like?"
- Only proceed with date/time questions AFTER the service is confirmed.
- If the caller mentions a specific service (e.g. "book a skin fade"), you can proceed to date/time.

═══════════════════════════════════════════════════════════════
CONVERSATION FLOW - DO NOT REPEAT "ANYTHING ELSE"
═══════════════════════════════════════════════════════════════

- Ask ONE question at a time
- While gathering details (service, date, time, name), just ask the next required piece of info
- DO NOT say "Is there anything else?" while still collecting booking details
- ONLY ask "Is there anything else?" AFTER completing an action (booking confirmed, cancelled, etc.)
- Keep responses SHORT (1-2 sentences for questions, 2-3 for confirmations)
- Use natural UK English speech patterns

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT (JSON)
═══════════════════════════════════════════════════════════════

Always respond with valid JSON:
{
  "reply": "What you say to the caller",
  "action": null or { "type": "create_booking|cancel_booking|reschedule_booking", "params": {...} },
  "shouldEnd": false or true
}

ACTION PARAMETERS:
- create_booking: { customer_name, customer_phone (optional), service_name, staff_name (optional), date (YYYY-MM-DD), time (HH:MM) }
- cancel_booking: { booking_code or customer_name }
- reschedule_booking: { booking_code or customer_name, new_date, new_time }

Set shouldEnd = true ONLY when caller says goodbye or explicitly says they're done.

═══════════════════════════════════════════════════════════════
EXAMPLES - NATURAL CONVERSATION FLOW
═══════════════════════════════════════════════════════════════

User: "I want to book an appointment"
{"reply":"Of course! We offer haircuts, skin fades, beard trims, and children's cuts. Which service would you like?","action":null,"shouldEnd":false}

User: "A haircut please"
{"reply":"Lovely, a haircut. What day works best for you?","action":null,"shouldEnd":false}

User: "Tomorrow"
{"reply":"And what time would you prefer?","action":null,"shouldEnd":false}

User: "2pm"
{"reply":"Great, tomorrow at 2pm for a haircut. What name should I put the booking under?","action":null,"shouldEnd":false}

User: "John Smith"
{"reply":"Perfect! I've booked John Smith in for a haircut tomorrow at 2pm. Is there anything else I can help with?","action":{"type":"create_booking","params":{"customer_name":"John Smith","service_name":"haircut","date":"[TOMORROW_DATE]","time":"14:00"}},"shouldEnd":false}

User: "No that's all thanks"
{"reply":"Brilliant! Thanks for calling, have a lovely day. Goodbye!","action":null,"shouldEnd":true}`;

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userInput }
  ];

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[VoiceAI] AI Gateway error:", response.status, errorText);
      return {
        reply: "I'm sorry, I'm having a little trouble right now. Could you please repeat that?",
        shouldEnd: false
      };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // Clean markdown if present
    content = content.trim();
    if (content.startsWith("```json")) content = content.slice(7);
    else if (content.startsWith("```")) content = content.slice(3);
    if (content.endsWith("```")) content = content.slice(0, -3);
    content = content.trim();

    try {
      const parsed = JSON.parse(content);
      return {
        reply: parsed.reply || "How can I help you?",
        action: parsed.action || null,
        shouldEnd: parsed.shouldEnd === true
      };
    } catch {
      // If JSON parsing fails, use the content as the reply
      return { reply: content || "How can I help you?", shouldEnd: false };
    }
  } catch (error) {
    console.error("[VoiceAI] Error calling AI:", error);
    return {
      reply: "I'm sorry, something went wrong. Please try again.",
      shouldEnd: false
    };
  }
}

// ============================================================================
// ACTION HANDLERS (simplified versions for voice)
// ============================================================================

async function executeAction(
  supabase: any,
  businessId: string,
  action: any,
  context: any
): Promise<string | null> {
  if (!action || !action.type) return null;

  const { type, params } = action;

  if (type === "create_booking") {
    return await handleCreateBooking(supabase, businessId, params, context);
  }

  if (type === "cancel_booking") {
    return await handleCancelBooking(supabase, businessId, params, context);
  }

  if (type === "reschedule_booking") {
    return await handleRescheduleBooking(supabase, businessId, params, context);
  }

  return null;
}

async function handleCreateBooking(
  supabase: any,
  businessId: string,
  params: any,
  context: any
): Promise<string | null> {
  const { customer_name, customer_phone, service_name, staff_name, date, time } = params;

  if (!customer_name || !date || !time) {
    console.log("[VoiceAction] Create booking missing params:", params);
    return null;
  }

  // Find service
  let serviceId = null;
  let duration = 60;
  if (service_name && context.services) {
    const service = context.services.find((s: any) => 
      s.name.toLowerCase().includes(service_name.toLowerCase())
    );
    if (service) {
      serviceId = service.id;
      duration = service.duration_minutes || 60;
    }
  }

  // Find staff
  let staffId = null;
  if (staff_name && context.staff) {
    const staff = context.staff.find((s: any) =>
      s.name.toLowerCase().includes(staff_name.toLowerCase())
    );
    if (staff) {
      staffId = staff.id;
    }
  }

  const startDate = new Date(`${date}T${time}:00`);
  const endDate = new Date(startDate.getTime() + duration * 60000);

  if (isNaN(startDate.getTime())) {
    console.log("[VoiceAction] Invalid date/time:", date, time);
    return null;
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name,
      customer_phone: customer_phone || "Phone call",
      service_id: serviceId,
      staff_id: staffId,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed",
      created_by: "Aivia Voice AI",
    })
    .select("id, booking_code")
    .single();

  if (error) {
    console.error("[VoiceAction] Booking error:", error);
    return null;
  }

  console.log("[VoiceAction] Created booking:", booking.booking_code);
  return booking.booking_code;
}

async function handleCancelBooking(
  supabase: any,
  businessId: string,
  params: any,
  context: any
): Promise<string | null> {
  const { booking_code, customer_name } = params;

  let booking: any = null;

  if (booking_code) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, customer_name")
      .eq("business_id", businessId)
      .ilike("booking_code", `%${booking_code}%`)
      .neq("status", "cancelled")
      .single();
    booking = data;
  } else if (customer_name) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, customer_name")
      .eq("business_id", businessId)
      .ilike("customer_name", `%${customer_name}%`)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(1)
      .single();
    booking = data;
  }

  if (!booking) {
    console.log("[VoiceAction] No booking found to cancel:", params);
    return null;
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (error) {
    console.error("[VoiceAction] Cancel error:", error);
    return null;
  }

  console.log("[VoiceAction] Cancelled booking:", booking.booking_code);
  return booking.booking_code;
}

async function handleRescheduleBooking(
  supabase: any,
  businessId: string,
  params: any,
  context: any
): Promise<string | null> {
  const { booking_code, customer_name, new_date, new_time } = params;

  if (!new_date || !new_time) {
    return null;
  }

  let booking: any = null;

  if (booking_code) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, service_id, services:service_id(duration_minutes)")
      .eq("business_id", businessId)
      .ilike("booking_code", `%${booking_code}%`)
      .neq("status", "cancelled")
      .single();
    booking = data;
  } else if (customer_name) {
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_code, service_id, services:service_id(duration_minutes)")
      .eq("business_id", businessId)
      .ilike("customer_name", `%${customer_name}%`)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(1)
      .single();
    booking = data;
  }

  if (!booking) {
    return null;
  }

  const startDate = new Date(`${new_date}T${new_time}:00`);
  const duration = booking.services?.duration_minutes || 60;
  const endDate = new Date(startDate.getTime() + duration * 60000);

  if (isNaN(startDate.getTime())) {
    return null;
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
    })
    .eq("id", booking.id);

  if (error) {
    console.error("[VoiceAction] Reschedule error:", error);
    return null;
  }

  console.log("[VoiceAction] Rescheduled booking:", booking.booking_code);
  return booking.booking_code;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Extract token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    console.log("[VoiceContinue] Called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-voice-continue") {
      return twimlError("Configuration error. Goodbye.");
    }

    // Parse Twilio parameters
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    const callSid = params.CallSid || "";
    const speechResult = params.SpeechResult || "";
    const confidence = params.Confidence || "";
    const fromNumber = params.From || params.Caller || "";

    console.log("[VoiceContinue] Speech:", { callSid, speechResult, confidence });

    // Find business by token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, twilio_enabled, aivia_active")
      .eq("twilio_webhook_token", token)
      .maybeSingle();

    if (businessError || !business) {
      console.error("[VoiceContinue] Business not found:", businessError);
      return twimlError("Sorry, something went wrong. Goodbye.");
    }

    if (!business.twilio_enabled || !business.aivia_active) {
      return twimlError("This line is not currently active. Goodbye.");
    }

    // Get business settings
    const { data: settings } = await supabase
      .from("business_settings")
      .select("assistant_name, tone, primary_language, voice_gender")
      .eq("business_id", business.id)
      .maybeSingle();

    const voice = getPollyVoice(settings?.voice_gender || "female", settings?.primary_language || "English");
    const assistantName = settings?.assistant_name || "Aivia";
    const continueUrl = `${supabaseUrl}/functions/v1/twilio-voice-continue/${token}`;

    // Handle empty speech result
    if (!speechResult || speechResult.trim() === "") {
      console.log("[VoiceContinue] No speech detected, asking for clarification");
      return twimlClarify(
        "Sorry, I didn't catch that. Could you please repeat what you need help with?",
        continueUrl,
        voice
      );
    }

    // Get or create conversation
    let { data: conversation } = await supabase
      .from("call_conversations")
      .select("*")
      .eq("call_sid", callSid)
      .maybeSingle();

    if (!conversation) {
      // Create new conversation if not found
      const { data: newConv, error: convError } = await supabase
        .from("call_conversations")
        .insert({
          call_sid: callSid,
          business_id: business.id,
          caller_phone: fromNumber,
          messages: [],
          status: "active",
        })
        .select()
        .single();

      if (convError) {
        console.error("[VoiceContinue] Error creating conversation:", convError);
      }
      conversation = newConv;
    }

    // Get conversation history
    const messages: Message[] = conversation?.messages || [];

    // Fetch business context for AI
    const [
      { data: services },
      { data: staff },
      { data: openingHours },
      { data: upcomingBookings }
    ] = await Promise.all([
      supabase.from("services").select("id, name, duration_minutes, price").eq("business_id", business.id),
      supabase.from("staff").select("id, name, role").eq("business_id", business.id),
      supabase.from("opening_hours").select("*").eq("business_id", business.id).order("day_of_week"),
      supabase.from("bookings")
        .select("booking_code, customer_name, start_time, service:service_id(name), staff:staff_id(name)")
        .eq("business_id", business.id)
        .neq("status", "cancelled")
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(20)
    ]);

    // Build business context
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const dbDayToday = jsToDbDay(now.getDay());

    const formattedHours = openingHours?.map((h: any) => ({
      day: DB_DAY_NAMES[h.day_of_week],
      isClosed: h.is_closed,
      open: h.open_time,
      close: h.close_time,
    })) || [];

    const businessContext = `
BUSINESS: ${business.business_name}
ASSISTANT NAME: ${assistantName}
CALLER PHONE: ${fromNumber}

CURRENT DATE & TIME:
- Now: ${now.toISOString()}
- Today: ${DB_DAY_NAMES[dbDayToday]}, ${todayStr}
- Tomorrow: ${tomorrowStr}

SERVICES:
${services?.map((s: any) => `- ${s.name}: ${s.duration_minutes}min, £${s.price}`).join("\n") || "No services configured"}

STAFF:
${staff?.map((s: any) => `- ${s.name} (${s.role})`).join("\n") || "No staff configured"}

OPENING HOURS:
${formattedHours.map((h: any) => `- ${h.day}: ${h.isClosed ? "CLOSED" : `${h.open} - ${h.close}`}`).join("\n") || "Not configured"}

UPCOMING BOOKINGS (for reference):
${upcomingBookings?.slice(0, 10).map((b: any) => 
  `- ${b.booking_code}: ${b.customer_name} on ${new Date(b.start_time).toLocaleDateString()} at ${new Date(b.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
).join("\n") || "No upcoming bookings"}
`;

    // Process with AI
    const aiResult = await processWithAI(lovableApiKey, businessContext, messages, speechResult);
    console.log("[VoiceContinue] AI result:", aiResult);

    // Execute any actions
    if (aiResult.action) {
      const actionResult = await executeAction(supabase, business.id, aiResult.action, { services, staff });
      if (actionResult) {
        console.log("[VoiceContinue] Action executed, code:", actionResult);
      }
    }

    // Update conversation history
    const updatedMessages = [
      ...messages,
      { role: "user", content: speechResult },
      { role: "assistant", content: aiResult.reply }
    ];

    await supabase
      .from("call_conversations")
      .update({
        messages: updatedMessages,
        status: aiResult.shouldEnd ? "completed" : "active",
        intent: aiResult.action?.type || conversation?.intent,
      })
      .eq("call_sid", callSid);

    // Update call log outcome if ending
    if (aiResult.shouldEnd) {
      await supabase
        .from("calls_log")
        .update({
          call_outcome: aiResult.action?.type || "answered",
          call_type: aiResult.action?.type === "create_booking" ? "new_booking" :
                     aiResult.action?.type === "cancel_booking" ? "cancel" :
                     aiResult.action?.type === "reschedule_booking" ? "reschedule" : "question",
          summary: `Caller: ${speechResult.substring(0, 100)}...`,
        })
        .eq("twilio_call_sid", callSid);

      return twimlEnd(aiResult.reply, voice);
    }

    // Continue the conversation
    return twimlContinue(aiResult.reply, continueUrl, voice);

  } catch (error) {
    console.error("[VoiceContinue] Error:", error);
    return twimlError("Sorry, something went wrong on our side. Please call again later. Goodbye.");
  }
});
