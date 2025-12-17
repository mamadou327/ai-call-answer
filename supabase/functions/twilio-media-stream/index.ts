import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

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
  // Cached business data for tool validation
  businessSettings: BusinessSettings | null;
  openingHours: OpeningHour[];
  staffTimeOff: StaffTimeOff[];
  staffServices: StaffService[];
  staff: StaffMember[];
  services: Service[];
}

interface BusinessSettings {
  min_booking_notice_hours: number;
  max_days_advance: number;
  min_cancellation_notice_hours: number;
  cancellation_policy: string | null;
  currency: string;
}

interface OpeningHour {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

interface StaffTimeOff {
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  staff_name?: string;
}

interface StaffService {
  staff_id: string;
  service_id: string;
}

interface StaffMember {
  id: string;
  name: string;
  role: string;
  title: string | null;
  phone: string | null;
  ai_enabled: boolean;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string;
  description: string | null;
}

interface CustomerSettings {
  collect_name: boolean;
  collect_phone: boolean;
  collect_email: boolean;
  ask_marketing_consent: boolean;
  ask_notes_preferences: boolean;
  ask_how_heard: boolean;
  ask_preferred_staff: boolean;
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
    .select("id, business_name, twilio_enabled, aivia_active, twilio_phone_number, website_knowledge")
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
    // Initialize cached data as empty
    businessSettings: null,
    openingHours: [],
    staffTimeOff: [],
    staffServices: [],
    staff: [],
    services: [],
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
          console.log("[MediaStream] Stream started:", JSON.stringify(data.start));
          session.streamSid = data.start.streamSid;
          // Get callSid from customParameters (passed from webhook) or fallback to stream's callSid
          session.callSid = data.start.customParameters?.callSid || data.start.callSid;
          session.callerPhone = data.start.customParameters?.callerPhone || "";
          
          console.log("[MediaStream] Session initialized - callSid:", session.callSid, "callerPhone:", session.callerPhone);
          
          // Build full system prompt with caller context AND cache business data for tool validation
          const promptData = await buildFullSystemPrompt(
            supabase, 
            business.id, 
            business.business_name, 
            assistantName, 
            tone,
            session.callerPhone,
            business.twilio_phone_number,
            business.website_knowledge
          );
          
