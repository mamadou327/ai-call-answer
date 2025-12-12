import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Supported OpenAI Realtime voices
const OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];

interface StreamSession {
  businessId: string;
  businessName: string;
  callSid: string;
  callerPhone: string;
  callerName: string | null;
  systemPrompt: string;
  voice: string;
  streamSid: string | null;
  openAiWs: WebSocket | null;
  twilioWs: WebSocket | null;
  pendingToolCalls: Map<string, any>;
}

interface CallerInfo {
  isReturning: boolean;
  name?: string;
  totalVisits?: number;
  preferredStaff?: string;
  preferredStaffId?: string;
  lastBooking?: {
    service: string;
    serviceId?: string;
    date: string;
    staff: string;
    staffId?: string;
  };
  upcomingBooking?: {
    code: string;
    service: string;
    date: string;
    time: string;
  };
}

Deno.serve(async (req) => {
  // Check for WebSocket upgrade
  const upgradeHeader = req.headers.get("upgrade") || "";
  
  if (upgradeHeader.toLowerCase() !== "websocket") {
    console.log("[MediaStream] Non-WebSocket request received");
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  // Extract token from URL
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const token = pathParts[pathParts.length - 1];

  console.log("[MediaStream] WebSocket upgrade requested for token:", token?.substring(0, 8) + "...");

  if (!token || token === "twilio-media-stream") {
    return new Response("Missing authentication token", { status: 401 });
  }

  if (!OPENAI_API_KEY) {
    console.error("[MediaStream] OPENAI_API_KEY not configured");
    return new Response("Server configuration error", { status: 500 });
  }

  // Initialize Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Find business by token
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_name, twilio_enabled, aivia_active")
    .eq("twilio_webhook_token", token)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[MediaStream] Business not found for token");
    return new Response("Invalid token", { status: 401 });
  }

  // Get business AI settings
  const { data: settings } = await supabase
    .from("business_settings")
    .select("assistant_name, tone, primary_language, voice_gender, elevenlabs_voice_id")
    .eq("business_id", business.id)
    .maybeSingle();

  const assistantName = settings?.assistant_name || "Aivia";
  const tone = settings?.tone || "neutral";
  const voiceGender = settings?.voice_gender || "female";
  const selectedVoice = settings?.elevenlabs_voice_id;

  // Use selected OpenAI voice, or fallback to gender-based default
  const openAiVoice = selectedVoice && OPENAI_VOICES.includes(selectedVoice) 
    ? selectedVoice 
    : (voiceGender === "male" ? "ash" : "coral");

  // Upgrade to WebSocket
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  const session: StreamSession = {
    businessId: business.id,
    businessName: business.business_name,
    callSid: "",
    callerPhone: "",
    callerName: null,
    systemPrompt: "", // Will be built when we get caller info
    voice: openAiVoice,
    streamSid: null,
    openAiWs: null,
    twilioWs,
    pendingToolCalls: new Map(),
  };

  twilioWs.onopen = () => {
    console.log("[MediaStream] Twilio WebSocket connected");
  };

  twilioWs.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.event) {
        case "connected":
          console.log("[MediaStream] Twilio connected event received");
          break;

        case "start":
          console.log("[MediaStream] Stream started:", data.start);
          session.streamSid = data.start.streamSid;
          session.callSid = data.start.callSid;
          session.callerPhone = data.start.customParameters?.callerPhone || "";
          
          // Build full system prompt with caller context
          session.systemPrompt = await buildFullSystemPrompt(
            supabase, 
            business.id, 
            business.business_name, 
            assistantName, 
            tone,
            session.callerPhone
          );
          
          // Connect to OpenAI Realtime API
          await connectToOpenAI(session, supabase);
          break;

        case "media":
          // Forward audio to OpenAI
          if (session.openAiWs?.readyState === WebSocket.OPEN) {
            const audioMessage = {
              type: "input_audio_buffer.append",
              audio: data.media.payload, // Already base64 encoded mulaw
            };
            session.openAiWs.send(JSON.stringify(audioMessage));
          }
          break;

        case "stop":
          console.log("[MediaStream] Stream stopped");
          if (session.openAiWs) {
            session.openAiWs.close();
          }
          break;

        default:
          console.log("[MediaStream] Unknown Twilio event:", data.event);
      }
    } catch (error) {
      console.error("[MediaStream] Error processing Twilio message:", error);
    }
  };

  twilioWs.onclose = () => {
    console.log("[MediaStream] Twilio WebSocket closed");
    if (session.openAiWs) {
      session.openAiWs.close();
    }
  };

  twilioWs.onerror = (error) => {
    console.error("[MediaStream] Twilio WebSocket error:", error);
  };

  return response;
});

