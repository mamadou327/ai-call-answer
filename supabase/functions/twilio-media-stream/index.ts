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
  systemPrompt: string;
  voice: string;
  streamSid: string | null;
  openAiWs: WebSocket | null;
  twilioWs: WebSocket | null;
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
    .select("assistant_name, tone, primary_language, voice_gender")
    .eq("business_id", business.id)
    .maybeSingle();

  const assistantName = settings?.assistant_name || "Aivia";
  const tone = settings?.tone || "neutral";
  const voiceGender = settings?.voice_gender || "female";

  // Map voice gender to OpenAI voice
  const openAiVoice = voiceGender === "male" ? "ash" : "coral";

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(supabase, business.id, business.business_name, assistantName, tone);

  // Upgrade to WebSocket
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  const session: StreamSession = {
    businessId: business.id,
    businessName: business.business_name,
    callSid: "",
    callerPhone: "",
    systemPrompt,
    voice: openAiVoice,
    streamSid: null,
    openAiWs: null,
    twilioWs,
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

  // Deno WebSocket doesn't support headers option, use protocols for auth
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
          console.log("[MediaStream] AI transcript delta:", data.delta?.substring(0, 50));
          break;

        case "input_audio_buffer.speech_started":
          console.log("[MediaStream] User started speaking");
          // Clear any pending AI audio
          if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
            session.twilioWs.send(JSON.stringify({
              event: "clear",
              streamSid: session.streamSid,
            }));
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
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 700, // Slightly faster response
      },
      temperature: 0.7,
      max_response_output_tokens: 500,
    },
  };

  console.log("[MediaStream] Sending session config with voice:", session.voice);
  session.openAiWs.send(JSON.stringify(config));
}

async function buildSystemPrompt(
  supabase: any,
  businessId: string,
  businessName: string,
  assistantName: string,
  tone: string
): Promise<string> {
  // Fetch business data
  const [staffResult, servicesResult, hoursResult, settingsResult] = await Promise.all([
    supabase.from("staff").select("id, name, role").eq("business_id", businessId),
    supabase.from("services").select("id, name, duration_minutes, price, category").eq("business_id", businessId),
    supabase.from("opening_hours").select("day_of_week, open_time, close_time, is_closed").eq("business_id", businessId),
    supabase.from("business_settings").select("min_booking_notice_hours, max_days_advance, cancellation_policy").eq("business_id", businessId).maybeSingle(),
  ]);

  const staff = staffResult.data || [];
  const services = servicesResult.data || [];
  const hours = hoursResult.data || [];
  const businessSettings = settingsResult.data;

  // Format staff list
  const staffList = staff.length > 0
    ? staff.map((s: any) => `- ${s.name} (${s.role})`).join("\n")
    : "No specific staff members configured";

  // Format services
  const servicesList = services.length > 0
    ? services.map((s: any) => `- ${s.name}: ${s.duration_minutes} mins, £${s.price}`).join("\n")
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

  // Get current date/time context
  const now = new Date();
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const currentDate = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // Build tone instructions
  let toneInstructions = "";
  switch (tone) {
    case "formal":
      toneInstructions = "Speak professionally and formally. Use proper greetings and maintain a courteous demeanor throughout.";
      break;
    case "casual":
      toneInstructions = "Be friendly and casual. Use informal language while remaining helpful and professional.";
      break;
    default:
      toneInstructions = "Be warm and friendly but professional. Balance approachability with efficiency.";
  }

  return `You are ${assistantName}, an AI receptionist for ${businessName}. You handle phone calls to help customers with bookings, inquiries, and general questions.

## Your Personality
${toneInstructions}
- Keep responses concise and natural for phone conversations
- Speak clearly and at a comfortable pace
- Be helpful and accommodating
- If you don't know something, offer to take a message

## Current Context
- Current date and time: ${currentDate}, ${currentTime}
- Today is ${currentDay}

## Business Information
**${businessName}**

### Staff Members
${staffList}

### Services Offered
${servicesList}

### Opening Hours
${hoursList}

### Booking Policies
- Minimum notice required: ${businessSettings?.min_booking_notice_hours || 2} hours
- Maximum advance booking: ${businessSettings?.max_days_advance || 30} days
${businessSettings?.cancellation_policy ? `- Cancellation policy: ${businessSettings.cancellation_policy}` : ""}

## Your Capabilities
1. **Making Bookings**: Help customers book appointments. Collect their name, preferred service, date/time, and optionally staff preference.
2. **Checking Availability**: Inform about opening hours and general availability.
3. **Answering Questions**: Answer questions about services, prices, and the business.
4. **Taking Messages**: If you can't help with something, offer to take a message.

## Important Guidelines
- Always confirm details before finalizing anything
- If asked about real-time availability for specific slots, let them know you'll check and get back to them, or suggest they try booking online
- For complex requests, offer to have someone call them back
- Start with a brief greeting mentioning the business name
- End calls politely

Remember: You're speaking on the phone, so keep responses natural and conversational. Avoid long lists or complex information dumps.`;
}

async function logConversation(supabase: any, callSid: string, role: string, content: string) {
  try {
    // Get existing conversation
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