          session.systemPrompt = promptData.prompt;
          session.businessSettings = promptData.businessSettings;
          session.openingHours = promptData.openingHours;
          session.staffTimeOff = promptData.staffTimeOff;
          session.staffServices = promptData.staffServices;
          session.staff = promptData.staff;
          session.services = promptData.services;
          
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
      description: "Create a new booking/appointment. CRITICAL: Only call this AFTER: 1) Confirming the service type (adult/kids/women), 2) Verifying the staff member is ASSIGNED to this service (check [CAN DO: ...]), 3) Verifying staff has AI booking enabled (NOT transfer-only), 4) Confirming all details with customer.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer's name" },
          customer_phone: { type: "string", description: "Customer's phone number" },
          customer_email: { type: "string", description: "Customer's email address (optional)" },
          service_name: { type: "string", description: "EXACT name of the service including category (e.g., 'Kids Haircut', 'Women Haircut', 'Adult Haircut')" },
          staff_name: { type: "string", description: "Name of the staff member who is ASSIGNED to this service (without title)" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM format (24-hour)" },
        },
        required: ["customer_name", "customer_phone", "service_name", "staff_name", "date", "time"],
      },
    },
    {
      type: "function",
      name: "cancel_booking",
      description: "Cancel an existing booking. Can search by: full booking code (e.g., 'PRM-2647'), last 4 digits (e.g., '2647'), or customer name. Returns multiple matches if found.",
      parameters: {
        type: "object",
        properties: {
          booking_code: { type: "string", description: "Full booking code like 'PRM-2647'" },
          booking_code_suffix: { type: "string", description: "Last 4 digits of booking code if customer only remembers those" },
          customer_name: { type: "string", description: "Customer's name if booking code not known" },
        },
      },
    },
    {
      type: "function",
      name: "reschedule_booking",
      description: "Move an existing booking to a new date/time. Can look up booking by: full code, last 4 digits, or customer name. DOES NOT create a new booking - only moves existing one.",
      parameters: {
        type: "object",
        properties: {
          booking_code: { type: "string", description: "Full booking code like 'PRM-2647'" },
          booking_code_suffix: { type: "string", description: "Last 4 digits of booking code" },
          customer_name: { type: "string", description: "Customer's name if booking code not known" },
          new_date: { type: "string", description: "New date in YYYY-MM-DD format" },
          new_time: { type: "string", description: "New time in HH:MM format (24-hour)" },
        },
        required: ["new_date", "new_time"],
      },
    },
    {
      type: "function",
      name: "check_availability",
      description: "MANDATORY: You MUST call this tool BEFORE suggesting any times or saying a time is available/unavailable. Never guess or assume availability - always check first. Returns the actual free time slots from the booking system.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          staff_name: { type: "string", description: "Specific staff member (optional)" },
          duration_minutes: { type: "number", description: "Service duration in minutes (default 30)" },
        },
        required: ["date"],
      },
    },
    {
      type: "function",
      name: "save_customer_email",
      description: "Save a customer's email address after they spell it out. Use this AFTER successfully creating a booking when the customer provides their email for confirmation.",
      parameters: {
        type: "object",
        properties: {
          customer_phone: { type: "string", description: "Customer's phone number (to identify them)" },
          email: { type: "string", description: "Customer's email address" },
          booking_id: { type: "string", description: "The booking ID if available" },
        },
        required: ["customer_phone", "email"],
      },
    },
    {
      type: "function",
      name: "end_call",
      description: "End the phone call. ONLY use this when the customer EXPLICITLY says goodbye (bye, goodbye, thanks bye, have a nice day, etc.) AND has no more questions. NEVER end the call: 1) Right after confirming a booking - always ask if there's anything else first, 2) During a pause or silence - wait for them to speak, 3) When the customer is still asking questions. Always say a brief goodbye BEFORE calling this.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Reason: 'customer_said_goodbye' only" },
        },
        required: ["reason"],
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
    {
      type: "function",
      name: "transfer_call",
      description: "Transfer the call to a staff member's phone. Use this when: 1) The caller urgently needs to speak to someone directly, 2) You cannot answer their question after trying, 3) The staff member has AI booking disabled (transfer_only=true in staff list).",
      parameters: {
        type: "object",
        properties: {
          staff_name: { type: "string", description: "Name of the staff member to transfer to" },
          reason: { type: "string", description: "Brief reason for the transfer" },
        },
        required: ["staff_name"],
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
        threshold: 0.7,            // Higher threshold = less sensitive to background noise
        prefix_padding_ms: 300,    // Standard pre-speech buffer
        silence_duration_ms: 700,  // Longer silence needed before AI responds (reduces false triggers)
        create_response: true,     // Auto-create response when speech ends
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
          result = await executeCreateBooking(supabase, session, args);
          break;
        case "cancel_booking":
          result = await executeCancelBooking(supabase, session, args);
          break;
        case "reschedule_booking":
          result = await executeRescheduleBooking(supabase, session, args);
          break;
        case "check_availability":
          result = await executeCheckAvailability(supabase, session, args);
          break;
        case "save_customer_email":
          result = await executeSaveCustomerEmail(supabase, session.businessId, args);
          break;
        case "end_call":
          result = await executeEndCall(session, args);
          break;
        case "leave_message":
          result = await executeLeaveMessage(supabase, session.businessId, session.callerPhone, session.callerName, args);
          break;
        case "transfer_call":
          result = await executeTransferCall(supabase, session, args);
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

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function isBusinessOpen(
  openingHours: OpeningHour[],
  date: Date
): { open: boolean; openTime?: string; closeTime?: string; message?: string } {
  // day_of_week is stored using JS Date.getDay convention (Sunday=0...Saturday=6)
  const jsDay = date.getDay();

  const dayHours = openingHours.find((h) => h.day_of_week === jsDay);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[jsDay];

  if (!dayHours || dayHours.is_closed) {
    return { open: false, message: `We're closed on ${dayName}.` };
  }

  return {
    open: true,
    openTime: dayHours.open_time?.slice(0, 5) || "09:00",
    closeTime: dayHours.close_time?.slice(0, 5) || "17:00",
  };
}


function isTimeWithinOpeningHours(openingHours: OpeningHour[], date: Date, time: string): { valid: boolean; message?: string } {
  const businessHours = isBusinessOpen(openingHours, date);
  if (!businessHours.open) {
    return { valid: false, message: businessHours.message };
  }
  
  const requestedTime = time;
  const openTime = businessHours.openTime!;
  const closeTime = businessHours.closeTime!;
  
  if (requestedTime < openTime) {
    return { valid: false, message: `That's before we open. We're open from ${openTime}.` };
  }
  
  if (requestedTime >= closeTime) {
    return { valid: false, message: `That's after we close. We close at ${closeTime}.` };
  }
  
  return { valid: true };
}

function checkMinBookingNotice(settings: BusinessSettings | null, requestedDateTime: Date): { valid: boolean; message?: string; earliestTime?: Date } {
  const minNoticeHours = settings?.min_booking_notice_hours || 2;
  const now = new Date();
  const minAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  
  if (requestedDateTime < minAllowedTime) {
    return { 
      valid: false, 
      message: `We need at least ${minNoticeHours} hours notice. The earliest I can book is ${formatTime(minAllowedTime)}.`,
      earliestTime: minAllowedTime
    };
  }
  
  return { valid: true };
}

function checkMaxAdvanceBooking(settings: BusinessSettings | null, requestedDate: Date): { valid: boolean; message?: string } {
  const maxDays = settings?.max_days_advance || 30;
  const now = new Date();
  const maxDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
  
  if (requestedDate > maxDate) {
    return { 
      valid: false, 
      message: `We can only book up to ${maxDays} days in advance. The furthest I can book is ${maxDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}.`
    };
  }
  
  return { valid: true };
}

function checkMinCancellationNotice(settings: BusinessSettings | null, bookingStartTime: Date): { valid: boolean; message?: string } {
  const minNoticeHours = settings?.min_cancellation_notice_hours || 24;
  const now = new Date();
  const minAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  
  if (bookingStartTime < minAllowedTime) {
    const policy = settings?.cancellation_policy || `We require at least ${minNoticeHours} hours notice for cancellations.`;
    return { 
      valid: false, 
      message: `I'm sorry, this booking is too soon to cancel. ${policy}`
    };
  }
  
  return { valid: true };
}

function isStaffOnTimeOff(staffTimeOff: StaffTimeOff[], staffId: string, startTime: Date, endTime: Date): { onLeave: boolean; message?: string } {
  const timeOff = staffTimeOff.find(t => {
    if (t.staff_id !== staffId) return false;
    const offStart = new Date(t.start_time);
    const offEnd = new Date(t.end_time);
    // Check if booking overlaps with time off
    return startTime < offEnd && endTime > offStart;
  });
  
  if (timeOff) {
    return { 
      onLeave: true, 
      message: `Sorry, that staff member is on leave at that time. Please choose a different time or staff member.`
    };
  }
  
  return { onLeave: false };
}

function isStaffAssignedToService(staffServices: StaffService[], staffId: string, serviceId: string): boolean {
  return staffServices.some(ss => ss.staff_id === staffId && ss.service_id === serviceId);
}

// ============================================================================
// TOOL IMPLEMENTATIONS
// ============================================================================

async function executeCreateBooking(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Creating booking:", params);
  
  try {
    // Find staff
    const staff = session.staff.find(s => s.name.toLowerCase().includes(params.staff_name.toLowerCase()));
    
    if (!staff) {
      return { success: false, message: `Could not find staff member ${params.staff_name}` };
    }

    // Check if staff has AI booking enabled
    if (staff.ai_enabled === false) {
      return { success: false, message: `${staff.name} does not take AI bookings. Would you like me to transfer you to them instead?` };
    }

    // Find service (strict resolution to avoid booking the wrong variant)
    const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const requestedService = (params.service_name || "").toString().trim();

    if (!requestedService) {
      return { success: false, message: "Which service would you like to book?" };
    }

    const requestedNorm = normalize(requestedService);

    // 1) Prefer exact match by normalized name
    let serviceCandidates = session.services.filter(s => normalize(s.name) === requestedNorm);

    // 2) Fallback to fuzzy match, but NEVER auto-pick if ambiguous
    if (serviceCandidates.length === 0) {
      serviceCandidates = session.services.filter(s => {
        const n = normalize(s.name);
        return n.includes(requestedNorm) || requestedNorm.includes(n);
      });
    }

    if (serviceCandidates.length === 0) {
      return { success: false, message: `Could not find service ${requestedService}` };
    }

    if (serviceCandidates.length > 1) {
      const options = serviceCandidates.slice(0, 6).map(s => s.name).join(", ");
      const more = serviceCandidates.length > 6 ? ` (and ${serviceCandidates.length - 6} more)` : "";
      console.log("[MediaStream] Ambiguous service name:", requestedService, "candidates:", serviceCandidates.map(s => s.name));
      return {
        success: false,
        needs_clarification: true,
        message: `Just to confirm, which one do you mean: ${options}${more}?`,
      };
    }

    const service = serviceCandidates[0];

    // Check if staff is assigned to this service
    if (!isStaffAssignedToService(session.staffServices, staff.id, service.id)) {
      // Find who CAN do this service
      const assignedStaff = session.staffServices
        .filter(ss => ss.service_id === service.id)
        .map(ss => session.staff.find(s => s.id === ss.staff_id)?.name)
        .filter(Boolean);
      
      if (assignedStaff.length > 0) {
        return { success: false, message: `${staff.name} doesn't do ${service.name}. That service is available with ${assignedStaff.join(" or ")}.` };
      }
      return { success: false, message: `${staff.name} is not assigned to ${service.name}. Please choose a different service or staff member.` };
    }

    // Parse date and time
    const startTime = new Date(`${params.date}T${params.time}:00`);
    const endTime = new Date(startTime.getTime() + (service.duration_minutes || 30) * 60000);

    // Validate opening hours
    const hoursCheck = isTimeWithinOpeningHours(session.openingHours, startTime, params.time);
    if (!hoursCheck.valid) {
      return { success: false, message: hoursCheck.message };
    }

    // Validate min booking notice
    const noticeCheck = checkMinBookingNotice(session.businessSettings, startTime);
    if (!noticeCheck.valid) {
      return { success: false, message: noticeCheck.message };
    }

    // Validate max advance booking
    const advanceCheck = checkMaxAdvanceBooking(session.businessSettings, startTime);
    if (!advanceCheck.valid) {
      return { success: false, message: advanceCheck.message };
    }

    // Check staff time off
    const timeOffCheck = isStaffOnTimeOff(session.staffTimeOff, staff.id, startTime, endTime);
    if (timeOffCheck.onLeave) {
      return { success: false, message: timeOffCheck.message };
    }

    // Check for conflicts (double booking)
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", session.businessId)
      .eq("staff_id", staff.id)
      .neq("status", "cancelled")
      .lt("start_time", endTime.toISOString())
      .gt("end_time", startTime.toISOString());

    if (conflicts && conflicts.length > 0) {
      return { success: false, message: `Sorry, ${staff.name} is already booked at that time. Would you like a different time?` };
    }

    // Generate booking code using business name
    const { data: codeData } = await supabase.rpc("generate_booking_code", {
      p_business_name: session.businessName
    });

    const normalizePhoneToE164 = (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const trimmed = raw.trim();
      if (!trimmed) return null;

      const lower = trimmed.toLowerCase();
      if (
        trimmed.includes("[") ||
        trimmed.includes("]") ||
        lower.includes("use existing") ||
        lower.includes("existing phone") ||
        lower.includes("phone number") ||
        lower === "unknown"
      ) {
        return null;
      }

      let cleaned = trimmed.replace(/[^\d+]/g, "");
      if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;
      if (!cleaned.startsWith("+") && /^\d{10,15}$/.test(cleaned)) cleaned = `+${cleaned}`;
      if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
      return null;
    };

    const resolvedCustomerPhone =
      normalizePhoneToE164(params.customer_phone) ||
      normalizePhoneToE164(session.callerPhone);

    if (!resolvedCustomerPhone) {
      return {
        success: false,
        message:
          "What's the best mobile number to send your booking confirmation to? Please include the country code (e.g. +44...).",
      };
    }

    // Create booking
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        business_id: session.businessId,
        customer_name: params.customer_name,
        customer_phone: resolvedCustomerPhone,
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

    // Save email if provided
    if (params.customer_email) {
      await executeSaveCustomerEmail(supabase, session.businessId, {
        customer_phone: resolvedCustomerPhone,
        email: params.customer_email,
        booking_id: booking.id
      });
    }
    
    // Check if email notifications are enabled for this business
    const { data: businessData } = await supabase
      .from("businesses")
      .select("email_on_confirmation")
      .eq("id", session.businessId)
      .single();

    const shouldAskForEmail = businessData?.email_on_confirmation === true && !params.customer_email;

    // Format confirmation
    const dateStr = startTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = formatTime(startTime);

    // Send internal booking notification (business notification email + staff email)
    if (businessData?.email_on_confirmation === true) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

          const [{ data: settingsRow }, { data: staffRow }] = await Promise.all([
            supabase
              .from("business_settings")
              .select("notification_email")
              .eq("business_id", session.businessId)
              .maybeSingle(),
            supabase.from("staff").select("email").eq("id", staff.id).maybeSingle(),
          ]);

          const recipients = Array.from(
            new Set(
              [settingsRow?.notification_email, staffRow?.email]
                .map((e) => (e || "").trim())
                .filter(Boolean)
            )
          );

          if (recipients.length > 0) {
            await resend.emails.send({
              from: `${session.businessName} <${fromEmail}>`,
              to: recipients,
              subject: `📅 New booking confirmed - ${session.businessName}`,
              html: `
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; line-height:1.6; color:#111827;">
                  <h2 style="margin:0 0 12px;">New booking confirmed</h2>
                  <p style="margin:0 0 8px;"><strong>Customer:</strong> ${escapeXml(params.customer_name)} (${escapeXml(params.customer_phone)})</p>
                  <p style="margin:0 0 8px;"><strong>Service:</strong> ${escapeXml(service.name)} (${service.duration_minutes} mins)</p>
                  <p style="margin:0 0 8px;"><strong>Staff:</strong> ${escapeXml(staff.name)}</p>
                  <p style="margin:0 0 8px;"><strong>When:</strong> ${escapeXml(dateStr)} at ${escapeXml(timeStr)}</p>
                  <p style="margin:0;"><strong>Booking code:</strong> ${escapeXml(codeData || "")}</p>
                </div>
              `,
            });
            console.log("[MediaStream] Internal booking email sent to:", recipients.join(", "));
          }
        }
      } catch (emailErr) {
        console.warn("[MediaStream] Internal booking email failed:", emailErr);
      }
    }

    // Send SMS confirmation
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      await fetch(`${supabaseUrl}/functions/v1/send-booking-sms`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          businessId: session.businessId,
          bookingId: booking.id,
          type: "confirmation",
        }),
      });
      console.log("[MediaStream] SMS confirmation triggered");
    } catch (smsError) {
      console.warn("[MediaStream] SMS confirmation failed:", smsError);
    }

    return {
      success: true,
      message: `Done! You're booked with ${staff.name} on ${dateStr} at ${timeStr}. Your reference code is ${codeData}. You should receive your booking details by SMS shortly.`,
      booking_code: codeData,
      booking_id: booking.id,
    };
  } catch (error) {
    console.error("[MediaStream] Create booking error:", error);
    return { success: false, message: "Sorry, there was an error creating the booking." };
  }
}