async function connectToOpenAI(session: StreamSession, supabase: any) {
  console.log("[MediaStream] Connecting to OpenAI Realtime API...");

  const openAiWs = new WebSocket(
    "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
    [
      "realtime",
      `openai-insecure-api-key.${OPENAI_API_KEY}`,
      "openai-beta.realtime-v1"
    ]
  );

  session.openAiWs = openAiWs;

  openAiWs.onopen = () => {
    console.log("[MediaStream] OpenAI WebSocket connected");
    // Session config will be sent after receiving session.created
  };

  openAiWs.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case "session.created":
          console.log("[MediaStream] OpenAI session created, sending config...");
          sendSessionConfig(session);
          break;

        case "session.updated":
          console.log("[MediaStream] OpenAI session updated");
          break;

        case "response.audio.delta":
          // Forward audio to Twilio
          if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
            const audioMessage = {
              event: "media",
              streamSid: session.streamSid,
              media: {
                payload: data.delta, // Base64 encoded audio
              },
            };
            session.twilioWs.send(JSON.stringify(audioMessage));
          }
          break;

        case "response.audio.done":
          console.log("[MediaStream] AI response audio complete");
          break;

        case "response.audio_transcript.delta":
          // AI is speaking - log for debugging
          if (data.delta) {
            console.log("[MediaStream] AI speaking:", data.delta.substring(0, 100));
          }
          break;

        case "input_audio_buffer.speech_started":
          console.log("[MediaStream] User started speaking - interrupting AI");
          // Clear any pending AI audio (barge-in)
          if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
            session.twilioWs.send(JSON.stringify({
              event: "clear",
              streamSid: session.streamSid,
            }));
          }
          // Cancel any in-progress response
          if (session.openAiWs?.readyState === WebSocket.OPEN) {
            session.openAiWs.send(JSON.stringify({ type: "response.cancel" }));
          }
          break;

        case "input_audio_buffer.speech_stopped":
          console.log("[MediaStream] User stopped speaking");
          break;

        case "conversation.item.input_audio_transcription.completed":
          console.log("[MediaStream] User said:", data.transcript);
          // Log to conversation
          await logConversation(supabase, session.callSid, "user", data.transcript);
          break;

        case "response.function_call_arguments.done":
          console.log("[MediaStream] Function call complete:", data.name, data.arguments);
          // Handle tool call
          await handleToolCall(session, supabase, data.call_id, data.name, data.arguments);
          break;

        case "response.done":
          console.log("[MediaStream] Response complete");
          if (data.response?.output) {
            for (const output of data.response.output) {
              if (output.content) {
                for (const content of output.content) {
                  if (content.transcript) {
                    await logConversation(supabase, session.callSid, "assistant", content.transcript);
                  }
                }
              }
            }
          }
          break;

        case "error":
          console.error("[MediaStream] OpenAI error:", data.error);
          break;

        default:
          // Log other events for debugging
          if (data.type.startsWith("response.") || data.type.startsWith("conversation.")) {
            console.log("[MediaStream] OpenAI event:", data.type);
          }
      }
    } catch (error) {
      console.error("[MediaStream] Error processing OpenAI message:", error);
    }
  };

  openAiWs.onclose = () => {
    console.log("[MediaStream] OpenAI WebSocket closed");
    session.openAiWs = null;
  };

  openAiWs.onerror = (error) => {
    console.error("[MediaStream] OpenAI WebSocket error:", error);
  };
}