async function executeCancelBooking(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Cancelling booking:", params);
  
  try {
    let query = supabase
      .from("bookings")
      .select("id, booking_code, customer_name, start_time, staff:staff_id(name), service:service_id(name)")
      .eq("business_id", session.businessId)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString());

    // Smart lookup: exact code > suffix > customer name
    if (params.booking_code) {
      // Exact code match
      query = query.eq("booking_code", params.booking_code.toUpperCase());
    } else if (params.booking_code_suffix) {
      // Suffix match (last 4 digits)
      const suffix = params.booking_code_suffix.replace(/\D/g, "");
      query = query.ilike("booking_code", `%-${suffix}`);
    } else if (params.customer_name) {
      // Customer name search
      query = query.ilike("customer_name", `%${params.customer_name}%`);
    } else {
      return { success: false, message: "I need either the booking code, the last 4 digits, or the customer name to find the booking." };
    }

    const { data: bookings } = await query.order("start_time").limit(5);

    if (!bookings || bookings.length === 0) {
      return { success: false, message: "I couldn't find that booking. Could you double-check the details?" };
    }

    // Multiple matches - ask for clarification with CORRECT staff names
    if (bookings.length > 1) {
      const options = bookings.map((b: any) => {
        const date = new Date(b.start_time);
        const staffName = b.staff?.name || "staff";
        return `${b.booking_code} - ${b.customer_name} with ${staffName} on ${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${formatTime(date)}`;
      }).join("; ");
      
      return { 
        success: false, 
        multiple_matches: true,
        message: `I found ${bookings.length} bookings: ${options}. Which one would you like to cancel?`
      };
    }

    const booking = bookings[0];
    const bookingStartTime = new Date(booking.start_time);

    // Check cancellation notice period
    const cancellationCheck = checkMinCancellationNotice(session.businessSettings, bookingStartTime);
    if (!cancellationCheck.valid) {
      return { success: false, message: cancellationCheck.message };
    }

    // Cancel the booking
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", booking.id);

    if (error) {
      return { success: false, message: "Error cancelling booking." };
    }

    // Send cancellation SMS
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      await fetch(`${supabaseUrl}/functions/v1/send-booking-sms`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          businessId: session.businessId,
          bookingId: booking.id,
          type: "cancellation",
        }),
      });
      console.log("[MediaStream] Cancellation SMS triggered");
    } catch (smsError) {
      console.warn("[MediaStream] Cancellation SMS failed:", smsError);
    }

    // Use the ACTUAL staff name from the database query
    const staffName = booking.staff?.name || "your stylist";
    const bookingDate = new Date(booking.start_time);
    const dateStr = bookingDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = formatTime(bookingDate);

    return { success: true, message: `Your booking ${booking.booking_code} with ${staffName} on ${dateStr} at ${timeStr} has been cancelled. You should receive a confirmation SMS shortly.` };
  } catch (error) {
    console.error("[MediaStream] Cancel booking error:", error);
    return { success: false, message: "Error cancelling booking." };
  }
}

async function executeRescheduleBooking(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Rescheduling booking:", params);
  
  try {
    // Find the booking using smart lookup
    let query = supabase
      .from("bookings")
      .select("id, booking_code, customer_name, start_time, end_time, staff_id, service_id, staff:staff_id(name), service:service_id(name, duration_minutes)")
      .eq("business_id", session.businessId)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString());

    if (params.booking_code) {
      query = query.eq("booking_code", params.booking_code.toUpperCase());
    } else if (params.booking_code_suffix) {
      const suffix = params.booking_code_suffix.replace(/\D/g, "");
      query = query.ilike("booking_code", `%-${suffix}`);
    } else if (params.customer_name) {
      query = query.ilike("customer_name", `%${params.customer_name}%`);
    } else {
      return { success: false, message: "I need either the booking code, the last 4 digits, or the customer name to find the booking." };
    }

    const { data: bookings } = await query.order("start_time").limit(5);

    if (!bookings || bookings.length === 0) {
      return { success: false, message: "I couldn't find that booking. Could you double-check the details?" };
    }

    // Multiple matches - include staff names for clarity
    if (bookings.length > 1) {
      const options = bookings.map((b: any) => {
        const date = new Date(b.start_time);
        const staffName = b.staff?.name || "staff";
        return `${b.booking_code} - ${b.customer_name} with ${staffName} on ${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
      }).join("; ");
      
      return { 
        success: false, 
        multiple_matches: true,
        message: `I found ${bookings.length} bookings: ${options}. Which one would you like to reschedule?`
      };
    }

    const booking = bookings[0];
    const duration = booking.service?.duration_minutes || 30;

    // Parse new date and time
    const newStartTime = new Date(`${params.new_date}T${params.new_time}:00`);
    const newEndTime = new Date(newStartTime.getTime() + duration * 60000);

    // Validate opening hours
    const hoursCheck = isTimeWithinOpeningHours(session.openingHours, newStartTime, params.new_time);
    if (!hoursCheck.valid) {
      return { success: false, message: hoursCheck.message };
    }

    // Validate min booking notice for new time
    const noticeCheck = checkMinBookingNotice(session.businessSettings, newStartTime);
    if (!noticeCheck.valid) {
      return { success: false, message: noticeCheck.message };
    }

    // Validate max advance booking
    const advanceCheck = checkMaxAdvanceBooking(session.businessSettings, newStartTime);
    if (!advanceCheck.valid) {
      return { success: false, message: advanceCheck.message };
    }

    // Check staff time off
    const timeOffCheck = isStaffOnTimeOff(session.staffTimeOff, booking.staff_id, newStartTime, newEndTime);
    if (timeOffCheck.onLeave) {
      return { success: false, message: timeOffCheck.message };
    }

    // Check for conflicts at new time (excluding current booking)
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id")
      .eq("business_id", session.businessId)
      .eq("staff_id", booking.staff_id)
      .neq("status", "cancelled")
      .neq("id", booking.id)
      .lt("start_time", newEndTime.toISOString())
      .gt("end_time", newStartTime.toISOString());

    if (conflicts && conflicts.length > 0) {
      return { success: false, message: `Sorry, ${booking.staff?.name || "they"} already has a booking at that time. Would you like a different time?` };
    }

    // Update the booking
    const { error } = await supabase
      .from("bookings")
      .update({ 
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", booking.id);

    if (error) {
      console.error("[MediaStream] Reschedule error:", error);
      return { success: false, message: "Sorry, there was an error updating the booking." };
    }

    // Send reschedule SMS
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      await fetch(`${supabaseUrl}/functions/v1/send-booking-sms`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          businessId: session.businessId,
          bookingId: booking.id,
          type: "reschedule",
        }),
      });
      console.log("[MediaStream] Reschedule SMS triggered");
    } catch (smsError) {
      console.warn("[MediaStream] Reschedule SMS failed:", smsError);
    }

    const dateStr = newStartTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    const timeStr = formatTime(newStartTime);
    // Use the ACTUAL staff name from the database query
    const staffName = booking.staff?.name || "your stylist";

    return { 
      success: true, 
      message: `Done! Booking ${booking.booking_code} with ${staffName} has been moved to ${dateStr} at ${timeStr}. You should receive a confirmation SMS shortly.`
    };
  } catch (error) {
    console.error("[MediaStream] Reschedule booking error:", error);
    return { success: false, message: "Sorry, there was an error rescheduling the booking." };
  }
}

async function executeCheckAvailability(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Checking availability:", params);
  
  try {
    const requestedDate = new Date(params.date);
    const duration = params.duration_minutes || 30;

    // Check if business is open that day
    const businessHours = isBusinessOpen(session.openingHours, requestedDate);
    if (!businessHours.open) {
      return { success: false, message: businessHours.message };
    }

    // Validate max advance booking
    const advanceCheck = checkMaxAdvanceBooking(session.businessSettings, requestedDate);
    if (!advanceCheck.valid) {
      return { success: false, message: advanceCheck.message };
    }

    // Get all bookings for that day (we need all to check across staff)
    const dayStart = `${params.date}T00:00:00`;
    const dayEnd = `${params.date}T23:59:59`;

    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("staff_id, start_time, end_time")
      .eq("business_id", session.businessId)
      .neq("status", "cancelled")
      .gte("start_time", dayStart)
      .lte("start_time", dayEnd);

    const allBookings = existingBookings || [];

    // Filter by staff if specified
    let targetStaffId: string | null = null;
    let targetStaffName: string | null = null;
    if (params.staff_name) {
      const staff = session.staff.find(s => s.name.toLowerCase().includes(params.staff_name.toLowerCase()));
      if (staff) {
        targetStaffId = staff.id;
        targetStaffName = staff.name;
      }
    }

    // Get AI-enabled staff for availability checking
    const aiEnabledStaff = session.staff.filter(s => s.ai_enabled);
    
    if (aiEnabledStaff.length === 0) {
      return { success: false, message: "Sorry, there are no staff members available for booking at the moment." };
    }

    // Generate available slots
    const openTime = businessHours.openTime!;
    const closeTime = businessHours.closeTime!;
    const [openHour, openMin] = openTime.split(":").map(Number);
    const [closeHour, closeMin] = closeTime.split(":").map(Number);

    const availableSlots: string[] = [];
    const now = new Date();
    const minNoticeHours = session.businessSettings?.min_booking_notice_hours || 2;
    const minAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);

    // Generate 30-minute slots
    for (let h = openHour; h < closeHour || (h === closeHour && 0 < closeMin); h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === openHour && m < openMin) continue;
        if (h === closeHour && m >= closeMin) continue;
        if (h * 60 + m + duration > closeHour * 60 + closeMin) continue; // Slot would end after close

        const slotTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
        const slotStart = new Date(`${params.date}T${slotTime}:00`);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        // Skip if slot is in the past or within min notice period
        if (slotStart < minAllowedTime) continue;

        let slotIsAvailable = false;

        if (targetStaffId) {
          // Check specific staff availability
          const staffBookings = allBookings.filter((b: any) => b.staff_id === targetStaffId);
          const hasConflict = staffBookings.some((b: any) => {
            const bStart = new Date(b.start_time);
            const bEnd = new Date(b.end_time);
            return slotStart < bEnd && slotEnd > bStart;
          });
          
          const timeOffCheck = isStaffOnTimeOff(session.staffTimeOff, targetStaffId, slotStart, slotEnd);
          slotIsAvailable = !hasConflict && !timeOffCheck.onLeave;
        } else {
          // Check if ANY AI-enabled staff is available at this slot
          for (const staff of aiEnabledStaff) {
            const staffBookings = allBookings.filter((b: any) => b.staff_id === staff.id);
            const hasConflict = staffBookings.some((b: any) => {
              const bStart = new Date(b.start_time);
              const bEnd = new Date(b.end_time);
              return slotStart < bEnd && slotEnd > bStart;
            });
            
            const timeOffCheck = isStaffOnTimeOff(session.staffTimeOff, staff.id, slotStart, slotEnd);
            
            if (!hasConflict && !timeOffCheck.onLeave) {
              slotIsAvailable = true;
              break; // At least one staff is available, slot is open
            }
          }
        }

        if (slotIsAvailable) {
          availableSlots.push(slotTime);
        }
      }
    }

    if (availableSlots.length === 0) {
      console.log("[MediaStream] No available slots found for", params.date, "with staff:", params.staff_name || "any");
      return { 
        success: false, 
        message: `There are no available slots on ${requestedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}. Would you like to try a different date?`,
        no_slots: true
      };
    }

    // Sort slots to prioritize those adjacent to existing bookings (minimize gaps)
    const sortedSlots = [...availableSlots].sort((a, b) => {
      const aTime = new Date(`${params.date}T${a}:00`).getTime();
      const bTime = new Date(`${params.date}T${b}:00`).getTime();
      
      // Calculate minimum distance to any existing booking for each slot
      let aMinDistance = Infinity;
      let bMinDistance = Infinity;
      
      for (const booking of allBookings) {
        const bookingStart = new Date(booking.start_time).getTime();
        const bookingEnd = new Date(booking.end_time).getTime();
        
        // Distance to start or end of booking
        const aDistToStart = Math.abs(aTime - bookingStart);
        const aDistToEnd = Math.abs(aTime + duration * 60000 - bookingEnd);
        const bDistToStart = Math.abs(bTime - bookingStart);
        const bDistToEnd = Math.abs(bTime + duration * 60000 - bookingEnd);
        
        aMinDistance = Math.min(aMinDistance, aDistToStart, aDistToEnd);
        bMinDistance = Math.min(bMinDistance, bDistToStart, bDistToEnd);
      }
      
      // If both have equal proximity to bookings, sort by time
      if (aMinDistance === bMinDistance) {
        return aTime - bTime;
      }
      
      // Prefer slots closer to existing bookings
      return aMinDistance - bMinDistance;
    });

    // Format nicely - show up to 8 slots, prioritizing gap-filling slots
    const displaySlots = sortedSlots.slice(0, 8).map(t => {
      const [h, m] = t.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      const hour12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
    });
    const moreSlots = sortedSlots.length > 8 ? ` (plus ${sortedSlots.length - 8} more)` : "";
    const staffNote = targetStaffName ? ` with ${targetStaffName}` : "";
    const dateStr = requestedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    
    console.log("[MediaStream] Found", sortedSlots.length, "available slots for", params.date, "(sorted to minimize gaps)");
    
    return { 
      success: true, 
      message: `On ${dateStr}${staffNote}, I have: ${displaySlots.join(", ")}${moreSlots}. Which time works for you?`,
      available_slots: sortedSlots,
      date: params.date,
      staff: targetStaffName || null
    };
  } catch (error) {
    console.error("[MediaStream] Check availability error:", error);
    return { success: false, message: "Sorry, I couldn't check availability right now." };
  }
}

async function executeSaveCustomerEmail(supabase: any, businessId: string, params: any): Promise<any> {
  console.log("[MediaStream] Saving customer email:", params);
  
  try {
    const { customer_phone, email, booking_id } = params;
    
    if (!email || !email.includes("@")) {
      return { success: false, message: "That doesn't seem like a valid email address. Could you spell it out again?" };
    }
    
    // Find or update customer by phone
    const normalizedPhone = customer_phone.replace(/\D/g, "").slice(-10);
    
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("business_id", businessId)
      .or(`phone.ilike.%${normalizedPhone}%,phone.eq.${customer_phone}`)
      .limit(1)
      .maybeSingle();
    
    if (customer) {
      // Update existing customer
      await supabase
        .from("customers")
        .update({ email: email.toLowerCase().trim() })
        .eq("id", customer.id);
    }
    
    // If we have a booking ID, trigger the email confirmation
    if (booking_id) {
      // Get booking details to find business
      const { data: booking } = await supabase
        .from("bookings")
        .select("business_id")
        .eq("id", booking_id)
        .single();
      
      if (booking) {
        // Invoke the send-booking-email function
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-booking-email`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              businessId: booking.business_id,
              bookingId: booking_id,
              type: "confirmation",
            }),
          });
          console.log("[MediaStream] Email confirmation triggered");
        } catch (emailError) {
          console.error("[MediaStream] Error sending email:", emailError);
        }
      }
    }
    
    return { 
      success: true, 
      message: "Got it! I'll send the confirmation to that email address."
    };
  } catch (error) {
    console.error("[MediaStream] Save email error:", error);
    return { success: false, message: "Sorry, I couldn't save that email. No worries though, your booking is still confirmed." };
  }
}