function sendSessionConfig(session: StreamSession) {
  if (!session.openAiWs || session.openAiWs.readyState !== WebSocket.OPEN) {
    console.error("[MediaStream] Cannot send config - WebSocket not open");
    return;
  }

  const tools = [
    {
      type: "function",
      name: "create_booking",
      description: "Create a new booking/appointment. Only call this AFTER confirming all details with the customer. If service name is ambiguous (like 'haircut'), you MUST first ask the customer which type (adult/kids/women) before calling this.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer's name" },
          customer_phone: { type: "string", description: "Customer's phone number" },
          service_name: { type: "string", description: "EXACT name of the service including category (e.g., 'Kids Haircut', 'Women Haircut', 'Adult Haircut')" },
          staff_name: { type: "string", description: "Name of the staff member (without title)" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM format (24-hour)" },
        },
        required: ["customer_name", "customer_phone", "service_name", "staff_name", "date", "time"],
      },
    },
    {
      type: "function",
      name: "cancel_booking",
      description: "Cancel an existing booking. Needs either the booking code or customer name.",
      parameters: {
        type: "object",
        properties: {
          booking_code: { type: "string", description: "The booking reference code" },
          customer_name: { type: "string", description: "Customer's name if booking code not provided" },
        },
      },
    },
    {
      type: "function",
      name: "leave_message",
      description: "Leave a message for the business or a specific staff member.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The message content" },
          recipient_type: { type: "string", enum: ["all", "admin", "staff"], description: "Who should receive the message" },
          recipient_staff_name: { type: "string", description: "Specific staff member name if recipient_type is staff" },
          is_urgent: { type: "boolean", description: "Whether the message is urgent" },
        },
        required: ["message", "recipient_type"],
      },
    },
  ];

  const config = {
    type: "session.update",
    session: {
      modalities: ["text", "audio"],
      instructions: session.systemPrompt,
      voice: session.voice,
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      input_audio_transcription: {
        model: "whisper-1",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.45,           // More sensitive detection
        prefix_padding_ms: 200,    // Less pre-speech buffer
        silence_duration_ms: 400,  // Faster response trigger
      },
      tools,
      tool_choice: "auto",
      temperature: 0.6,            // More focused responses
      max_response_output_tokens: 300, // Shorter, faster responses
    },
  };

  console.log("[MediaStream] Sending session config with voice:", session.voice);
  session.openAiWs.send(JSON.stringify(config));

  // Send initial greeting immediately for faster perceived response
  setTimeout(() => {
    if (session.openAiWs?.readyState === WebSocket.OPEN) {
      session.openAiWs.send(JSON.stringify({ type: "response.create" }));
      console.log("[MediaStream] Triggered initial greeting");
    }
  }, 100);
}

async function handleToolCall(session: StreamSession, supabase: any, callId: string, name: string, argumentsJson: string) {
  console.log("[MediaStream] Handling tool call:", name);
  
  let result: any = { success: false, message: "Unknown tool" };
  
  try {
    const args = JSON.parse(argumentsJson);
    
    switch (name) {
      case "create_booking":
        result = await executeCreateBooking(supabase, session.businessId, args);
        break;
      case "cancel_booking":
        result = await executeCancelBooking(supabase, session.businessId, args);
        break;
      case "leave_message":
        result = await executeLeaveMessage(supabase, session.businessId, session.callerPhone, session.callerName, args);
        break;
    }
  } catch (error) {
    console.error("[MediaStream] Tool execution error:", error);
    result = { success: false, message: "Sorry, there was an error processing that request." };
  }

  // Send tool result back to OpenAI
  if (session.openAiWs?.readyState === WebSocket.OPEN) {
    const toolResponse = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    };
    session.openAiWs.send(JSON.stringify(toolResponse));
    
    // Trigger response generation
    session.openAiWs.send(JSON.stringify({ type: "response.create" }));
  }
}