async function executeEndCall(session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Ending call:", params.reason);
  
  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !session.callSid) {
      // Just close the WebSocket connections
      if (session.openAiWs?.readyState === WebSocket.OPEN) {
        session.openAiWs.close();
      }
      return { success: true, message: "Call ended." };
    }
    
    // Build TwiML to hang up gracefully
    const hangupTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
    
    // Update the call to hang up
    const updateUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${session.callSid}.json`;
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Twiml: hangupTwiml,
      }),
    });
    
    // Close OpenAI connection
    if (session.openAiWs?.readyState === WebSocket.OPEN) {
      session.openAiWs.close();
    }
    
    return { success: true, message: "Call ended." };
  } catch (error) {
    console.error("[MediaStream] End call error:", error);
    return { success: true, message: "Call ended." };
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

    return { success: true, message: "Message saved. They'll get back to you." };
  } catch (error) {
    console.error("[MediaStream] Leave message error:", error);
    return { success: false, message: "Error saving message." };
  }
}

async function executeTransferCall(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Transferring call to:", params.staff_name);
  
  try {
    // Find staff member with phone
    const staffMember = session.staff.find(s => s.name.toLowerCase().includes(params.staff_name.toLowerCase()));

    if (!staffMember) {
      return { success: false, message: `Could not find staff member ${params.staff_name}` };
    }

    if (!staffMember.phone) {
      return { 
        success: false, 
        message: `${staffMember.title ? staffMember.title + " " : ""}${staffMember.name} doesn't have a phone number on file. Would you like to leave them a message instead?` 
      };
    }

    const staffDisplayName = `${staffMember.title ? staffMember.title + " " : ""}${staffMember.name}`;
    console.log("[MediaStream] Transfer requested to:", staffMember.phone);

    // Update conversation status
    const { data: conversation } = await supabase
      .from("call_conversations")
      .select("id, messages")
      .eq("call_sid", session.callSid)
      .maybeSingle();

    if (conversation) {
      const messages = (conversation.messages as any[]) || [];
      messages.push({
        type: "transfer_request",
        transfer_to: staffMember.phone,
        staff_name: staffDisplayName,
        staff_id: staffMember.id,
        reason: params.reason || "Customer requested transfer",
        timestamp: new Date().toISOString(),
      });

      await supabase
        .from("call_conversations")
        .update({ 
          status: "transferred",
          messages: messages,
        })
        .eq("id", conversation.id);
      
      console.log("[MediaStream] Transfer saved to conversation");
    }

    // Use Twilio REST API to update the call with new TwiML
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error("[MediaStream] Twilio credentials not configured");
      return { success: false, message: "Transfer service is not configured. Would you like to leave a message instead?" };
    }

    // Build TwiML for the transfer
    const transferTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">Please hold while I transfer you.</Say>
  <Dial callerId="${escapeXml(session.callerPhone)}" timeout="30">
    <Number>${escapeXml(staffMember.phone)}</Number>
  </Dial>
  <Say voice="Polly.Amy-Neural" language="en-GB">I'm sorry, they are not available right now. Goodbye.</Say>
  <Hangup/>
</Response>`;

    console.log("[MediaStream] Updating call with transfer TwiML for callSid:", session.callSid);

    // Update the call to use new TwiML (this interrupts the stream and processes new TwiML)
    const updateUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${session.callSid}.json`;
    const authHeader = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const updateResponse = await fetch(updateUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        Twiml: transferTwiml,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("[MediaStream] Twilio update call error:", updateResponse.status, errorText);
      
      // If call update fails, try closing the stream anyway
      if (session.openAiWs?.readyState === WebSocket.OPEN) {
        session.openAiWs.close();
      }
      
      return { success: false, message: "I couldn't complete the transfer right now. Would you like to leave a message instead?" };
    }

    console.log("[MediaStream] Call update successful - transfer initiated");

    // Close OpenAI connection since we're transferring
    if (session.openAiWs?.readyState === WebSocket.OPEN) {
      session.openAiWs.close();
    }

    return { 
      success: true, 
      message: `Transferring you now.`,
      transfer_to: staffMember.phone,
      staff_name: staffDisplayName
    };
  } catch (error) {
    console.error("[MediaStream] Transfer call error:", error);
    return { success: false, message: "Sorry, I couldn't complete the transfer. Would you like to leave a message instead?" };
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ============================================================================
// SYSTEM PROMPT BUILDER
// ============================================================================

interface PromptData {
  prompt: string;
  businessSettings: BusinessSettings | null;
  openingHours: OpeningHour[];
  staffTimeOff: StaffTimeOff[];
  staffServices: StaffService[];
  staff: StaffMember[];
  services: Service[];
}

async function buildFullSystemPrompt(
  supabase: any,
  businessId: string,
  businessName: string,
  assistantName: string,
  tone: string,
  callerPhone: string,
  twilioPhoneNumber: string | null,
  websiteKnowledge: string | null
): Promise<PromptData> {
  // Fetch all business data in parallel
  const [staffResult, servicesResult, hoursResult, settingsResult, timeOffResult, bookingsResult, customerSettingsResult] = await Promise.all([
    supabase.from("staff").select("id, name, role, title, phone, ai_enabled").eq("business_id", businessId),
    supabase.from("services").select("id, name, duration_minutes, price, category, description").eq("business_id", businessId),
    supabase.from("opening_hours").select("day_of_week, open_time, close_time, is_closed").eq("business_id", businessId),
    supabase.from("business_settings").select("min_booking_notice_hours, max_days_advance, cancellation_policy, currency, min_cancellation_notice_hours").eq("business_id", businessId).maybeSingle(),
    supabase.from("staff_time_off")
      .select("staff_id, start_time, end_time, reason, staff:staff_id(name)")
      .eq("business_id", businessId)
      .eq("status", "approved")
      .gte("end_time", new Date().toISOString())
      .order("start_time"),
    supabase.from("bookings")
      .select("id, start_time, end_time, customer_name, customer_phone, staff:staff_id(name), service:service_id(name), booking_code")
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("start_time", new Date().toISOString())
      .order("start_time")
      .limit(30),
    supabase.from("customer_settings").select("*").eq("business_id", businessId).maybeSingle(),
  ]);

  const staff: StaffMember[] = (staffResult.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    title: s.title,
    phone: s.phone,
    ai_enabled: s.ai_enabled !== false,
  }));
  
  const services: Service[] = (servicesResult.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    duration_minutes: s.duration_minutes,
    price: s.price,
    category: s.category,
    description: s.description,
  }));
  
  const hours: OpeningHour[] = (hoursResult.data || []).map((h: any) => ({
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed,
  }));
  
  const businessSettings: BusinessSettings | null = settingsResult.data ? {
    min_booking_notice_hours: settingsResult.data.min_booking_notice_hours || 2,
    max_days_advance: settingsResult.data.max_days_advance || 30,
    min_cancellation_notice_hours: settingsResult.data.min_cancellation_notice_hours || 24,
    cancellation_policy: settingsResult.data.cancellation_policy,
    currency: settingsResult.data.currency || "GBP",
  } : null;
  
  const staffTimeOff: StaffTimeOff[] = (timeOffResult.data || []).map((t: any) => ({
    staff_id: t.staff_id,
    start_time: t.start_time,
    end_time: t.end_time,
    reason: t.reason,
    staff_name: t.staff?.name,
  }));
  
  const upcomingBookings = bookingsResult.data || [];
  const currency = businessSettings?.currency || "GBP";
  
  const customerSettings: CustomerSettings | null = customerSettingsResult.data ? {
    collect_name: customerSettingsResult.data.collect_name !== false,
    collect_phone: customerSettingsResult.data.collect_phone !== false,
    collect_email: customerSettingsResult.data.collect_email === true,
    ask_marketing_consent: customerSettingsResult.data.ask_marketing_consent === true,
    ask_notes_preferences: customerSettingsResult.data.ask_notes_preferences === true,
    ask_how_heard: customerSettingsResult.data.ask_how_heard === true,
    ask_preferred_staff: customerSettingsResult.data.ask_preferred_staff === true,
  } : null;

  // Get staff services mapping
  const staffIds = staff.map(s => s.id);
  const { data: staffServicesData } = staffIds.length > 0 
    ? await supabase.from("staff_services").select("staff_id, service_id").in("staff_id", staffIds)
    : { data: [] };
  const staffServices: StaffService[] = (staffServicesData || []).map((ss: any) => ({
    staff_id: ss.staff_id,
    service_id: ss.service_id,
  }));

  // Build staff-to-services mapping
  const staffServiceMap: Record<string, string[]> = {};
  staffServices.forEach(ss => {
    if (!staffServiceMap[ss.staff_id]) {
      staffServiceMap[ss.staff_id] = [];
    }
    staffServiceMap[ss.staff_id].push(ss.service_id);
  });

  // Build service-to-staff mapping (who can do what)
  const serviceToStaffMap: Record<string, { name: string; aiEnabled: boolean; hasPhone: boolean }[]> = {};
  services.forEach(svc => {
    serviceToStaffMap[svc.id] = [];
    staff.forEach(s => {
      const canDoService = staffServiceMap[s.id]?.includes(svc.id);
      if (canDoService) {
        serviceToStaffMap[svc.id].push({ 
          name: s.name, 
          aiEnabled: s.ai_enabled,
          hasPhone: !!s.phone
        });
      }
    });
  });

  // Get caller info
  const callerInfo = await getCallerInfo(supabase, businessId, callerPhone);

  // Create a map of service ID to name for display
  const serviceNameMap: Record<string, string> = {};
  services.forEach(s => {
    serviceNameMap[s.id] = s.name;
  });

  // Format staff list with title, AI status, and services they can perform
  const staffList = staff.length > 0
    ? staff.map(s => {
        const aiStatus = !s.ai_enabled ? " [TRANSFER ONLY]" : "";
        const staffServiceIds = staffServiceMap[s.id] || [];
        const canDoServices = staffServiceIds.map(sid => serviceNameMap[sid]).filter(Boolean);
        const servicesNote = canDoServices.length > 0 
          ? ` [CAN DO: ${canDoServices.join(", ")}]` 
          : " [NO SERVICES]";
        return `- ${s.title ? s.title + " " : ""}${s.name}${aiStatus}${servicesNote}`;
      }).join("\n")
    : "No staff configured";

  // Format services with who can perform each
  const servicesByCategory: Record<string, Service[]> = {};
  services.forEach(s => {
    const cat = s.category || "General";
    if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
    servicesByCategory[cat].push(s);
  });
  
  const servicesList = services.length > 0
    ? Object.entries(servicesByCategory).map(([cat, svcs]) => 
        `${cat}:\n${svcs.map(s => {
          const staffWhoCanDo = serviceToStaffMap[s.id] || [];
          const aiEnabledStaff = staffWhoCanDo.filter(st => st.aiEnabled).map(st => st.name);
          
          let availabilityNote = "";
          if (aiEnabledStaff.length > 0) {
            availabilityNote = ` [With: ${aiEnabledStaff.join(", ")}]`;
          } else {
            availabilityNote = " [TRANSFER ONLY]";
          }
          
          return `  - ${s.name}: ${s.duration_minutes}min, ${currency}${s.price}${availabilityNote}`;
        }).join("\n")}`
      ).join("\n")
    : "Services available upon request";

  // Format hours compactly
  const dayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hoursList = hours.length > 0
    ? hours
        .slice()
        .sort((a, b) => (a.day_of_week === 0 ? 7 : a.day_of_week) - (b.day_of_week === 0 ? 7 : b.day_of_week))
        .map(h => {
          const dayName = dayAbbr[h.day_of_week] || `Day ${h.day_of_week}`;
          if (h.is_closed) return `${dayName}: CLOSED`;
          return `${dayName}: ${h.open_time?.slice(0, 5)}-${h.close_time?.slice(0, 5)}`;
        })
        .join(" | ")
    : "Opening hours available upon request";

  // Format staff time off compactly
  const timeOffList = staffTimeOff.length > 0
    ? staffTimeOff.slice(0, 3).map(t => {
        const startDate = new Date(t.start_time);
        const endDate = new Date(t.end_time);
        return `${t.staff_name}: ${startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}-${endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      }).join(", ")
    : "None";

  // Format existing bookings (with privacy protection) - keep compact
  const normalizedCallerPhone = callerPhone.replace(/\D/g, "").slice(-10);
  const bookingsWithStaff = upcomingBookings.slice(0, 10).map((b: any) => {
    const startTime = new Date(b.start_time);
    const staffName = b.staff?.name || "Any";
    const dateStr = startTime.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
    const timeStr = formatTime(startTime);
    
    const customerPhoneNorm = (b.customer_phone || "").replace(/\D/g, "").slice(-10);
    const isCallerBooking = callerInfo.isReturning && customerPhoneNorm === normalizedCallerPhone;
    
    if (isCallerBooking) {
      return `${staffName}: ${dateStr} ${timeStr} (YOURS - ${b.booking_code})`;
    } else {
      return `${staffName}: ${dateStr} ${timeStr} (booked)`;
    }
  }).join(" | ") || "None";

  // Get current date/time context
  const now = new Date();
  const jsDay = now.getDay();
  const jsDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDay = jsDayNames[jsDay];
  const currentTime = formatTime(now);

  // Determine if business is open TODAY
  const todayHours = hours.find(h => h.day_of_week === jsDay);
  const isOpenToday = todayHours && !todayHours.is_closed;

  const todayStatus = isOpenToday 
    ? `OPEN (${todayHours.open_time?.slice(0, 5)}-${todayHours.close_time?.slice(0, 5)})`
    : "CLOSED";

  // Build caller context
  let callerContext = "";
  if (callerInfo.isReturning) {
    callerContext = `CALLER: ${callerInfo.name} (returning, ${callerInfo.totalVisits} visits)`;
    if (callerInfo.upcomingBooking) {
      callerContext += ` - HAS BOOKING: ${callerInfo.upcomingBooking.service} on ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} (${callerInfo.upcomingBooking.code})`;
    }
  } else {
    callerContext = `CALLER: New customer`;
  }

  // Build tone instructions compactly
  const toneInstruction = tone === "formal" ? "Be professional." : (tone === "casual" ? "Be friendly and casual." : "Be warm and professional.");

  // Greeting
  const greetingInstruction = callerInfo.isReturning 
    ? `Greet: "Hi ${callerInfo.name}, thanks for calling ${businessName}, how can I help?"`
    : `Greet: "Hi, thanks for calling ${businessName}, how can I help?"`;

  // Build customer data collection rules
  let dataCollectionRules = "BOOKING DATA: Collect name and phone.";
  if (customerSettings) {
    const fields: string[] = [];
    if (customerSettings.collect_name) fields.push("name");
    if (customerSettings.collect_phone) fields.push("phone");
    if (customerSettings.collect_email) fields.push("email (if enabled)");
    if (customerSettings.ask_preferred_staff) fields.push("preferred staff");
    if (customerSettings.ask_notes_preferences) fields.push("any special notes");
    if (customerSettings.ask_how_heard) fields.push("how they heard about us");
    if (fields.length > 0) {
      dataCollectionRules = `BOOKING DATA: Collect ${fields.join(", ")}.`;
    }
  }

  // Website knowledge for FAQs
  const faqContext = websiteKnowledge 
    ? `\nFAQ INFO: ${websiteKnowledge.slice(0, 500)}`
    : "";

  // Policy info
  const minNotice = businessSettings?.min_booking_notice_hours || 2;
  const maxAdvance = businessSettings?.max_days_advance || 30;
  const minCancelNotice = businessSettings?.min_cancellation_notice_hours || 24;
  const cancellationPolicyText = businessSettings?.cancellation_policy || "";

  const prompt = `You are ${assistantName}, phone receptionist for ${businessName}. ${toneInstruction}

## CRITICAL TOOL USAGE RULES (MUST FOLLOW):
1. **AVAILABILITY**: NEVER say a time is available or unavailable without calling check_availability first. NEVER guess.
2. **BOOKING**: Only call create_booking AFTER check_availability confirms the slot is free AND customer confirmed all details.
3. **STAFF SERVICES**: ONLY book a staff member for services listed in their [CAN DO:] section. If a customer asks for a service with a staff who can't do it, tell them which staff CAN do it.
4. **TRANSFER ONLY**: Staff marked [TRANSFER ONLY] cannot be booked - offer to transfer instead.

## SERVICE CLARIFICATION (CRITICAL):
- NEVER assume which service type the customer wants (e.g., Kids Haircut vs Adult Haircut vs Women Haircut).
- ALWAYS ask "Is that for an adult, a child, or a woman?" BEFORE booking if there are multiple similar services.
- Use the EXACT service name when booking (e.g., "Kids Haircut" not just "haircut").

## PHONE NUMBER HANDLING:
- Use the caller's phone number (the number they're calling from) by default for the booking.
- Only ask for a different phone number if the customer specifically says they want to use a different number.
- When confirming the booking, mention they will receive booking details by SMS.