async function executeCreateBooking(supabase: any, businessId: string, params: any): Promise<any> {
  console.log("[MediaStream] Creating booking:", params);
  
  try {
    // Find staff
    const { data: staff } = await supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", businessId)
      .ilike("name", `%${params.staff_name}%`)
      .limit(1)
      .maybeSingle();

    if (!staff) {
      return { success: false, message: `Could not find staff member ${params.staff_name}` };
    }

    // Find service
    const { data: service } = await supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("business_id", businessId)
      .ilike("name", `%${params.service_name}%`)
      .limit(1)
      .maybeSingle();

    if (!service) {
      return { success: false, message: `Could not find service ${params.service_name}` };
    }

    // Parse date and time
    const startTime = new Date(`${params.date}T${params.time}:00`);
    const endTime = new Date(startTime.getTime() + (service.duration_minutes || 30) * 60000);

    // Check for conflicts
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", businessId)
      .eq("staff_id", staff.id)
      .neq("status", "cancelled")
      .lt("start_time", endTime.toISOString())
      .gt("end_time", startTime.toISOString());

    if (conflicts && conflicts.length > 0) {
      return { success: false, message: `Sorry, ${staff.name} is already booked at that time. Please try a different time.` };
    }

    // Generate booking code
    const { data: codeData } = await supabase.rpc("generate_booking_code", {
      p_business_name: params.service_name
    });

    // Create booking
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        business_id: businessId,
        customer_name: params.customer_name,
        customer_phone: params.customer_phone,
        service_id: service.id,
        staff_id: staff.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "confirmed",
        booking_code: codeData,
        created_by: "ai_phone",
      })
      .select()
      .single();

    if (error) {
      console.error("[MediaStream] Booking creation error:", error);
      return { success: false, message: "Sorry, there was an error creating the booking." };
    }

    console.log("[MediaStream] Booking created:", booking.id);
    return { 
      success: true, 
      message: `Booking confirmed! Reference code is ${codeData}`,
      booking_code: codeData,
    };
  } catch (error) {
    console.error("[MediaStream] Create booking error:", error);
    return { success: false, message: "Sorry, there was an error creating the booking." };
  }
}

async function executeCancelBooking(supabase: any, businessId: string, params: any): Promise<any> {
  console.log("[MediaStream] Cancelling booking:", params);
  
  try {
    let query = supabase
      .from("bookings")
      .select("id, booking_code, customer_name")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString());

    if (params.booking_code) {
      query = query.eq("booking_code", params.booking_code.toUpperCase());
    } else if (params.customer_name) {
      query = query.ilike("customer_name", `%${params.customer_name}%`);
    } else {
      return { success: false, message: "Need either booking code or customer name to cancel." };
    }

    const { data: booking } = await query.limit(1).maybeSingle();

    if (!booking) {
      return { success: false, message: "Could not find that booking." };
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", booking.id);

    if (error) {
      return { success: false, message: "Error cancelling booking." };
    }

    return { success: true, message: `Booking ${booking.booking_code} has been cancelled.` };
  } catch (error) {
    console.error("[MediaStream] Cancel booking error:", error);
    return { success: false, message: "Error cancelling booking." };
  }
}