## POLICY ACCURACY (MUST FOLLOW):
- NEVER guess policy numbers.
- These are the ONLY correct numeric values:
  - Booking notice: ${minNotice} hours
  - Cancellation notice: ${minCancelNotice} hours (DO NOT CONFUSE WITH BOOKING NOTICE)
- If asked about cancellations, ALWAYS say: "Minimum cancellation notice is ${minCancelNotice} hours."

## CONVERSATION RULES:
- Keep responses SHORT: 1-2 sentences max. Sound human, not robotic.
- NEVER end the call unless customer explicitly says goodbye (bye, thanks bye, etc.)
- After booking is confirmed, ask "Is there anything else?" and WAIT for response.
- Silence/pauses are NOT a reason to end - wait patiently.
- If unsure about availability, ALWAYS use check_availability tool - don't make assumptions.
- Do NOT ask for email - we send confirmations by SMS only.

## WHEN CUSTOMER ASKS FOR A TIME:
1. First, call check_availability for that date (and staff if specified)
2. Look at the returned available_slots list
3. Only confirm times that appear in that list
4. If their requested time is NOT in the list, suggest alternatives from the list
5. PREFER times that minimize gaps - suggest times right before or after existing bookings when possible.

${greetingInstruction}

## CURRENT CONTEXT:
- Today: ${currentDay}, ${currentTime}
- Business Status: ${todayStatus}
- ${callerContext}
- Caller Phone: ${callerPhone} (use this for booking unless they request otherwise)

## STAFF (check [CAN DO:] before booking):
${staffList}

## SERVICES:
${servicesList}

## HOURS: ${hoursList}
## TIME OFF: ${timeOffList}

## POLICIES:
- Minimum booking notice: ${minNotice} hours
- Maximum advance booking: ${maxAdvance} days
- Minimum cancellation notice: ${minCancelNotice} hours
${cancellationPolicyText ? `- Cancellation/refund policy text: ${cancellationPolicyText}` : "- Cancellation/refund policy text: Not provided"}

BOOKING DATA: Collect name only. Use caller's phone number by default.${faqContext}`;

  return {
    prompt,
    businessSettings,
    openingHours: hours,
    staffTimeOff,
    staffServices,
    staff,
    services,
  };
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