async function executeLeaveMessage(supabase: any, businessId: string, callerPhone: string, callerName: string | null, params: any): Promise<any> {
  console.log("[MediaStream] Leaving message:", params);
  
  try {
    let recipientStaffId = null;
    
    if (params.recipient_type === "staff" && params.recipient_staff_name) {
      const { data: staff } = await supabase
        .from("staff")
        .select("id")
        .eq("business_id", businessId)
        .ilike("name", `%${params.recipient_staff_name}%`)
        .limit(1)
        .maybeSingle();
      
      recipientStaffId = staff?.id || null;
    }

    const { error } = await supabase
      .from("messages")
      .insert({
        business_id: businessId,
        caller_phone: callerPhone,
        caller_name: callerName,
        content: params.message,
        recipient_type: params.recipient_type,
        recipient_staff_id: recipientStaffId,
        is_urgent: params.is_urgent || false,
      });

    if (error) {
      return { success: false, message: "Error saving message." };
    }

    return { success: true, message: "Message has been saved and will be passed on." };
  } catch (error) {
    console.error("[MediaStream] Leave message error:", error);
    return { success: false, message: "Error saving message." };
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function buildFullSystemPrompt(
  supabase: any,
  businessId: string,
  businessName: string,
  assistantName: string,
  tone: string,
  callerPhone: string
): Promise<string> {
  // Fetch all business data in parallel
  const [staffResult, servicesResult, hoursResult, settingsResult, timeOffResult, bookingsResult] = await Promise.all([
    supabase.from("staff").select("id, name, role, title").eq("business_id", businessId),
    supabase.from("services").select("id, name, duration_minutes, price, category, description").eq("business_id", businessId),
    supabase.from("opening_hours").select("day_of_week, open_time, close_time, is_closed").eq("business_id", businessId),
    supabase.from("business_settings").select("min_booking_notice_hours, max_days_advance, cancellation_policy, currency, min_cancellation_notice_hours").eq("business_id", businessId).maybeSingle(),
    supabase.from("staff_time_off")
      .select("staff_id, start_time, end_time, reason, staff:staff_id(name)")
      .eq("business_id", businessId)
      .eq("status", "approved")
      .gte("end_time", new Date().toISOString())
      .lte("start_time", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from("bookings")
      .select("id, start_time, end_time, customer_name, customer_phone, staff:staff_id(name)")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .lte("start_time", new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString())
      .order("start_time"),
  ]);

  const staff = staffResult.data || [];
  const services = servicesResult.data || [];
  const hours = hoursResult.data || [];
  const businessSettings = settingsResult.data;
  const staffTimeOff = timeOffResult.data || [];
  const upcomingBookings = bookingsResult.data || [];
  const currency = businessSettings?.currency || "£";

  // Get caller info
  const callerInfo = await getCallerInfo(supabase, businessId, callerPhone);

  // Format staff list with title
  const staffList = staff.length > 0
    ? staff.map((s: any) => `- ${s.title ? s.title + " " : ""}${s.name} (${s.role})`).join("\n")
    : "No specific staff members configured";

  // Format services with category for disambiguation
  const servicesByCategory: Record<string, any[]> = {};
  services.forEach((s: any) => {
    const cat = s.category || "General";
    if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
    servicesByCategory[cat].push(s);
  });
  
  const servicesList = services.length > 0
    ? Object.entries(servicesByCategory).map(([cat, svcs]) => 
        `${cat}:\n${(svcs as any[]).map((s: any) => `  - ${s.name}: ${s.duration_minutes}min, ${currency}${s.price}${s.description ? ` (${s.description})` : ""}`).join("\n")}`
      ).join("\n")
    : "Services available upon request";

  // Format hours
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const hoursList = hours.length > 0
    ? hours
        .sort((a: any, b: any) => a.day_of_week - b.day_of_week)
        .map((h: any) => {
          if (h.is_closed) return `${dayNames[h.day_of_week]}: Closed`;
          return `${dayNames[h.day_of_week]}: ${h.open_time?.slice(0, 5)} - ${h.close_time?.slice(0, 5)}`;
        })
        .join("\n")
    : "Opening hours available upon request";

  // Format staff time off
  const timeOffList = staffTimeOff.length > 0
    ? staffTimeOff.map((t: any) => {
        const startDate = new Date(t.start_time);
        const endDate = new Date(t.end_time);
        const staffName = t.staff?.name || "Unknown";
        return `- ${staffName}: OFF from ${startDate.toLocaleDateString("en-GB")} to ${endDate.toLocaleDateString("en-GB")} (${t.reason})`;
      }).join("\n")
    : "None scheduled";

  // Format existing bookings (with privacy protection)
  const normalizedCallerPhone = callerPhone.replace(/\D/g, "").slice(-10);
  const bookingsWithStaff = upcomingBookings.map((b: any) => {
    const startTime = new Date(b.start_time);
    const endTime = new Date(b.end_time);
    const staffName = b.staff?.name || "Any";
    const dateStr = startTime.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = `${formatTime(startTime)}-${formatTime(endTime)}`;
    
    // Check if this booking belongs to the current caller
    const customerPhoneNorm = (b.customer_phone || "").replace(/\D/g, "").slice(-10);
    const isCallerBooking = callerInfo.isReturning && customerPhoneNorm === normalizedCallerPhone;
    
    if (isCallerBooking) {
      return `- ${staffName}: ${dateStr} ${timeStr} (YOUR BOOKING - ${b.customer_name})`;
    } else {
      // Don't reveal other customers' names
      return `- ${staffName}: ${dateStr} ${timeStr} (slot taken)`;
    }
  }).join("\n") || "No upcoming bookings";

  // Get current date/time context
  const now = new Date();
  const currentDay = dayNames[now.getDay()];
  const currentTime = formatTime(now);
  const currentDate = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Build caller context
  let callerContext = "";
  if (callerInfo.isReturning) {
    callerContext = `
═══════════════════════════════════════════════════════════════
CALLER INFO (RETURNING CUSTOMER - GREET BY NAME!)
═══════════════════════════════════════════════════════════════
Name: ${callerInfo.name}
Phone: ${callerPhone}
Total visits: ${callerInfo.totalVisits}
${callerInfo.preferredStaff ? `Preferred staff: ${callerInfo.preferredStaff}` : ""}
${callerInfo.lastBooking ? `Last booking: ${callerInfo.lastBooking.service} with ${callerInfo.lastBooking.staff} on ${callerInfo.lastBooking.date}` : ""}
${callerInfo.upcomingBooking ? `⚠️ HAS UPCOMING BOOKING: ${callerInfo.upcomingBooking.service} on ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} (Code: ${callerInfo.upcomingBooking.code})` : ""}
`;
  } else {
    callerContext = `
═══════════════════════════════════════════════════════════════
CALLER INFO (NEW CUSTOMER)
═══════════════════════════════════════════════════════════════
Phone: ${callerPhone}
Status: First-time caller - collect their name during booking
`;
  }

  // Build tone instructions
  let toneInstructions = "";
  switch (tone) {
    case "formal":
      toneInstructions = "Speak professionally and formally. Use proper greetings.";
      break;
    case "casual":
      toneInstructions = "Be friendly and casual while remaining helpful.";
      break;
    default:
      toneInstructions = "Be warm and friendly but professional.";
  }

  // Build compact greeting instruction
  const greetingInstruction = callerInfo.isReturning 
    ? `START by saying: "Hi ${callerInfo.name}, thanks for calling ${businessName}, how can I help?"`
    : `START by saying: "Hi, thanks for calling ${businessName}, how can I help?"`;

  // Build policy context
  const cancellationPolicy = businessSettings?.cancellation_policy || "";
  const minCancellationNotice = businessSettings?.min_cancellation_notice_hours || 24;
  const minBookingNotice = businessSettings?.min_booking_notice_hours || 2;
  const maxDaysAdvance = businessSettings?.max_days_advance || 30;
  
  const policyContext = cancellationPolicy 
    ? `\nPOLICIES:\n- Cancellation: ${cancellationPolicy}\n- Min cancellation notice: ${minCancellationNotice}hrs\n- Min booking notice: ${minBookingNotice}hrs\n- Max advance booking: ${maxDaysAdvance} days`
    : "";

  return `You are ${assistantName}, phone receptionist for ${businessName}. ${toneInstructions}

CRITICAL RULES:
1. Keep responses to 1-2 sentences max. Sound natural. Never say you're AI.
2. NEVER assume or guess - ALWAYS confirm details before booking.
3. When a service name is ambiguous (e.g., "haircut"), ASK which type: adult, kids, women, etc.
4. Always use staff titles (Mr, Mrs, Miss, etc.) when addressing or referring to them.
5. Check availability BEFORE confirming any booking.

${greetingInstruction}

TODAY: ${currentDay}, ${currentDate}, ${currentTime}
${callerContext}
STAFF: ${staff.map((s: any) => `${s.title ? s.title + " " : ""}${s.name}`).join(", ") || "Ask"}
SERVICES BY CATEGORY:
${servicesList}
HOURS: ${hours.filter((h: any) => !h.is_closed).map((h: any) => `${dayNames[h.day_of_week].slice(0,3)} ${h.open_time?.slice(0,5)}-${h.close_time?.slice(0,5)}`).join(", ") || "Ask"}
TIME OFF: ${timeOffList}
BOOKED SLOTS: ${bookingsWithStaff}
${policyContext}

BOOKING PROCESS:
1. Get service name - if ambiguous (e.g., "haircut"), ask: "Is that for adult, kids, or women?"
2. Get preferred staff - if specific staff requested, use their title
3. Get date/time - check against BOOKED SLOTS and TIME OFF first
4. Confirm all details with customer before creating booking

CRITICAL:
- Check TIME OFF + BOOKED SLOTS before confirming ANY availability
- Never reveal other customers' info
- Use create_booking tool ONLY after confirming all details
- ${callerInfo.isReturning ? `This is ${callerInfo.name}, returning customer` : "New caller - get their name when booking"}`;
}

async function getCallerInfo(supabase: any, businessId: string, callerPhone: string): Promise<CallerInfo> {
  if (!callerPhone) {
    return { isReturning: false };
  }

  const normalizedPhone = callerPhone.replace(/\D/g, "").slice(-10);
  
  // Try to find customer by phone
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, total_visits, preferred_staff_id, preferred_staff:preferred_staff_id(id, name)")
    .eq("business_id", businessId)
    .or(`phone.ilike.%${normalizedPhone}%,phone.eq.${callerPhone}`)
    .limit(1)
    .maybeSingle();

  if (!customer) {
    return { isReturning: false };
  }

  // Get last booking
  const { data: lastBooking } = await supabase
    .from("bookings")
    .select("start_time, service:service_id(id, name), staff:staff_id(id, name)")
    .eq("business_id", businessId)
    .ilike("customer_phone", `%${normalizedPhone}%`)
    .neq("status", "cancelled")
    .order("start_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get upcoming booking
  const { data: upcomingBooking } = await supabase
    .from("bookings")
    .select("booking_code, start_time, service:service_id(name)")
    .eq("business_id", businessId)
    .ilike("customer_phone", `%${normalizedPhone}%`)
    .neq("status", "cancelled")
    .gte("start_time", new Date().toISOString())
    .order("start_time")
    .limit(1)
    .maybeSingle();

  return {
    isReturning: true,
    name: customer.name,
    totalVisits: customer.total_visits,
    preferredStaff: customer.preferred_staff?.name,
    preferredStaffId: customer.preferred_staff?.id,
    lastBooking: lastBooking ? {
      service: lastBooking.service?.name || "appointment",
      serviceId: lastBooking.service?.id,
      date: new Date(lastBooking.start_time).toLocaleDateString("en-GB"),
      staff: lastBooking.staff?.name || "",
      staffId: lastBooking.staff?.id
    } : undefined,
    upcomingBooking: upcomingBooking ? {
      code: upcomingBooking.booking_code,
      service: upcomingBooking.service?.name || "appointment",
      date: new Date(upcomingBooking.start_time).toLocaleDateString("en-GB"),
      time: formatTime(new Date(upcomingBooking.start_time))
    } : undefined
  };
}

async function logConversation(supabase: any, callSid: string, role: string, content: string) {
  if (!callSid || !content) return;
  
  try {
    const { data: conv } = await supabase
      .from("call_conversations")
      .select("messages")
      .eq("call_sid", callSid)
      .maybeSingle();

    if (conv) {
      const messages = conv.messages || [];
      messages.push({ role, content, timestamp: new Date().toISOString() });

      await supabase
        .from("call_conversations")
        .update({ messages, updated_at: new Date().toISOString() })
        .eq("call_sid", callSid);
    }
  } catch (error) {
    console.error("[MediaStream] Error logging conversation:", error);
  }
}
