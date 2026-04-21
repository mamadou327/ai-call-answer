import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { buildSystemPromptForBusinessType, getToolsForBusinessType, type BusinessType } from "./prompts/index.ts";
import { ElevenLabsTTS } from "./elevenlabs-tts.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ElevenLabs Flash v2.5 — used only when business has use_elevenlabs_voice=true.
// We read it once at module load alongside other API keys.
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
if (!ELEVENLABS_API_KEY) {
  console.error(
    "[FATAL] ELEVENLABS_API_KEY is not set. The premium voice path " +
    "(use_elevenlabs_voice=true) will automatically fall back to OpenAI voice."
  );
}

// Supported OpenAI Realtime voices
const OPENAI_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];

// Default ElevenLabs voice when a business hasn't picked one yet (Sarah — warm female).
const DEFAULT_ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

// ============================================================================
// CALL STABILITY CONSTANTS
// ============================================================================
const KEEPALIVE_INTERVAL_MS = 25000; // Send keepalive every 25 seconds
const SILENCE_CHECK_INTERVAL_MS = 5000; // Check for stale connections every 5 seconds
const SILENCE_THRESHOLD_MS = 15000; // If no audio for 15 seconds, check connection health
const MAX_OPENAI_RECONNECT_ATTEMPTS = 5; // Increased from 3 for better resilience
const BASE_RECONNECT_DELAY_MS = 1500; // Increased from 700ms for more stable reconnects

// ============================================================================
// PROACTIVE STREAM ROTATION (prevents platform-induced WebSocket drops)
// ============================================================================
// The Twilio Media Stream WebSocket appears to drop around 2-3 minutes
// To support 30+ minute calls, we proactively rotate the stream before it drops
const STREAM_ROTATION_ENABLED = true; // Toggle for testing
const STREAM_ROTATION_INTERVAL_MS = 110_000; // Rotate every 110 seconds (before ~2-3 min drop)
const STREAM_ROTATION_CHECK_INTERVAL_MS = 10_000; // Check every 10 seconds

// =========================================================================
// ORDER CONFIRMATION GUARDRAILS
// =========================================================================
// If the AI starts verbally confirming an order without having successfully
// called create_pickup_order recently, we cancel the response and force a
// tool call first. This prevents “verbal confirmation but no saved order”.
const PICKUP_ORDER_GUARD_WINDOW_MS = 120_000; // 2 minutes
const PICKUP_ORDER_GUARD_COOLDOWN_MS = 5_000; // prevent rapid-fire loops

// ============================================================================
// COUNTRY TO TIMEZONE MAPPING
// ============================================================================
const COUNTRY_TO_TIMEZONE: Record<string, string> = {
  // Europe
  "United Kingdom": "Europe/London",
  "UK": "Europe/London",
  "England": "Europe/London",
  "Scotland": "Europe/London",
  "Wales": "Europe/London",
  "Ireland": "Europe/Dublin",
  "France": "Europe/Paris",
  "Germany": "Europe/Berlin",
  "Spain": "Europe/Madrid",
  "Italy": "Europe/Rome",
  "Netherlands": "Europe/Amsterdam",
  "Belgium": "Europe/Brussels",
  "Portugal": "Europe/Lisbon",
  "Poland": "Europe/Warsaw",
  "Sweden": "Europe/Stockholm",
  "Norway": "Europe/Oslo",
  "Denmark": "Europe/Copenhagen",
  "Finland": "Europe/Helsinki",
  "Austria": "Europe/Vienna",
  "Switzerland": "Europe/Zurich",
  "Greece": "Europe/Athens",
  // North America
  "United States": "America/New_York",
  "USA": "America/New_York",
  "US": "America/New_York",
  "Canada": "America/Toronto",
  "Mexico": "America/Mexico_City",
  // Asia
  "United Arab Emirates": "Asia/Dubai",
  "UAE": "Asia/Dubai",
  "Dubai": "Asia/Dubai",
  "Saudi Arabia": "Asia/Riyadh",
  "Qatar": "Asia/Qatar",
  "India": "Asia/Kolkata",
  "Singapore": "Asia/Singapore",
  "Japan": "Asia/Tokyo",
  "China": "Asia/Shanghai",
  "Hong Kong": "Asia/Hong_Kong",
  "South Korea": "Asia/Seoul",
  "Thailand": "Asia/Bangkok",
  "Malaysia": "Asia/Kuala_Lumpur",
  "Indonesia": "Asia/Jakarta",
  "Philippines": "Asia/Manila",
  "Vietnam": "Asia/Ho_Chi_Minh",
  "Pakistan": "Asia/Karachi",
  "Bangladesh": "Asia/Dhaka",
  "Turkey": "Europe/Istanbul",
  "Israel": "Asia/Jerusalem",
  // Oceania
  "Australia": "Australia/Sydney",
  "New Zealand": "Pacific/Auckland",
  // Africa
  "South Africa": "Africa/Johannesburg",
  "Nigeria": "Africa/Lagos",
  "Egypt": "Africa/Cairo",
  "Kenya": "Africa/Nairobi",
  "Morocco": "Africa/Casablanca",
  // South America
  "Brazil": "America/Sao_Paulo",
  "Argentina": "America/Buenos_Aires",
  "Chile": "America/Santiago",
  "Colombia": "America/Bogota",
  "Peru": "America/Lima",
};

function getTimezoneForCountry(country: string | null | undefined): string {
  if (!country) return "Europe/London"; // Default to UK
  return COUNTRY_TO_TIMEZONE[country] || "Europe/London";
}

interface StreamSession {
  businessId: string;
  businessName: string;
  businessType: BusinessType;
  businessTimezone: string; // NEW: Dynamic timezone based on business country
  twilioPhoneNumber: string | null;
  callSid: string;
  callerPhone: string;
  callerName: string | null;
  // Passed from voice webhook (more reliable than DB lookup during greeting)
  callerIsReturning?: boolean;
  callerFirstName?: string | null;
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
  // Restaurant-specific cached data
  tables: any[];
  menuCategories: any[];
  menuItems: any[];
  restaurantSettings: any;
  // Call stability tracking
  interactionCount: number;
  callStartTime: number;
  // Audio playback + response tracking for stability
  isAISpeaking: boolean;
  lastAudioSentAt: number | null;
  hasActiveResponse: boolean;
  lastTranscriptionFailureAt: number | null;
  // OpenAI reconnect (in-place) tracking
  openAiReconnectAttempts: number;
  openAiReconnectTimeoutId: number | null;
  lastOpenAiDisconnectAt: number | null;
  // Extended memory tracking
  conversationHistory: Array<{ role: string; content: string; itemId?: string }>;
  estimatedTokens: number;
  isReconnect: boolean;
  reconnectCount: number;
  // NEW: Keepalive and silence detection
  keepaliveIntervalId: number | null;
  silenceCheckIntervalId: number | null;
  lastAudioReceivedAt: number;
  lastKeepaliveSentAt: number | null;
  
  // NEW: Proactive stream rotation
  streamStartedAt: number;
  streamRotationCheckIntervalId: number | null;
  isRotating: boolean;

  // Guardrails: prevent confirming orders without tool success
  assistantTranscriptBuffer: string;
  enforcingPickupOrderCreation: boolean;
  pickupOrderEnforcementStartedAt: number | null;
  pickupOrderEnforcementToolCalled: boolean;
  lastSuccessfulPickupOrderAt: number | null;
  lastPickupOrderNumber: string | null;
  lastPickupOrderId: string | null;
  lastPickupGuardTriggeredAt: number | null;

  // Premium voice (ElevenLabs Flash v2.5) — gated by business_settings.use_elevenlabs_voice.
  // When false (default), the existing OpenAI audio output path runs unchanged.
  // When true, OpenAI runs in text-only mode and `elevenLabs` synthesizes speech.
  useElevenLabs: boolean;
  elevenLabsVoiceId: string | null;
  elevenLabs: ElevenLabsTTS | null;
}

interface BusinessSettings {
  min_booking_notice_hours: number;
  max_days_advance: number;
  min_cancellation_notice_hours: number;
  min_reschedule_notice_hours: number;
  cancellation_policy: string | null;
  currency: string;
  opening_context?: string | null;
  business_name_phonetic?: string | null;
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
  is_business_owner: boolean;
  working_hours: Record<string, { start: string; end: string }> | null;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  category: string;
  description: string | null;
  deposit_required: boolean | null;
  deposit_amount: number | null;
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
  recentCallContext?: string;
  preferredLanguage?: string;
}

// Start recording via Twilio REST API - called when call is in-progress
// Returns the recording SID if successful, null otherwise
async function tryStartTwilioCallRecording(opts: {
  callSid: string;
  recordingStatusCallbackUrl: string;
}): Promise<string | null> {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!opts.callSid) {
    console.warn("[MediaStream] No CallSid - cannot start recording");
    return null;
  }

  if (!twilioAccountSid || !twilioAuthToken) {
    console.warn("[MediaStream] Missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN - cannot start recording");
    return null;
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls/${opts.callSid}/Recordings.json`;
  const authHeader = "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

  console.log("[MediaStream] Starting call recording via Twilio API:", {
    callSid: opts.callSid,
    callbackUrl: opts.recordingStatusCallbackUrl,
  });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        RecordingStatusCallback: opts.recordingStatusCallbackUrl,
        RecordingStatusCallbackMethod: "POST",
        RecordingStatusCallbackEvent: "completed",
      }),
    });

    const bodyText = await res.text();

    if (!res.ok) {
      console.error("[MediaStream] Failed to start recording:", res.status, bodyText);
      return null;
    }

    console.log("[MediaStream] Recording started successfully:", bodyText);
    
    // Parse the response to get the recording SID
    try {
      const recordingData = JSON.parse(bodyText);
      return recordingData.sid || null;
    } catch {
      return null;
    }
  } catch (error) {
    console.error("[MediaStream] Error starting recording:", error);
    return null;
  }
}

// Stop recording via Twilio REST API - called when caller opts out
async function stopTwilioCallRecording(callSid: string): Promise<boolean> {
  const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

  if (!callSid || !twilioAccountSid || !twilioAuthToken) {
    console.warn("[MediaStream] Missing credentials or callSid - cannot stop recording");
    return false;
  }

  const authHeader = "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

  try {
    // First, get active recordings for this call
    const listEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls/${callSid}/Recordings.json`;
    const listRes = await fetch(listEndpoint, {
      headers: { Authorization: authHeader },
    });

    if (!listRes.ok) {
      console.error("[MediaStream] Failed to list recordings:", listRes.status);
      return false;
    }

    const listData = await listRes.json();
    const activeRecordings = (listData.recordings || []).filter(
      (r: any) => r.status === "in-progress"
    );

    if (activeRecordings.length === 0) {
      console.log("[MediaStream] No active recordings to stop");
      return true; // Nothing to stop, consider it success
    }

    // Stop each active recording
    for (const recording of activeRecordings) {
      const stopEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Recordings/${recording.sid}.json`;
      const stopRes = await fetch(stopEndpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Status: "stopped" }),
      });

      if (stopRes.ok) {
        console.log("[MediaStream] Recording stopped successfully:", recording.sid);
      } else {
        console.error("[MediaStream] Failed to stop recording:", recording.sid, stopRes.status);
      }
    }

    return true;
  } catch (error) {
    console.error("[MediaStream] Error stopping recording:", error);
    return false;
  }
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

  // Find business by token - include business_type and restaurant settings
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(`
      id, business_name, address, twilio_enabled, aivia_active, twilio_phone_number, website_knowledge,
      business_type, cuisine_type, menu_link, payment_methods, require_prepayment, prepayment_type,
      minimum_order_amount, refund_policy, refund_window_hours, average_prep_time_minutes
    `)
    .eq("twilio_webhook_token", token)
    .maybeSingle();

  if (businessError || !business) {
    console.error("[MediaStream] Business not found for token");
    return new Response("Invalid token", { status: 401 });
  }

  // Get business AI settings (including country for timezone)
  const { data: settings } = await supabase
    .from("business_settings")
    .select(
      "assistant_name, tone, primary_language, voice_gender, voice_speed, elevenlabs_voice_id, opening_context, country, use_elevenlabs_voice"
    )
    .eq("business_id", business.id)
    .maybeSingle();

  const assistantName = settings?.assistant_name || "Aivia";
  const tone = settings?.tone || "neutral";
  const voiceGender = settings?.voice_gender || "female";
  const voiceSpeed = settings?.voice_speed || "normal";
  const selectedVoice = settings?.elevenlabs_voice_id;
  const businessTimezone = getTimezoneForCountry(settings?.country);

  // Use selected OpenAI voice, or fallback to gender-based default.
  // The same `elevenlabs_voice_id` column is reused for both providers — for
  // the OpenAI path we only accept it if it's a valid OpenAI voice id.
  const openAiVoice = selectedVoice && OPENAI_VOICES.includes(selectedVoice) 
    ? selectedVoice 
    : (voiceGender === "male" ? "ash" : "coral");

  // Premium voice routing. We default OFF and auto-fall-back to the OpenAI
  // path if the API key is missing so a misconfigured business never drops
  // a call.
  const useElevenLabsRequested = settings?.use_elevenlabs_voice === true;
  const useElevenLabs = useElevenLabsRequested && !!ELEVENLABS_API_KEY;
  if (useElevenLabsRequested && !ELEVENLABS_API_KEY) {
    console.error(
      "[MediaStream] use_elevenlabs_voice is ON for business but ELEVENLABS_API_KEY missing — falling back to OpenAI voice"
    );
  }
  // For ElevenLabs, accept whatever voice id the business chose. If it
  // happens to also be a valid OpenAI voice id, fall back to a sensible
  // default ElevenLabs voice instead.
  const elevenLabsVoiceId = useElevenLabs
    ? (selectedVoice && !OPENAI_VOICES.includes(selectedVoice)
        ? selectedVoice
        : DEFAULT_ELEVENLABS_VOICE_ID)
    : null;

  // Upgrade to WebSocket
  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  const businessType = (business.business_type || "salon") as BusinessType;

  const session: StreamSession = {
    businessId: business.id,
    businessName: business.business_name,
    businessType,
    businessTimezone, // Dynamic timezone based on country
    twilioPhoneNumber: business.twilio_phone_number || null,
    callSid: "",
    callerPhone: "",
    callerName: null,
    callerIsReturning: false,
    callerFirstName: null,
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
    // Restaurant-specific cached data
    tables: [],
    menuCategories: [],
    menuItems: [],
    restaurantSettings: {
      cuisineType: business.cuisine_type,
      menuLink: business.menu_link,
      paymentMethods: business.payment_methods || ["card"],
      requirePrepayment: business.require_prepayment || false,
      prepaymentType: business.prepayment_type || "none",
      minimumOrderAmount: business.minimum_order_amount,
      refundPolicy: business.refund_policy || "full_refund",
      refundWindowHours: business.refund_window_hours || 2,
      averagePrepTime: business.average_prep_time_minutes || 30,
    },
    // Call stability tracking
    interactionCount: 0,
    callStartTime: Date.now(),
    // Audio playback + response tracking for stability
    isAISpeaking: false,
    lastAudioSentAt: null,
    hasActiveResponse: false,
    lastTranscriptionFailureAt: null,
    // OpenAI reconnect (in-place) tracking
    openAiReconnectAttempts: 0,
    openAiReconnectTimeoutId: null,
    lastOpenAiDisconnectAt: null,
    // Extended memory tracking
    conversationHistory: [],
    estimatedTokens: 0,
    isReconnect: false,
    reconnectCount: 0,
    // Keepalive and silence detection
    keepaliveIntervalId: null,
    silenceCheckIntervalId: null,
    lastAudioReceivedAt: Date.now(),
    lastKeepaliveSentAt: null,
    
    // Proactive stream rotation
    streamStartedAt: Date.now(),
    streamRotationCheckIntervalId: null,
    isRotating: false,

    // Guardrails
    assistantTranscriptBuffer: "",
    enforcingPickupOrderCreation: false,
    pickupOrderEnforcementStartedAt: null,
    pickupOrderEnforcementToolCalled: false,
    lastSuccessfulPickupOrderAt: null,
    lastPickupOrderNumber: null,
    lastPickupOrderId: null,
    lastPickupGuardTriggeredAt: null,

    // Premium voice (ElevenLabs Flash v2.5)
    useElevenLabs,
    elevenLabsVoiceId,
    elevenLabs: null,
  };

  if (useElevenLabs) {
    console.log("[MediaStream] Premium voice ENABLED for business", {
      businessId: business.id,
      voiceId: elevenLabsVoiceId,
    });
  }

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
          // Reset stream tracking for rotation
          session.streamStartedAt = Date.now();
          session.isRotating = false;
          
          console.log("[MediaStream] Stream started:", JSON.stringify(data.start));
          session.streamSid = data.start.streamSid;
          // Get callSid from customParameters (passed from webhook) or fallback to stream's callSid
          session.callSid = data.start.customParameters?.callSid || data.start.callSid;
          session.callerPhone = data.start.customParameters?.callerPhone || "";
          const recordingCallbackUrl = data.start.customParameters?.recordingCallbackUrl || "";

          // Caller personalization passed from voice webhook
          session.callerIsReturning = data.start.customParameters?.isReturning === "true";
          session.callerFirstName = (data.start.customParameters?.customerFirstName || "").trim() || null;

          // Check if this is a reconnect
          session.isReconnect = data.start.customParameters?.isReconnect === "true";
          session.reconnectCount = parseInt(data.start.customParameters?.reconnectCount || "0", 10);

          console.log(
            "[MediaStream] Session initialized - callSid:",
            session.callSid,
            "callerPhone:",
            session.callerPhone,
            "isReturning:",
            session.callerIsReturning,
            "callerFirstName:",
            session.callerFirstName,
            "isReconnect:",
            session.isReconnect,
            "reconnectCount:",
            session.reconnectCount,
            "streamAge:", 0
          );

          // Start recording now that call is definitely in-progress (skip on reconnect - recording continues)
          if (!session.isReconnect && recordingCallbackUrl && session.callSid) {
            tryStartTwilioCallRecording({
              callSid: session.callSid,
              recordingStatusCallbackUrl: recordingCallbackUrl,
            });
          } else if (session.isReconnect) {
            console.log("[MediaStream] Reconnect - skipping recording start (recording continues)");
          } else {
            console.warn("[MediaStream] Cannot start recording - missing callSid or recordingCallbackUrl");
          }

          // Build full system prompt with caller context AND cache business data for tool validation
          const promptData = await buildFullSystemPrompt(
            supabase, 
            business.id, 
            business.business_name,
            business.address,
            assistantName, 
            tone,
            voiceSpeed,
            session.callerPhone,
            business.twilio_phone_number,
            business.website_knowledge,
            session.businessType,
            session.restaurantSettings,
            session.businessTimezone, // Pass business timezone
            session.callSid // Pass callSid for caller info lookup
          );

          session.systemPrompt = promptData.prompt;
          session.businessSettings = promptData.businessSettings;
          session.openingHours = promptData.openingHours;
          session.staffTimeOff = promptData.staffTimeOff;
          session.staffServices = promptData.staffServices;
          session.staff = promptData.staff;
          session.services = promptData.services;
          // Restaurant-specific cached data
          session.menuCategories = promptData.menuCategories || [];
          session.menuItems = promptData.menuItems || [];
          session.tables = promptData.tables || [];

          // Connect to OpenAI Realtime API
          await connectToOpenAI(session, supabase);
          break;

        case "media":
          // Track audio activity for silence detection
          session.lastAudioReceivedAt = Date.now();
          
          // Forward audio to OpenAI
          if (session.openAiWs?.readyState === WebSocket.OPEN) {
            const audioMessage = {
              type: "input_audio_buffer.append",
              audio: data.media.payload, // Already base64 encoded mulaw
            };
            session.openAiWs.send(JSON.stringify(audioMessage));
          }
          break;

        case "stop": {
          const streamAgeSec = Math.round((Date.now() - session.streamStartedAt) / 1000);
          console.log("[MediaStream] Stream stopped after", streamAgeSec, "seconds", {
            callSid: session.callSid,
            streamSid: session.streamSid,
            isReconnect: session.isReconnect,
            isRotating: session.isRotating,
          });
          // Clean up all intervals
          stopKeepalive(session);
          stopSilenceDetection(session);
          stopStreamRotationCheck(session);
          if (session.openAiWs) {
            session.openAiWs.close();
          }
          break;
        }

        case "mark":
          // Twilio confirms audio has finished playing
          console.log("[MediaStream] Twilio mark received:", data.mark?.name);
          if (data.mark?.name === "audio_complete") {
            session.isAISpeaking = false;
            session.lastAudioSentAt = null;
            console.log("[MediaStream] Audio playback confirmed complete");
          }
          break;

        default:
          console.log("[MediaStream] Unknown Twilio event:", data.event);
      }
    } catch (error) {
      console.error("[MediaStream] Error processing Twilio message:", error);
    }
  };

  twilioWs.onclose = (ev) => {
    const streamAgeSec = Math.round((Date.now() - session.streamStartedAt) / 1000);
    console.log("[MediaStream] Twilio WebSocket closed after", streamAgeSec, "seconds", {
      code: (ev as any)?.code,
      reason: (ev as any)?.reason,
      isRotating: session.isRotating,
    });
    // Clean up all intervals
    stopKeepalive(session);
    stopSilenceDetection(session);
    stopStreamRotationCheck(session);
    if (session.openAiWs) {
      session.openAiWs.close();
    }
  };

  twilioWs.onerror = (error) => {
    console.error("[MediaStream] Twilio WebSocket error:", error);
  };

  return response;
});

// ============================================================================
// KEEPALIVE AND SILENCE DETECTION
// ============================================================================

function startKeepalive(session: StreamSession, supabase: any) {
  stopKeepalive(session); // Clear any existing
  
  session.keepaliveIntervalId = setInterval(() => {
    if (session.openAiWs?.readyState === WebSocket.OPEN) {
      // Send a lightweight keepalive - commit empty audio buffer
      // This keeps the OpenAI connection alive without disrupting conversation
      try {
        session.openAiWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        session.lastKeepaliveSentAt = Date.now();
        console.log("[MediaStream] Keepalive ping sent");
      } catch (err) {
        console.warn("[MediaStream] Failed to send keepalive:", err);
      }
    }
  }, KEEPALIVE_INTERVAL_MS) as unknown as number;
  
  console.log(`[MediaStream] Keepalive started (every ${KEEPALIVE_INTERVAL_MS / 1000}s)`);
}

function stopKeepalive(session: StreamSession) {
  if (session.keepaliveIntervalId !== null) {
    clearInterval(session.keepaliveIntervalId);
    session.keepaliveIntervalId = null;
    console.log("[MediaStream] Keepalive stopped");
  }
}

function startSilenceDetection(session: StreamSession, supabase: any, scheduleOpenAiReconnectFn: (reason: string, meta?: Record<string, unknown>) => void) {
  stopSilenceDetection(session); // Clear any existing
  
  session.silenceCheckIntervalId = setInterval(() => {
    const now = Date.now();
    const silenceDuration = now - session.lastAudioReceivedAt;
    
    // Only check if we're not in the middle of AI speaking
    if (silenceDuration > SILENCE_THRESHOLD_MS && !session.isAISpeaking) {
      console.log(`[MediaStream] Silence detected (${Math.round(silenceDuration / 1000)}s) - checking connection health`);
      
      // Check if OpenAI connection is still alive
      if (session.openAiWs?.readyState !== WebSocket.OPEN) {
        console.warn("[MediaStream] OpenAI connection stale during silence - triggering reconnect");
        scheduleOpenAiReconnectFn("stale_connection_silence", { silenceDuration });
      } else {
        // Connection is open but no audio - could be caller on hold
        // Send a keepalive to ensure the connection stays fresh
        try {
          session.openAiWs.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
          console.log("[MediaStream] Silence keepalive sent");
        } catch (err) {
          console.warn("[MediaStream] Failed to send silence keepalive:", err);
          scheduleOpenAiReconnectFn("keepalive_failed", { error: String(err) });
        }
      }
    }
  }, SILENCE_CHECK_INTERVAL_MS) as unknown as number;
  
  console.log(`[MediaStream] Silence detection started (check every ${SILENCE_CHECK_INTERVAL_MS / 1000}s, threshold ${SILENCE_THRESHOLD_MS / 1000}s)`);
}

function stopSilenceDetection(session: StreamSession) {
  if (session.silenceCheckIntervalId !== null) {
    clearInterval(session.silenceCheckIntervalId);
    session.silenceCheckIntervalId = null;
    console.log("[MediaStream] Silence detection stopped");
  }
}

// ============================================================================
// PROACTIVE STREAM ROTATION
// ============================================================================

function startStreamRotationCheck(session: StreamSession, supabase: any) {
  if (!STREAM_ROTATION_ENABLED) {
    console.log("[MediaStream] Stream rotation is disabled");
    return;
  }
  
  stopStreamRotationCheck(session); // Clear any existing
  
  session.streamStartedAt = Date.now();
  
  session.streamRotationCheckIntervalId = setInterval(async () => {
    const streamAgeMs = Date.now() - session.streamStartedAt;
    const streamAgeSec = Math.round(streamAgeMs / 1000);
    
    // Check if we should rotate
    if (streamAgeMs >= STREAM_ROTATION_INTERVAL_MS && !session.isRotating) {
      console.log(`[MediaStream] Stream age ${streamAgeSec}s exceeds threshold - initiating proactive rotation`);
      
      session.isRotating = true;
      
      // Log rotation event to conversation
      try {
        await logConversation(
          supabase,
          session.callSid,
          "system",
          `[rotation] Proactive stream rotation after ${streamAgeSec}s`
        );
      } catch {
        // non-blocking
      }
      
      // Stop all intervals before closing
      stopKeepalive(session);
      stopSilenceDetection(session);
      stopStreamRotationCheck(session);
      
      // Close the Twilio WebSocket to trigger stream-action reconnect
      // This will cause Twilio to hit the action URL and restart the stream
      if (session.twilioWs?.readyState === WebSocket.OPEN) {
        console.log("[MediaStream] Closing Twilio WebSocket for rotation");
        session.twilioWs.close(1000, "proactive_rotation");
      }
    }
  }, STREAM_ROTATION_CHECK_INTERVAL_MS) as unknown as number;
  
  console.log(`[MediaStream] Stream rotation check started (threshold: ${STREAM_ROTATION_INTERVAL_MS / 1000}s, check every ${STREAM_ROTATION_CHECK_INTERVAL_MS / 1000}s)`);
}

function stopStreamRotationCheck(session: StreamSession) {
  if (session.streamRotationCheckIntervalId !== null) {
    clearInterval(session.streamRotationCheckIntervalId);
    session.streamRotationCheckIntervalId = null;
    console.log("[MediaStream] Stream rotation check stopped");
  }
}

function isRestaurantPickupFlow(session: StreamSession): boolean {
  return session.businessType === "restaurant_pickup" || session.businessType === "restaurant_hybrid";
}

function shouldTriggerPickupOrderGuard(session: StreamSession, transcriptSoFar: string): boolean {
  if (!isRestaurantPickupFlow(session)) return false;
  if (session.enforcingPickupOrderCreation) return false;

  const now = Date.now();
  const lastOk = session.lastSuccessfulPickupOrderAt;
  const hasRecentToolSuccess = !!(lastOk && now - lastOk < PICKUP_ORDER_GUARD_WINDOW_MS);
  if (hasRecentToolSuccess) return false;

  const t = (transcriptSoFar || "").toLowerCase();
  if (t.length < 40) return false;

  // Phrases that almost always imply the AI is “confirming / finalizing”.
  // We intentionally keep this list focused to avoid false positives.
  const triggers = [
    "your order is confirmed",
    "order is confirmed",
    "order number",
    "text confirmation",
    "you'll receive a text",
    "you will receive a text",
    "ready for pickup",
    "be ready for pickup",
    "will be ready",
    "it'll be ready",
    "it will be ready",
    "that'll be ready",
    "that will be ready",
    "we'll have that ready",
    "we will have that ready",
  ];

  return triggers.some((s) => t.includes(s));
}

async function enforcePickupOrderCreation(session: StreamSession, supabase: any, transcriptSoFar: string) {
  const now = Date.now();
  if (session.lastPickupGuardTriggeredAt && now - session.lastPickupGuardTriggeredAt < PICKUP_ORDER_GUARD_COOLDOWN_MS) {
    return;
  }

  session.lastPickupGuardTriggeredAt = now;
  session.enforcingPickupOrderCreation = true;
  session.pickupOrderEnforcementStartedAt = now;
  session.pickupOrderEnforcementToolCalled = false;
  session.assistantTranscriptBuffer = "";

  console.warn("[MediaStream][Guard] Blocking pickup confirmation without create_pickup_order tool success", {
    businessId: session.businessId,
    callSid: session.callSid,
    transcriptTail: (transcriptSoFar || "").slice(-160),
  });

  // Log guard intervention for audits/debugging.
  try {
    await logConversation(
      supabase,
      session.callSid,
      "system",
      "[guard] Prevented verbal pickup order confirmation before create_pickup_order succeeded; forcing tool call."
    );
  } catch {
    // non-blocking
  }

  // Stop any audio currently queued to Twilio (prevents the caller hearing the incorrect confirmation).
  if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
    try {
      session.twilioWs.send(JSON.stringify({ event: "clear", streamSid: session.streamSid }));
    } catch {
      // ignore
    }
  }

  // Cancel any in-progress model response if present.
  if (session.hasActiveResponse && session.openAiWs?.readyState === WebSocket.OPEN) {
    try {
      session.openAiWs.send(JSON.stringify({ type: "response.cancel" }));
    } catch {
      // ignore
    }
  }

  session.hasActiveResponse = false;
  session.isAISpeaking = false;
  session.lastAudioSentAt = null;

  // Force the model to place the order using tools before confirming.
  if (session.openAiWs?.readyState === WebSocket.OPEN) {
    const avgPrep = session.restaurantSettings?.averagePrepTime || 30;
    session.openAiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
          instructions: [
            "CRITICAL: You started to verbally confirm a pickup order, but you have NOT successfully called create_pickup_order yet.",
            "Do NOT confirm the order, do NOT give an order number, and do NOT promise a ready time until create_pickup_order returns success.",
            "",
            "First say, verbatim: 'One moment — I'm just placing that order now.'",
            `Then immediately call the create_pickup_order tool using the full order details from the conversation. Pickup time must be ASAP (current time + ${avgPrep} minutes).`,
            "If required info is missing (customer name, required option, size), ask the caller for ONLY that missing piece instead of confirming.",
          ].join("\n"),
        },
      })
    );
  }
}

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
    // Reset reconnect attempts on successful connection
    session.openAiReconnectAttempts = 0;
    // Start keepalive, silence detection, and stream rotation check
    startKeepalive(session, supabase);
    startSilenceDetection(session, supabase, scheduleOpenAiReconnect);
    startStreamRotationCheck(session, supabase);
    // Session config will be sent after receiving session.created
  };

  function scheduleOpenAiReconnect(reason: string, meta: Record<string, unknown> = {}) {
    const now = Date.now();

    // If we had a long stable period (60+ seconds), forgive previous reconnect attempts
    if (session.lastOpenAiDisconnectAt && now - session.lastOpenAiDisconnectAt > 60_000) {
      console.log("[MediaStream] Long stable period detected - resetting reconnect attempts");
      session.openAiReconnectAttempts = 0;
    }
    session.lastOpenAiDisconnectAt = now;

    // Stop keepalive and silence detection during reconnect
    stopKeepalive(session);
    stopSilenceDetection(session);

    // Avoid multiple timers
    if (session.openAiReconnectTimeoutId !== null) return;

    // Only attempt reconnect if Twilio stream is still alive
    if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN) {
      console.warn("[MediaStream] Skipping OpenAI reconnect - Twilio WS not open", { reason, ...meta });
      return;
    }

    // Use exponential backoff for delay
    const delayMs = BASE_RECONNECT_DELAY_MS * Math.pow(1.5, session.openAiReconnectAttempts);

    if (session.openAiReconnectAttempts >= MAX_OPENAI_RECONNECT_ATTEMPTS) {
      console.warn("[MediaStream] OpenAI reconnect attempts exhausted - falling back to Twilio stream reconnect", {
        attempts: session.openAiReconnectAttempts,
        reason,
        ...meta,
      });

      // Log reconnect event to conversation
      logConversation(
        supabase,
        session.callSid,
        "system",
        `[reconnect] OpenAI unstable; restarting stream (fallback after ${MAX_OPENAI_RECONNECT_ATTEMPTS} attempts)`
      ).catch(() => {});

      // Fall back to existing stream-action reconnect flow (and its fallback behavior)
      if (session.twilioWs.readyState === WebSocket.OPEN) {
        session.isReconnect = true;
        session.twilioWs.close();
      }
      return;
    }

    session.openAiReconnectAttempts += 1;
    session.isReconnect = true;

    const attempt = session.openAiReconnectAttempts;
    console.log(`[MediaStream] Scheduling in-place OpenAI reconnect (${attempt}/${MAX_OPENAI_RECONNECT_ATTEMPTS}) in ${Math.round(delayMs)}ms`, {
      reason,
      ...meta,
    });

    logConversation(
      supabase,
      session.callSid,
      "system",
      `[reconnect] In-place OpenAI reconnect attempt ${attempt}/${MAX_OPENAI_RECONNECT_ATTEMPTS} (delay: ${Math.round(delayMs)}ms)`
    ).catch(() => {});

    session.openAiReconnectTimeoutId = setTimeout(() => {
      session.openAiReconnectTimeoutId = null;

      // If we already reconnected, don't double-connect
      if (session.openAiWs && session.openAiWs.readyState === WebSocket.OPEN) return;
      if (!session.twilioWs || session.twilioWs.readyState !== WebSocket.OPEN) return;

      connectToOpenAI(session, supabase).catch((err) => {
        console.error("[MediaStream] Failed to start OpenAI reconnect:", err);
      });
    }, delayMs) as unknown as number;
  }

  openAiWs.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case "session.created":
          console.log("[MediaStream] OpenAI session created, sending config...");
          await sendSessionConfig(session, supabase);
          break;

        case "session.updated":
          console.log("[MediaStream] OpenAI session updated");
          break;

        case "response.created":
          // Track active responses so we don't send response.cancel when nothing is running
          session.hasActiveResponse = true;
          // Reset transcript buffer for the new response
          session.assistantTranscriptBuffer = "";
          break;

        case "response.audio.delta":
          // Forward audio to Twilio
          // Mark the *start* of playback so we can allow barge-in after a short grace period
          if (!session.isAISpeaking) {
            session.isAISpeaking = true;
            session.lastAudioSentAt = Date.now();
          }

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
          // Send mark to track when Twilio finishes playing the audio
          if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
            session.twilioWs.send(
              JSON.stringify({
                event: "mark",
                streamSid: session.streamSid,
                mark: { name: "audio_complete" },
              })
            );
          }
          break;

        case "response.audio_transcript.delta":
          // AI is speaking - accumulate transcript for guardrails + log for debugging
          if (data.delta) {
            session.assistantTranscriptBuffer += data.delta;
            // Keep buffer bounded
            if (session.assistantTranscriptBuffer.length > 4000) {
              session.assistantTranscriptBuffer = session.assistantTranscriptBuffer.slice(-2000);
            }

            console.log("[MediaStream] AI speaking:", data.delta.substring(0, 100));

            // Guard: block verbal confirmation until create_pickup_order succeeds
            if (shouldTriggerPickupOrderGuard(session, session.assistantTranscriptBuffer)) {
              await enforcePickupOrderCreation(session, supabase, session.assistantTranscriptBuffer);
            }
          }
          break;

        case "input_audio_buffer.speech_started": {
          // Only interrupt if the AI is actually speaking or generating
          const isInterruptingSomething = session.isAISpeaking || session.hasActiveResponse;
          if (!isInterruptingSomething) break;

          // Prevent interruption if AI just started speaking (prevents audio cutoff)
          const timeSinceAudioStarted = session.lastAudioSentAt
            ? Date.now() - session.lastAudioSentAt
            : 1000;

          if (session.isAISpeaking && timeSinceAudioStarted < 600) {
            console.log(
              "[MediaStream] Ignoring interruption - AI just started speaking (" +
                timeSinceAudioStarted +
                "ms ago)"
            );
            break;
          }

          console.log("[MediaStream] User started speaking - interrupting AI");
          session.isAISpeaking = false;
          session.lastAudioSentAt = null;

          // Clear any pending AI audio (barge-in)
          if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
            session.twilioWs.send(
              JSON.stringify({
                event: "clear",
                streamSid: session.streamSid,
              })
            );
          }

          // Cancel any in-progress response (only if one is active)
          if (session.hasActiveResponse && session.openAiWs?.readyState === WebSocket.OPEN) {
            session.openAiWs.send(JSON.stringify({ type: "response.cancel" }));
          }

          session.hasActiveResponse = false;
          break;
        }

        case "input_audio_buffer.speech_stopped":
          console.log("[MediaStream] User stopped speaking");
          break;

        case "conversation.item.input_audio_transcription.failed": {
          console.warn("[MediaStream] OpenAI event: conversation.item.input_audio_transcription.failed");

          // Avoid spamming the caller if multiple failures happen in a row
          const now = Date.now();
          const shouldRecover =
            !session.lastTranscriptionFailureAt || now - session.lastTranscriptionFailureAt > 3000;
          session.lastTranscriptionFailureAt = now;

          if (shouldRecover && session.openAiWs?.readyState === WebSocket.OPEN) {
            // Stop any audio currently queued to Twilio
            if (session.twilioWs?.readyState === WebSocket.OPEN && session.streamSid) {
              session.twilioWs.send(
                JSON.stringify({
                  event: "clear",
                  streamSid: session.streamSid,
                })
              );
            }

            // Cancel any in-progress model response if present
            if (session.hasActiveResponse) {
              session.openAiWs.send(JSON.stringify({ type: "response.cancel" }));
            }

            session.hasActiveResponse = false;
            session.isAISpeaking = false;
            session.lastAudioSentAt = null;

            // Ask the caller to repeat (recovery)
            session.openAiWs.send(
              JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["audio", "text"],
                  instructions:
                    "Sorry — I didn't catch that clearly. Could you repeat that last bit for me?",
                },
              })
            );

            await logConversation(
              supabase,
              session.callSid,
              "assistant",
              "[Audio issue] Asked caller to repeat."
            );
          }
          break;
        }

        case "conversation.item.input_audio_transcription.completed":
          console.log("[MediaStream] User said:", data.transcript);
          // Track user interactions for call stability
          session.interactionCount++;
          // Log to conversation
          await logConversation(supabase, session.callSid, "user", data.transcript);
          // Track in local conversation history for memory management
          session.conversationHistory.push({
            role: "user",
            content: data.transcript,
            itemId: data.item_id,
          });
          break;

        case "response.function_call_arguments.done":
          console.log("[MediaStream] Function call complete:", data.name, data.arguments);
          // If the model is attempting to place an order, release enforcement state.
          if (data.name === "create_pickup_order") {
            session.pickupOrderEnforcementToolCalled = true;
            session.enforcingPickupOrderCreation = false;
            session.pickupOrderEnforcementStartedAt = null;
          }
          // Handle tool call
          await handleToolCall(session, supabase, data.call_id, data.name, data.arguments);
          break;

        case "response.done":
          console.log("[MediaStream] Response complete");
          session.hasActiveResponse = false;

          // If we forced an order placement but no tool call happened in this response,
          // release the lock so we can guard again later (prevents stuck state).
          if (session.enforcingPickupOrderCreation && !session.pickupOrderEnforcementToolCalled) {
            session.enforcingPickupOrderCreation = false;
            session.pickupOrderEnforcementStartedAt = null;
          }
          
          // Track tokens for memory management
          if (data.response?.usage?.total_tokens) {
            session.estimatedTokens = data.response.usage.total_tokens;
            console.log(`[MediaStream] Token usage: ${session.estimatedTokens}`);
            
            // Check if we need to summarize
            if (session.estimatedTokens > TOKEN_LIMIT_THRESHOLD) {
              console.log("[MediaStream] Token limit threshold reached, triggering summarization");
              summarizeAndPrune(session, supabase).catch((err) => {
                console.error("[MediaStream] Summarization error:", err);
              });
            }
          }
          
          // Log assistant responses and track in local history
          if (data.response?.output) {
            for (const output of data.response.output) {
              if (output.content) {
                for (const content of output.content) {
                  if (content.transcript) {
                    await logConversation(supabase, session.callSid, "assistant", content.transcript);
                    // Track in local conversation history
                    session.conversationHistory.push({
                      role: "assistant",
                      content: content.transcript,
                      itemId: output.id,
                    });
                  }
                }
              }
            }
          }
          break;

        case "error":
          // Ignore noisy cancellation errors (happens if we try to cancel when nothing is active)
          if (data.error?.code === "response_cancel_not_active") {
            console.warn("[MediaStream] OpenAI error (ignored):", data.error);
            break;
          }
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

  openAiWs.onclose = (ev) => {
    console.log("[MediaStream] OpenAI WebSocket closed", {
      code: ev?.code,
      reason: ev?.reason,
      wasClean: ev?.wasClean,
    });
    session.openAiWs = null;
    session.hasActiveResponse = false;
    session.isAISpeaking = false;
    session.lastAudioSentAt = null;

    // Prefer in-place reconnect first (keeps the phone call alive)
    scheduleOpenAiReconnect("close", {
      code: ev?.code,
      reason: ev?.reason,
      wasClean: ev?.wasClean,
    });
  };

  openAiWs.onerror = (error) => {
    console.error("[MediaStream] OpenAI WebSocket error:", error);

    // Prefer in-place reconnect first; fall back to stream-action if needed
    scheduleOpenAiReconnect("error", { error: String(error) });
  };
}

// Constants for token management
const TOKEN_LIMIT_THRESHOLD = 15000; // Start summarizing when we approach this
const LOVABLE_AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Rehydrate conversation context after a reconnect
async function rehydrateContext(session: StreamSession, supabase: any): Promise<void> {
  if (!session.callSid) return;
  
  console.log("[MediaStream] Rehydrating context for callSid:", session.callSid);
  
  try {
    // Load recent messages from call_conversations
    const { data: conversation } = await supabase
      .from("call_conversations")
      .select("messages")
      .eq("call_sid", session.callSid)
      .maybeSingle();
    
    if (!conversation?.messages || !Array.isArray(conversation.messages)) {
      console.log("[MediaStream] No conversation history found for rehydration");
      return;
    }
    
    // Filter to only user and assistant messages (skip system events)
    const relevantMessages = conversation.messages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .slice(-15); // Last 15 messages
    
    if (relevantMessages.length === 0) {
      console.log("[MediaStream] No relevant messages to rehydrate");
      return;
    }
    
    console.log(`[MediaStream] Rehydrating ${relevantMessages.length} messages`);
    
    // Send each message to OpenAI to rebuild context
    for (const msg of relevantMessages) {
      if (!session.openAiWs || session.openAiWs.readyState !== WebSocket.OPEN) break;
      
      const item: any = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: msg.role,
          content: [{
            type: msg.role === "user" ? "input_text" : "text",
            text: msg.content,
          }],
        },
      };
      
      session.openAiWs.send(JSON.stringify(item));
      
      // Track in local history
      session.conversationHistory.push({
        role: msg.role,
        content: msg.content,
      });
    }
    
    // Estimate tokens from rehydrated content
    session.estimatedTokens = relevantMessages.reduce(
      (sum: number, m: any) => sum + Math.ceil((m.content?.length || 0) / 4),
      0
    );
    
    console.log(`[MediaStream] Context rehydrated. Estimated tokens: ${session.estimatedTokens}`);
  } catch (error) {
    console.error("[MediaStream] Error rehydrating context:", error);
  }
}

// Summarize older messages to manage token window
async function summarizeAndPrune(session: StreamSession, supabase: any): Promise<void> {
  if (session.conversationHistory.length < 8) return; // Not enough to summarize
  
  console.log("[MediaStream] Token threshold reached, summarizing conversation...");
  
  try {
    // Get messages to summarize (all but last 5)
    const toSummarize = session.conversationHistory.slice(0, -5);
    const toKeep = session.conversationHistory.slice(-5);
    
    // Format conversation for summarization
    const conversationText = toSummarize
      .map((m) => `${m.role === "user" ? "Caller" : "Assistant"}: ${m.content}`)
      .join("\n");
    
    // Call Lovable AI for summarization
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.warn("[MediaStream] LOVABLE_API_KEY not configured - cannot summarize");
      return;
    }
    
    const summaryResponse = await fetch(LOVABLE_AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{
          role: "user",
          content: `Summarize this phone conversation in 2-3 sentences. Preserve key details like names, dates, times, services, and booking codes. Be concise:\n\n${conversationText}`,
        }],
        max_tokens: 200,
      }),
    });
    
    if (!summaryResponse.ok) {
      console.error("[MediaStream] Summarization failed:", summaryResponse.status);
      return;
    }
    
    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices?.[0]?.message?.content || "";
    
    if (!summary) {
      console.warn("[MediaStream] Empty summary returned");
      return;
    }
    
    console.log("[MediaStream] Conversation summarized:", summary.substring(0, 100) + "...");
    
    // Send summary as a system message to OpenAI
    if (session.openAiWs?.readyState === WebSocket.OPEN) {
      // Note: OpenAI Realtime API might not support injecting system messages mid-conversation
      // So we inject it as context in the next response instruction if needed
      session.openAiWs.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{
            type: "input_text",
            text: `[Context from earlier in call: ${summary}]`,
          }],
        },
      }));
    }
    
    // Update local history
    session.conversationHistory = [
      { role: "system", content: `Summary of earlier conversation: ${summary}` },
      ...toKeep,
    ];
    
    // Recalculate estimated tokens
    session.estimatedTokens = session.conversationHistory.reduce(
      (sum, m) => sum + Math.ceil(m.content.length / 4),
      0
    );
    
    // Log summary to database
    await logConversation(supabase, session.callSid, "system", `[auto-summary] ${summary}`);
    
    console.log(`[MediaStream] Pruned conversation. New token estimate: ${session.estimatedTokens}`);
  } catch (error) {
    console.error("[MediaStream] Error summarizing conversation:", error);
  }
}

async function sendSessionConfig(session: StreamSession, supabase: any) {
  if (!session.openAiWs || session.openAiWs.readyState !== WebSocket.OPEN) {
    console.error("[MediaStream] Cannot send config - WebSocket not open");
    return;
  }

  // Get tools based on business type - this is CRITICAL for restaurants to work
  let tools = getToolsForBusinessType(session.businessType);
  
  // Add stop_recording tool which is common to all business types
  tools.push({
    type: "function",
    name: "stop_recording",
    description: "Stop the call recording when the caller explicitly asks NOT to be recorded. Use this ONLY when the caller clearly says they don't want the call recorded.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Brief note about why recording was stopped, e.g., 'caller requested'" },
      },
      required: ["reason"],
    },
  });
  
  console.log(`[MediaStream] Using ${tools.length} tools for business type: ${session.businessType}`);

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
        threshold: 0.75,           // Slightly lower for better detection of quiet speakers
        prefix_padding_ms: 300,    // Standard pre-speech buffer
        silence_duration_ms: 1000, // Slightly longer pauses for natural conversation
        create_response: true,     // Auto-create response when speech ends
      },
      tools,
      tool_choice: "auto",
      temperature: 0.75,           // Higher for more natural variation in responses
      max_response_output_tokens: 600, // Increased for more complete responses in long calls
    },
  };

  console.log("[MediaStream] Sending session config with voice:", session.voice, "isReconnect:", session.isReconnect);
  session.openAiWs.send(JSON.stringify(config));

  // For reconnects, rehydrate context before triggering response
  if (session.isReconnect) {
    await rehydrateContext(session, supabase);
  }

  // Send initial greeting or reconnect acknowledgment
  setTimeout(() => {
    if (session.openAiWs?.readyState === WebSocket.OPEN) {
      const responseConfig: any = {
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
        },
      };

      // For reconnects, give the AI context about the reconnection
      if (session.isReconnect) {
        responseConfig.response.instructions =
          "The call was briefly reconnected due to a technical glitch. Continue the conversation naturally from where you left off. Say something brief like 'Sorry about that brief interruption. Now, where were we?' and continue helping the caller.";
      } else {
        // FORCE the first greeting to include BOTH:
        // 1) opening context (if set)
        // 2) returning-customer welcome (if caller is returning)
        const openingContext = session.businessSettings?.opening_context?.trim() || "";
        const firstName = (session.callerFirstName || session.callerName || "").trim();
        const isReturning = session.callerIsReturning === true;

        const safeOpening = openingContext.replace(/\s+/g, " ").trim();

        const greetingLead = isReturning
          ? (firstName
              ? `Hey ${firstName}! Welcome back!`
              : `Hey there! Welcome back to ${session.businessName}!`)
          : `Hey there! Thanks for calling ${session.businessName}!`;

        const parts = [
          greetingLead,
          safeOpening ? `Quick note: ${safeOpening}` : "",
          "Just so you know, this call may be recorded to help us improve our service.",
          "What can I do for you today?",
        ].filter(Boolean);

        const forcedGreeting = parts.join(" ");

        responseConfig.response.instructions = `Say this exact greeting verbatim, then wait for the caller:\n"${forcedGreeting}"`;
      }

      session.openAiWs.send(JSON.stringify(responseConfig));
      console.log("[MediaStream] Triggered", session.isReconnect ? "reconnect greeting" : "initial greeting");
    }
  }, 100);
}

async function handleToolCall(session: StreamSession, supabase: any, callId: string, name: string, argumentsJson: string) {
  console.log("[MediaStream] Handling tool call:", name);

  let result: any = { success: false, message: "Unknown tool" };

  try {
    const args = JSON.parse(argumentsJson);

    switch (name) {
      // Salon tools
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
      case "update_customer_name":
        result = await executeUpdateCustomerName(supabase, session, args);
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
      case "stop_recording":
        result = await executeStopRecording(session, args);
        break;
      
      // Restaurant pickup tools
      case "check_pickup_availability":
        result = await executeCheckPickupAvailability(supabase, session, args);
        break;
      case "create_pickup_order":
        result = await executeCreatePickupOrder(supabase, session, args);
        break;
      case "cancel_order":
        result = await executeCancelOrder(supabase, session, args);
        break;
      
      // Restaurant dine-in tools
      case "check_table_availability":
        result = await executeCheckTableAvailability(supabase, session, args);
        break;
      case "create_reservation":
        result = await executeCreateReservation(supabase, session, args);
        break;
      case "cancel_reservation":
        result = await executeCancelReservation(supabase, session, args);
        break;
      
      // Common tools
      case "update_customer_language":
        result = await executeUpdateCustomerLanguage(supabase, session, args);
        break;
    }
  } catch (error) {
    console.error("[MediaStream] Tool execution error:", error);
    result = { success: false, message: "Sorry, there was an error processing that request." };
  }

  // Update the call tag in Calls tab based on what actually happened.
  // (We only set tags for booking actions; other intents remain 'other' unless handled elsewhere.)
  try {
    const callTypeByToolName: Record<string, string> = {
      // Salon/Service business actions
      create_booking: "new_booking",
      cancel_booking: "cancel",
      reschedule_booking: "reschedule",
      // Restaurant pickup/delivery actions
      create_pickup_order: "new_order",
      cancel_order: "cancel_order",
      // Restaurant dine-in actions
      create_reservation: "new_reservation",
      cancel_reservation: "cancel",
    };

    const nextCallType = result?.success ? callTypeByToolName[name] : undefined;

    if (nextCallType && session.callSid) {
      const { error: callLogUpdateError } = await supabase
        .from("calls_log")
        .update({ call_type: nextCallType })
        .eq("twilio_call_sid", session.callSid);

      if (callLogUpdateError) {
        console.warn("[MediaStream] Failed to update calls_log.call_type:", callLogUpdateError);
      } else {
        console.log(`[MediaStream] Updated calls_log.call_type => ${nextCallType}`);
      }
    }
  } catch (error) {
    console.warn("[MediaStream] Call tagging update failed:", error);
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
    session.openAiWs.send(
      JSON.stringify({
        type: "response.create",
        response: {
          modalities: ["audio", "text"],
        },
      })
    );
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
  const minNoticeHours = settings?.min_booking_notice_hours;
  
  // If policy is null/undefined/0, skip validation (toggle is off)
  if (!minNoticeHours) {
    console.log(`[MediaStream] Min booking notice check SKIPPED - policy is disabled (value: ${minNoticeHours})`);
    return { valid: true };
  }
  
  const now = new Date();
  const hoursUntilBooking = (requestedDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const minAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  
  console.log(`[MediaStream] Min booking notice check - Requested: ${requestedDateTime.toISOString()}, Now: ${now.toISOString()}, Hours until: ${hoursUntilBooking.toFixed(2)}, Required: ${minNoticeHours}h`);
  
  if (hoursUntilBooking < minNoticeHours) {
    console.log(`[MediaStream] Min booking notice FAILED - ${hoursUntilBooking.toFixed(2)}h < ${minNoticeHours}h required`);
    return { 
      valid: false, 
      message: `We need at least ${minNoticeHours} hours notice. The earliest I can book is ${formatTime(minAllowedTime)}.`,
      earliestTime: minAllowedTime
    };
  }
  
  console.log(`[MediaStream] Min booking notice PASSED`);
  return { valid: true };
}

function checkMaxAdvanceBooking(settings: BusinessSettings | null, requestedDate: Date): { valid: boolean; message?: string } {
  const maxDays = settings?.max_days_advance;
  
  // If policy is null/undefined/0, skip validation (toggle is off)
  if (!maxDays) {
    console.log(`[MediaStream] Max advance booking check SKIPPED - policy is disabled`);
    return { valid: true };
  }
  
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
  const minNoticeHours = settings?.min_cancellation_notice_hours;
  
  // If policy is null/undefined/0, skip validation (toggle is off)
  if (!minNoticeHours) {
    console.log(`[MediaStream] Min cancellation notice check SKIPPED - policy is disabled`);
    return { valid: true };
  }
  
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

function checkMinRescheduleNotice(settings: BusinessSettings | null, bookingStartTime: Date): { valid: boolean; message?: string } {
  const minNoticeHours = settings?.min_reschedule_notice_hours;
  
  // If policy is null/undefined/0, skip validation (toggle is off)
  if (!minNoticeHours) {
    console.log(`[MediaStream] Min reschedule notice check SKIPPED - policy is disabled`);
    return { valid: true };
  }
  
  const now = new Date();
  const minAllowedTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  
  if (bookingStartTime < minAllowedTime) {
    return { 
      valid: false, 
      message: `I'm sorry, this booking is too soon to reschedule. We require at least ${minNoticeHours} hours notice for reschedules.`
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
    // VALIDATE CUSTOMER NAME - Must have a real name, not "Unknown" or empty
    const customerName = (params.customer_name || "").trim();
    const invalidNames = ["unknown", "caller", "customer", "guest", "anonymous", "n/a", "na", "none", ""];
    if (!customerName || invalidNames.includes(customerName.toLowerCase())) {
      console.log("[MediaStream] Invalid customer name:", params.customer_name);
      return { 
        success: false, 
        message: "I just need to get your name for the booking. What name should I put it under?" 
      };
    }
    // Find staff - handle titles like "Mr adam", "Mr. John", etc.
    const searchName = (params.staff_name || "").toLowerCase().trim();
    const staff = session.staff.find(s => {
      const staffName = s.name.toLowerCase().trim();
      const staffTitle = (s.title || "").toLowerCase().trim();
      const fullName = `${staffTitle} ${staffName}`.trim();
      const fullNameDot = `${staffTitle}. ${staffName}`.trim();
      
      // Match if: searchName contains staff name OR staff name contains searchName 
      // OR full name matches (with or without dot after title)
      return staffName.includes(searchName) || 
             searchName.includes(staffName) || 
             fullName.includes(searchName) ||
             searchName.includes(fullName) ||
             fullNameDot.includes(searchName) ||
             searchName.includes(fullNameDot) ||
             staffName === searchName;
    });
    
    if (!staff) {
      console.log("[MediaStream] Staff not found. Searched for:", searchName, "Available staff:", session.staff.map(s => ({ name: s.name, title: s.title })));
      return { success: false, message: `Could not find staff member ${params.staff_name}` };
    }
    
    console.log("[MediaStream] Found staff:", staff.name, "with title:", staff.title);

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

    // Extract category hints from the request (e.g., "men's haircut", "kids shape-up", "women's cut")
    const categoryHints: string[] = [];
    const categoryPatterns = [
      { pattern: /\b(men'?s?|man'?s?|male|gents?)\b/i, category: "men" },
      { pattern: /\b(women'?s?|woman'?s?|female|ladies?)\b/i, category: "women" },
      { pattern: /\b(kids?|child|children'?s?|boys?|girls?)\b/i, category: "kids" },
      { pattern: /\b(adult'?s?)\b/i, category: "adult" },
      { pattern: /\b(unisex)\b/i, category: "unisex" },
    ];
    
    for (const { pattern, category } of categoryPatterns) {
      if (pattern.test(requestedService)) {
        categoryHints.push(category);
      }
    }
    
    console.log("[MediaStream] Service request:", requestedService, "Category hints:", categoryHints);

    // 1) Prefer exact match by normalized name
    let serviceCandidates = session.services.filter(s => normalize(s.name) === requestedNorm);

    // 2) Fallback to fuzzy match, but NEVER auto-pick if ambiguous
    if (serviceCandidates.length === 0) {
      serviceCandidates = session.services.filter(s => {
        const n = normalize(s.name);
        return n.includes(requestedNorm) || requestedNorm.includes(n);
      });
    }
    
    // 3) If still no match and we have category hints, try matching without the category word
    if (serviceCandidates.length === 0 && categoryHints.length > 0) {
      // Remove category words from the request and try again
      let cleanedRequest = requestedNorm;
      for (const { pattern } of categoryPatterns) {
        cleanedRequest = cleanedRequest.replace(pattern, "").trim();
      }
      cleanedRequest = normalize(cleanedRequest);
      
      if (cleanedRequest) {
        serviceCandidates = session.services.filter(s => {
          const n = normalize(s.name);
          return n.includes(cleanedRequest) || cleanedRequest.includes(n);
        });
      }
    }
    
    // 4) If we have multiple candidates and category hints, filter by category
    if (serviceCandidates.length > 1 && categoryHints.length > 0) {
      const filteredByCategory = serviceCandidates.filter(s => {
        const serviceCategory = normalize(s.category || "");
        return categoryHints.some(hint => 
          serviceCategory.includes(hint) || 
          normalize(s.name).includes(hint)
        );
      });
      
      // Only use filtered results if we found matches
      if (filteredByCategory.length > 0) {
        console.log("[MediaStream] Filtered by category:", filteredByCategory.map(s => `${s.name} (${s.category})`));
        serviceCandidates = filteredByCategory;
      }
    }

    if (serviceCandidates.length === 0) {
      return { success: false, message: `Could not find service ${requestedService}` };
    }

    if (serviceCandidates.length > 1) {
      // Create a natural-sounding question based on the categories - WITHOUT prices (only mention price if customer asks)
      const categories = [...new Set(serviceCandidates.map(s => s.category).filter(Boolean))];
      let clarificationMessage: string;
      
      if (categories.length > 1 && categories.every(c => ["men", "women", "kids", "unisex", "adult"].includes(normalize(c || "")))) {
        // If all categories are demographic-based, ask naturally
        clarificationMessage = `Is that for ${categories.map(c => c?.toLowerCase()).join(", or ")}?`;
      } else if (categories.length > 1) {
        // Different categories but not all demographic - still ask by category
        clarificationMessage = `Just to confirm, is that for ${categories.map(c => c?.toLowerCase()).join(" or ")}?`;
      } else {
        // Same category or no categories - list service names with any distinguishing info (but not price)
        const options = serviceCandidates.slice(0, 4).map(s => {
          const categoryLabel = s.category ? ` (${s.category})` : "";
          return `${s.name}${categoryLabel}`;
        });
        const more = serviceCandidates.length > 4 ? ` (and ${serviceCandidates.length - 4} more)` : "";
        clarificationMessage = `Just to confirm, which one: ${options.join(", ")}${more}?`;
      }
      
      console.log("[MediaStream] Ambiguous service name:", requestedService, "candidates:", serviceCandidates.map(s => `${s.name} (${s.category})`));
      return {
        success: false,
        needs_clarification: true,
        message: clarificationMessage,
      };
    }

    const service = serviceCandidates[0];

    // Check if staff is assigned to this service - THIS IS A HARD BLOCK
    const isAssigned = isStaffAssignedToService(session.staffServices, staff.id, service.id);
    console.log(`[MediaStream] Staff-service check: staff=${staff.name} (${staff.id}), service=${service.name} (${service.id}), isAssigned=${isAssigned}`);
    console.log(`[MediaStream] staffServices count: ${session.staffServices.length}, entries for this staff:`, session.staffServices.filter(ss => ss.staff_id === staff.id));
    
    if (!isAssigned) {
      // Find who CAN do this service
      const assignedStaff = session.staffServices
        .filter(ss => ss.service_id === service.id)
        .map(ss => session.staff.find(s => s.id === ss.staff_id)?.name)
        .filter(Boolean);
      
      console.log(`[MediaStream] BLOCKED: ${staff.name} cannot do ${service.name}. Staff who can: ${assignedStaff.join(", ") || "none"}`);
      
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

    // Generate deposit payment link if service requires deposit
    if (service.deposit_required && service.deposit_amount && service.deposit_amount > 0) {
      try {
        console.log("[MediaStream] Generating deposit link for booking:", booking.id, "service requires deposit:", service.deposit_amount);
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const depositResponse = await fetch(`${supabaseUrl}/functions/v1/stripe-create-deposit-link`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ bookingId: booking.id }),
        });
        const depositResult = await depositResponse.json();
        if (depositResponse.ok && depositResult.url) {
          console.log("[MediaStream] Deposit link generated successfully:", depositResult.url);
        } else {
          console.warn("[MediaStream] Deposit link generation returned error:", depositResult.error || depositResult);
        }
      } catch (depositError) {
        console.error("[MediaStream] Failed to generate deposit link:", depositError);
      }
    }

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

    // Check reschedule notice policy against original booking time
    const originalStartTime = new Date(booking.start_time);
    const rescheduleCheck = checkMinRescheduleNotice(session.businessSettings, originalStartTime);
    if (!rescheduleCheck.valid) {
      return { success: false, message: rescheduleCheck.message };
    }

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
    const fallbackDuration = params.duration_minutes || 30;

    // If service_name is provided, filter staff to those assigned to that service and use the service duration
    const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const requestedServiceName = (params.service_name || "").toString().trim();

    let resolvedService: Service | null = null;
    let duration = fallbackDuration;

    if (requestedServiceName) {
      const requestedNorm = normalize(requestedServiceName);

      let serviceCandidates = session.services.filter((s) => normalize(s.name) === requestedNorm);
      if (serviceCandidates.length === 0) {
        serviceCandidates = session.services.filter((s) => {
          const n = normalize(s.name);
          return n.includes(requestedNorm) || requestedNorm.includes(n);
        });
      }

      if (serviceCandidates.length === 0) {
        return { success: false, message: `Could not find service ${requestedServiceName}.` };
      }

      if (serviceCandidates.length > 1) {
        const options = serviceCandidates.slice(0, 6).map((s) => s.name).join(", ");
        const more = serviceCandidates.length > 6 ? ` (and ${serviceCandidates.length - 6} more)` : "";
        console.log("[MediaStream] Ambiguous service name in check_availability:", requestedServiceName, "candidates:", serviceCandidates.map((s) => s.name));
        return {
          success: false,
          needs_clarification: true,
          message: `Just to confirm, which one do you mean: ${options}${more}?`,
        };
      }

      resolvedService = serviceCandidates[0];
      duration = resolvedService.duration_minutes || duration;
      console.log(`[MediaStream] check_availability resolved service='${resolvedService.name}' duration=${duration}`);
    }

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
      const staff = session.staff.find((s) => s.name.toLowerCase().includes(params.staff_name.toLowerCase()));
      if (staff) {
        targetStaffId = staff.id;
        targetStaffName = staff.name;
      }
    }

    // Base set: AI-enabled staff are bookable
    let bookableStaff = session.staff.filter((s) => s.ai_enabled);

    // If we know the service, only consider staff assigned to that service
    if (resolvedService) {
      bookableStaff = bookableStaff.filter((s) => isStaffAssignedToService(session.staffServices, s.id, resolvedService!.id));
      console.log(`[MediaStream] check_availability filtered staff for service='${resolvedService.name}': eligible=${bookableStaff.length}`);

      // If customer asked for a specific staff member who can't do the service, fail fast
      if (targetStaffId && !bookableStaff.some((s) => s.id === targetStaffId)) {
        const assignedStaff = session.staffServices
          .filter((ss) => ss.service_id === resolvedService!.id)
          .map((ss) => session.staff.find((s) => s.id === ss.staff_id)?.name)
          .filter(Boolean);

        return {
          success: false,
          service_mismatch: true,
          message: `${targetStaffName || "That staff member"} doesn't do ${resolvedService.name}. That service is available with ${assignedStaff.join(" or ") || "another staff member"}.`,
        };
      }
    }

    if (bookableStaff.length === 0) {
      return {
        success: false,
        message: resolvedService
          ? `Sorry, there are no staff members available for booking ${resolvedService.name} at the moment.`
          : "Sorry, there are no staff members available for booking at the moment.",
      };
    }

    // ----------------------------------------------------------------------
    // EXACT TIME MODE: customer asked "who is available at 5pm" etc.
    // ----------------------------------------------------------------------
    if (params.time) {
      const time = String(params.time).slice(0, 5); // HH:MM

      // Validate opening hours for the specific time
      const hoursCheck = isTimeWithinOpeningHours(session.openingHours, requestedDate, time);
      if (!hoursCheck.valid) {
        return { success: false, message: hoursCheck.message };
      }

      const requestedStart = new Date(`${params.date}T${time}:00`);
      const requestedEnd = new Date(requestedStart.getTime() + duration * 60000);

      // Validate min notice
      const noticeCheck = checkMinBookingNotice(session.businessSettings, requestedStart);
      if (!noticeCheck.valid) {
        return { success: false, message: noticeCheck.message, too_soon: true };
      }

      // Ensure end time is before close
      const openTime = businessHours.openTime!;
      const closeTime = businessHours.closeTime!;
      const [closeHour, closeMin] = closeTime.split(":").map(Number);
      const closeTotal = closeHour * 60 + closeMin;
      const endTotal = requestedEnd.getHours() * 60 + requestedEnd.getMinutes();
      if (endTotal > closeTotal) {
        return {
          success: false,
          message: `That time would run past closing. We close at ${closeTime}.`,
        };
      }

      const staffToCheck = targetStaffId
        ? bookableStaff.filter((s) => s.id === targetStaffId)
        : bookableStaff;

      const availableStaff: string[] = [];
      const unavailableStaff: { name: string; reason: "time_off" | "booked" }[] = [];

      for (const staff of staffToCheck) {
        const staffBookings = allBookings.filter((b: any) => b.staff_id === staff.id);
        const hasConflict = staffBookings.some((b: any) => {
          const bStart = new Date(b.start_time);
          const bEnd = new Date(b.end_time);
          return requestedStart < bEnd && requestedEnd > bStart;
        });

        const timeOffCheck = isStaffOnTimeOff(session.staffTimeOff, staff.id, requestedStart, requestedEnd);

        if (!hasConflict && !timeOffCheck.onLeave) {
          availableStaff.push(staff.name);
        } else {
          unavailableStaff.push({
            name: staff.name,
            reason: timeOffCheck.onLeave ? "time_off" : "booked",
          });
        }
      }

      if (targetStaffId) {
        if (availableStaff.length > 0) {
          return {
            success: true,
            available: true,
            available_staff: availableStaff,
            time: time,
            date: params.date,
            message: `Yes — ${targetStaffName} is available at ${time}.`,
          };
        }

        const reason = unavailableStaff[0]?.reason === "time_off" ? "on leave" : "already booked";
        return {
          success: true,
          available: false,
          available_staff: [],
          unavailable_staff: unavailableStaff,
          time: time,
          date: params.date,
          message: `No — ${targetStaffName} is ${reason} at ${time}.`,
        };
      }

      if (availableStaff.length === 0) {
        return {
          success: true,
          available: false,
          available_staff: [],
          unavailable_staff: unavailableStaff,
          time: time,
          date: params.date,
          message: `No one is available at ${time}. Would you like a different time?`,
        };
      }

      const names = availableStaff.slice(0, 5).join(", ");
      const more = availableStaff.length > 5 ? ` (and ${availableStaff.length - 5} more)` : "";
      return {
        success: true,
        available: true,
        available_staff: availableStaff,
        unavailable_staff: unavailableStaff,
        time: time,
        date: params.date,
        message: `At ${time}, ${names} ${availableStaff.length === 1 ? "is" : "are"} available${more}.`,
      };
    }

    // ----------------------------------------------------------------------
    // SLOT MODE: customer asked general openings for a date
    // ----------------------------------------------------------------------

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
          // Check if ANY eligible staff is available at this slot
          for (const staff of bookableStaff) {
            const staffBookings = allBookings.filter((b: any) => b.staff_id === staff.id);
            const hasConflict = staffBookings.some((b: any) => {
              const bStart = new Date(b.start_time);
              const bEnd = new Date(b.end_time);
              return slotStart < bEnd && slotEnd > bStart;
            });

            const timeOffCheck = isStaffOnTimeOff(session.staffTimeOff, staff.id, slotStart, slotEnd);

            if (!hasConflict && !timeOffCheck.onLeave) {
              slotIsAvailable = true;
              break; // At least one eligible staff is available, slot is open
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
        no_slots: true,
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
    const displaySlots = sortedSlots.slice(0, 8).map((t) => {
      const [h, m] = t.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
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
      staff: targetStaffName || null,
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

async function executeUpdateCustomerName(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Updating customer name:", params);
  
  try {
    const { new_name } = params;
    
    if (!new_name || new_name.trim().length < 1) {
      return { success: false, message: "I didn't catch that name. Could you tell me again?" };
    }
    
    const trimmedName = new_name.trim();
    const normalizedPhone = session.callerPhone.replace(/\D/g, "").slice(-10);
    
    // Find customer by phone
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name")
      .eq("business_id", session.businessId)
      .or(`phone.ilike.%${normalizedPhone}%,phone.eq.${session.callerPhone}`)
      .limit(1)
      .maybeSingle();
    
    if (customer) {
      console.log(`[MediaStream] Updating customer name from "${customer.name}" to "${trimmedName}"`);
      
      await supabase
        .from("customers")
        .update({ name: trimmedName, updated_at: new Date().toISOString() })
        .eq("id", customer.id);
      
      // Update session so AI uses the correct name for the rest of the call
      session.callerName = trimmedName;
      
      return { 
        success: true, 
        message: `No problem! I've updated your name to ${trimmedName}.`
      };
    } else {
      // No existing customer record, just update session for this call
      session.callerName = trimmedName;
      return { 
        success: true, 
        message: `Got it, ${trimmedName}! I'll use that name.`
      };
    }
  } catch (error) {
    console.error("[MediaStream] Update name error:", error);
    return { success: false, message: "Sorry, I couldn't update that. No worries, what can I help you with?" };
  }
}

async function executeEndCall(session: StreamSession, params: any): Promise<any> {
  const callDurationSeconds = Math.round((Date.now() - session.callStartTime) / 1000);
  
  console.log("[MediaStream] End call requested:", {
    reason: params.reason,
    interactionCount: session.interactionCount,
    callDurationSeconds,
    callerPhone: session.callerPhone,
  });
  
  // Check minimum interaction requirements to prevent premature endings
  const MIN_INTERACTIONS = 2;
  const MIN_CALL_DURATION_SECONDS = 15;
  
  if (session.interactionCount < MIN_INTERACTIONS) {
    console.log("[MediaStream] BLOCKED end_call - not enough interactions:", session.interactionCount);
    return { 
      success: false, 
      message: `Cannot end call yet - only ${session.interactionCount} interactions so far. Ask if there's anything else you can help with.`
    };
  }
  
  if (callDurationSeconds < MIN_CALL_DURATION_SECONDS) {
    console.log("[MediaStream] BLOCKED end_call - call too short:", callDurationSeconds, "seconds");
    return { 
      success: false, 
      message: `Cannot end call yet - only ${callDurationSeconds} seconds into the call. Make sure the customer has actually said goodbye.`
    };
  }
  
  console.log("[MediaStream] Proceeding with end_call after validation");
  
  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !session.callSid) {
      // Wait for any remaining audio to finish, then close
      await new Promise(resolve => setTimeout(resolve, 2500));
      if (session.openAiWs?.readyState === WebSocket.OPEN) {
        session.openAiWs.close();
      }
      return { success: true, message: "Call ended." };
    }
    
    // IMPORTANT: Wait for audio to finish playing before hanging up
    // The AI may still be streaming its goodbye message
    console.log("[MediaStream] Waiting for audio to finish before hangup...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Build TwiML to hang up gracefully with a pause for final audio
    const hangupTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="2"/>
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
    
    // Delay closing OpenAI to allow any final audio to complete
    setTimeout(() => {
      if (session.openAiWs?.readyState === WebSocket.OPEN) {
        session.openAiWs.close();
      }
    }, 1000);
    
    console.log("[MediaStream] Call ended successfully after", callDurationSeconds, "seconds");
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
    // Match staff by name - check both directions and with title
    const searchName = params.staff_name.toLowerCase().trim();
    const staffMember = session.staff.find(s => {
      const staffName = s.name.toLowerCase().trim();
      const fullName = s.title ? `${s.title} ${s.name}`.toLowerCase().trim() : staffName;
      return searchName.includes(staffName) || staffName.includes(searchName) || fullName === searchName;
    });
    
    console.log("[MediaStream] Staff search for:", searchName, "Found:", staffMember?.name || "none");

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
          status: "transfer_pending",
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

    // Build TwiML for the transfer - use business Twilio number as callerId (required by Twilio)
    // The callerId must be a verified number or the Twilio number associated with the account
    const callerId = session.twilioPhoneNumber || "";
    const callerIdAttr = callerId ? ` callerId="${escapeXml(callerId)}"` : "";
    
    const transferTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">Please hold while I transfer you.</Say>
  <Dial${callerIdAttr} timeout="30">
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

// Execute stop recording - called when caller opts out of being recorded
async function executeStopRecording(
  session: StreamSession,
  params: { reason?: string }
): Promise<{ success: boolean; message: string }> {
  console.log("[MediaStream] Stopping recording for call:", session.callSid, "reason:", params.reason);
  
  const success = await stopTwilioCallRecording(session.callSid);
  
  if (success) {
    console.log("[MediaStream] Recording stopped successfully");
    return { 
      success: true, 
      message: "Recording has been stopped. The rest of this call will not be recorded. How can I help you?" 
    };
  } else {
    console.error("[MediaStream] Failed to stop recording");
    return { 
      success: false, 
      message: "I had trouble stopping the recording, but I'll note your preference. How can I help you?" 
    };
  }
}

// ============================================================================
// RESTAURANT TOOL IMPLEMENTATIONS
// ============================================================================

async function executeCheckPickupAvailability(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Checking pickup availability:", params);
  
  const pickupTime = params.pickup_time;
  const avgPrepTime = session.restaurantSettings?.averagePrepTime || 30;
  
  // Parse the requested pickup time
  const now = new Date();
  const [hours, minutes] = pickupTime.split(":").map(Number);
  const requestedTime = new Date(now);
  requestedTime.setHours(hours, minutes, 0, 0);
  
  // If requested time is in the past, assume tomorrow
  if (requestedTime < now) {
    requestedTime.setDate(requestedTime.getDate() + 1);
  }
  
  // Check if business is open
  const dayOfWeek = requestedTime.getDay();
  const businessHours = session.openingHours.find(h => h.day_of_week === dayOfWeek);
  
  if (!businessHours || businessHours.is_closed) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return { 
      success: false, 
      available: false,
      message: `We're closed on ${dayNames[dayOfWeek]}. When would you like to pick up instead?` 
    };
  }
  
  // Check if time is within opening hours
  if (businessHours.open_time && pickupTime < businessHours.open_time.slice(0, 5)) {
    return { 
      success: true, 
      available: false,
      message: `That's before we open. We open at ${businessHours.open_time.slice(0, 5)}. What time works for you?` 
    };
  }
  
  if (businessHours.close_time && pickupTime >= businessHours.close_time.slice(0, 5)) {
    return { 
      success: true, 
      available: false,
      message: `That's after we close. We close at ${businessHours.close_time.slice(0, 5)}. What time works for you?` 
    };
  }
  
  // Check minimum notice (prep time)
  const minutesUntilPickup = (requestedTime.getTime() - now.getTime()) / (1000 * 60);
  if (minutesUntilPickup < avgPrepTime) {
    const earliestTime = new Date(now.getTime() + avgPrepTime * 60 * 1000);
    const earliestTimeStr = formatTime(earliestTime);
    return { 
      success: true, 
      available: false,
      message: `We need about ${avgPrepTime} minutes to prepare your order. The earliest pickup would be around ${earliestTimeStr}. Does that work?` 
    };
  }
  
  return { 
    success: true, 
    available: true,
    message: `${pickupTime} works great! Your order will be ready for pickup.`,
    estimated_ready_time: pickupTime
  };
}

async function executeCreatePickupOrder(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Creating pickup order:", params);
  
  const { customer_name, customer_phone, customer_email, items, pickup_time, special_requests } = params;
  
  // Validate customer name
  if (!customer_name || customer_name.trim().toLowerCase() === "unknown") {
    return { success: false, message: "I just need your name for the order. What name should I put it under?" };
  }
  
  // Validate items
  if (!items || items.length === 0) {
    return { success: false, message: "What would you like to order?" };
  }
  
  // Calculate order total and validate items against menu
  let orderTotal = 0;
  const validatedItems: any[] = [];
  const currency = session.businessSettings?.currency || "GBP";
  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  
  for (const item of items) {
    // Find the menu item
    const menuItem = session.menuItems.find((mi: any) => 
      mi.name.toLowerCase().includes(item.name?.toLowerCase()) || 
      item.name?.toLowerCase().includes(mi.name.toLowerCase())
    );
    
    if (!menuItem) {
      return { 
        success: false, 
        message: `I couldn't find "${item.name}" on the menu. Would you like something else?` 
      };
    }
    
    const quantity = item.quantity || 1;
    let itemPrice = menuItem.price;
    
    // Handle size variants
    if (menuItem.sizes && menuItem.sizes.length > 0 && item.size) {
      const selectedSize = menuItem.sizes.find((s: any) => 
        s.name.toLowerCase() === item.size?.toLowerCase()
      );
      if (selectedSize) {
        itemPrice = selectedSize.price;
      }
    } else if (menuItem.sizes && menuItem.sizes.length > 0 && !item.size) {
      // If item has sizes but no size was specified, ask
      const sizeNames = menuItem.sizes.map((s: any) => s.name).join(" or ");
      return {
        success: false,
        message: `What size would you like for the ${menuItem.name}? We have ${sizeNames}.`
      };
    }
    
    orderTotal += itemPrice * quantity;
    validatedItems.push({
      name: menuItem.name,
      quantity,
      unit_price: itemPrice,
      notes: item.notes || null,
      size: item.size || null,
    });
  }
  
  // Check minimum order
  const minimumOrder = session.restaurantSettings?.minimumOrderAmount;
  if (minimumOrder && orderTotal < minimumOrder) {
    return {
      success: false,
      message: `Our minimum order is ${currencySymbol}${minimumOrder}. Your current total is ${currencySymbol}${orderTotal.toFixed(2)}. Would you like to add anything else?`
    };
  }
  
  // Normalize phone number
  let resolvedPhone = customer_phone;
  if (!resolvedPhone || resolvedPhone === "unknown") {
    resolvedPhone = session.callerPhone;
  }
  
  // Generate random 4-digit order code (1000-9999)
  const generateOrderCode = (): string => {
    return String(Math.floor(1000 + Math.random() * 9000));
  };
  const orderNumber = generateOrderCode();
  
  // Calculate pickup datetime
  const now = new Date();
  const [hours, minutes] = pickup_time.split(":").map(Number);
  const pickupDateTime = new Date(now);
  pickupDateTime.setHours(hours, minutes, 0, 0);
  if (pickupDateTime < now) {
    pickupDateTime.setDate(pickupDateTime.getDate() + 1);
  }
  
  // Create or update customer record for marketing and returning customer recognition
  try {
    // Normalize phone for matching
    const phoneDigits = resolvedPhone.replace(/\D/g, "").slice(-10);
    
    // Check if customer exists by phone
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("id, total_visits")
      .eq("business_id", session.businessId)
      .or(`phone.ilike.%${phoneDigits}%`);
    
    if (existingCustomers && existingCustomers.length > 0) {
      // Update existing customer - increment visits
      const existingCustomer = existingCustomers[0];
      await supabase
        .from("customers")
        .update({
          name: customer_name,
          total_visits: (existingCustomer.total_visits || 0) + 1,
          updated_at: new Date().toISOString(),
          ...(customer_email && { email: customer_email }),
        })
        .eq("id", existingCustomer.id);
      console.log("[MediaStream] Updated existing customer:", existingCustomer.id);
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({
          business_id: session.businessId,
          name: customer_name,
          phone: resolvedPhone,
          email: customer_email || null,
          first_visit_date: new Date().toISOString().split("T")[0],
          total_visits: 1,
          marketing_consent: false, // Can be updated later
        })
        .select("id")
        .single();
      
      if (customerError) {
        console.warn("[MediaStream] Failed to create customer record:", customerError);
      } else {
        console.log("[MediaStream] Created new customer:", newCustomer.id);
      }
    }
  } catch (customerErr) {
    console.warn("[MediaStream] Customer record error (non-blocking):", customerErr);
    // Don't fail the order if customer creation fails
  }
  
  // Create the order
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      business_id: session.businessId,
      order_number: orderNumber,
      customer_name,
      customer_phone: resolvedPhone,
      customer_email: customer_email || null,
      items: validatedItems,
      total: orderTotal,
      subtotal: orderTotal,
      order_type: "pickup",
      pickup_time: pickupDateTime.toISOString(),
      notes: special_requests || null,
      status: "pending",
    })
    .select()
    .single();
  
  if (error) {
    console.error("[MediaStream] Order creation error:", error);
    return { success: false, message: "Sorry, there was an error creating your order. Please try again." };
  }
  
  console.log("[MediaStream] Order created:", order.id);
  
  // Send SMS confirmation
  try {
    const smsResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-order-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        businessId: session.businessId,
        orderId: order.id,
        type: "confirmation",
      }),
    });
    
    if (smsResponse.ok) {
      console.log("[MediaStream] SMS confirmation sent for order:", order.id);
    } else {
      console.warn("[MediaStream] Failed to send SMS confirmation:", await smsResponse.text());
    }
  } catch (smsError) {
    console.warn("[MediaStream] Error sending SMS confirmation:", smsError);
  }
  
  // Format confirmation message
  const itemsList = validatedItems.map(i => `${i.quantity}x ${i.name}${i.size ? ` (${i.size})` : ""}`).join(", ");
  const pickupTimeFormatted = formatTime(pickupDateTime);

  // Mark tool success so we can safely allow verbal confirmation.
  session.lastSuccessfulPickupOrderAt = Date.now();
  session.lastPickupOrderNumber = order.order_number;
  session.lastPickupOrderId = order.id;
  
  return {
    success: true,
    order_id: order.id,
    order_number: order.order_number,
    total: orderTotal,
    message: `Your order is confirmed! That's ${itemsList} for ${currencySymbol}${orderTotal.toFixed(2)}. Your order number is ${order.order_number}. It will be ready for pickup at ${pickupTimeFormatted}. You'll receive a text confirmation shortly.`
  };
}

async function executeCancelOrder(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Cancelling order:", params);
  
  const { order_code, customer_name, reason } = params;
  
  // Find the order
  let query = supabase
    .from("orders")
    .select("*")
    .eq("business_id", session.businessId)
    .neq("status", "cancelled");
  
  if (order_code) {
    query = query.eq("order_number", order_code);
  } else if (customer_name) {
    query = query.ilike("customer_name", `%${customer_name}%`);
  } else {
    // Try to find by caller phone
    query = query.ilike("customer_phone", `%${session.callerPhone.slice(-10)}%`);
  }
  
  const { data: orders, error } = await query.order("created_at", { ascending: false }).limit(5);
  
  if (error || !orders || orders.length === 0) {
    return { success: false, message: "I couldn't find that order. Can you give me your order number or name?" };
  }
  
  if (orders.length > 1) {
    const orderList = orders.map((o: any) => `${o.order_number} (${o.customer_name})`).join(", ");
    return { success: false, message: `I found multiple orders: ${orderList}. Which one would you like to cancel?` };
  }
  
  const order = orders[0];
  
  // Check refund policy
  const refundWindowHours = session.restaurantSettings?.refundWindowHours || 2;
  const pickupTime = new Date(order.pickup_time);
  const now = new Date();
  const hoursUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  let refundMessage = "";
  if (hoursUntilPickup < refundWindowHours) {
    const refundPolicy = session.restaurantSettings?.refundPolicy || "full_refund";
    const refundPolicies: Record<string, string> = {
      full_refund: "You'll receive a full refund",
      partial_refund: "You'll receive a 50% refund as it's within our cancellation window",
      store_credit: "You'll receive store credit",
      no_refund: "Unfortunately no refund is available as it's within our cancellation window",
    };
    refundMessage = `. ${refundPolicies[refundPolicy]}`;
  } else {
    refundMessage = ". You'll receive a full refund";
  }
  
  // Cancel the order
  const { error: updateError } = await supabase
    .from("orders")
    .update({ 
      status: "cancelled", 
      cancelled_at: new Date().toISOString(),
      notes: order.notes ? `${order.notes}\nCancellation reason: ${reason || "Customer requested"}` : `Cancellation reason: ${reason || "Customer requested"}`
    })
    .eq("id", order.id);
  
  if (updateError) {
    console.error("[MediaStream] Order cancellation error:", updateError);
    return { success: false, message: "Sorry, there was an error cancelling your order. Please try again." };
  }
  
  return { 
    success: true, 
    message: `Your order ${order.order_number} has been cancelled${refundMessage}. Is there anything else I can help you with?`
  };
}

async function executeCheckTableAvailability(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Checking table availability:", params);
  
  const { date, time, party_size, seating_preference } = params;
  
  // Parse date and time
  const reservationDateTime = new Date(`${date}T${time}:00`);
  const dayOfWeek = reservationDateTime.getDay();
  
  // Check if business is open
  const businessHours = session.openingHours.find(h => h.day_of_week === dayOfWeek);
  if (!businessHours || businessHours.is_closed) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return { 
      success: false, 
      available: false,
      message: `We're closed on ${dayNames[dayOfWeek]}. When would you like to dine instead?` 
    };
  }
  
  // Find suitable tables
  let availableTables = session.tables.filter((t: any) => t.capacity >= party_size);
  
  // Filter by seating preference if specified
  if (seating_preference && seating_preference !== "any") {
    const preferredTables = availableTables.filter((t: any) => 
      t.location?.toLowerCase().includes(seating_preference.toLowerCase())
    );
    if (preferredTables.length > 0) {
      availableTables = preferredTables;
    }
  }
  
  if (availableTables.length === 0) {
    return { 
      success: true, 
      available: false,
      message: `We don't have a table that fits ${party_size} guests. What's the maximum you could split across tables?` 
    };
  }
  
  // Check for existing reservations at that time
  const reservationEnd = new Date(reservationDateTime.getTime() + 90 * 60 * 1000); // Assume 90 min dining time
  
  const { data: existingReservations } = await supabase
    .from("reservations")
    .select("table_id")
    .eq("business_id", session.businessId)
    .neq("status", "cancelled")
    .lt("reservation_time", reservationEnd.toISOString())
    .gt("reservation_time", new Date(reservationDateTime.getTime() - 90 * 60 * 1000).toISOString());
  
  const bookedTableIds = (existingReservations || []).map((r: any) => r.table_id);
  const freeeTables = availableTables.filter((t: any) => !bookedTableIds.includes(t.id));
  
  if (freeeTables.length === 0) {
    // Suggest alternative times
    return { 
      success: true, 
      available: false,
      message: `We're fully booked at ${time} for a party of ${party_size}. Would you like to try a different time?` 
    };
  }
  
  return { 
    success: true, 
    available: true,
    tables_available: freeeTables.length,
    message: `Yes, we have a table available for ${party_size} at ${time} on ${date}. Would you like to book it?` 
  };
}

async function executeCreateReservation(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Creating reservation:", params);
  
  const { customer_name, customer_phone, customer_email, date, time, party_size, seating_preference, special_requests, special_occasion } = params;
  
  // Validate customer name
  if (!customer_name || customer_name.trim().toLowerCase() === "unknown") {
    return { success: false, message: "I just need your name for the reservation. What name should I put it under?" };
  }
  
  // Parse date and time
  const reservationDateTime = new Date(`${date}T${time}:00`);
  
  // Find a suitable table
  let availableTables = session.tables.filter((t: any) => t.capacity >= party_size);
  
  if (seating_preference && seating_preference !== "any") {
    const preferredTables = availableTables.filter((t: any) => 
      t.location?.toLowerCase().includes(seating_preference.toLowerCase())
    );
    if (preferredTables.length > 0) {
      availableTables = preferredTables;
    }
  }
  
  // Check for conflicts and find a free table
  const reservationEnd = new Date(reservationDateTime.getTime() + 90 * 60 * 1000);
  const { data: existingReservations } = await supabase
    .from("reservations")
    .select("table_id")
    .eq("business_id", session.businessId)
    .neq("status", "cancelled")
    .lt("reservation_time", reservationEnd.toISOString())
    .gt("reservation_time", new Date(reservationDateTime.getTime() - 90 * 60 * 1000).toISOString());
  
  const bookedTableIds = (existingReservations || []).map((r: any) => r.table_id);
  const freeeTables = availableTables.filter((t: any) => !bookedTableIds.includes(t.id));
  
  if (freeeTables.length === 0) {
    return { 
      success: false, 
      message: `Sorry, we're fully booked at ${time} for a party of ${party_size}. Would you like to try a different time?` 
    };
  }
  
  const selectedTable = freeeTables[0];
  
  // Normalize phone
  let resolvedPhone = customer_phone;
  if (!resolvedPhone || resolvedPhone === "unknown") {
    resolvedPhone = session.callerPhone;
  }
  
  // Create reservation
  const notes = [
    special_requests,
    special_occasion ? `Special occasion: ${special_occasion}` : null,
    seating_preference ? `Seating preference: ${seating_preference}` : null,
  ].filter(Boolean).join(". ");
  
  const { data: reservation, error } = await supabase
    .from("reservations")
    .insert({
      business_id: session.businessId,
      customer_name,
      customer_phone: resolvedPhone,
      customer_email: customer_email || null,
      party_size,
      reservation_time: reservationDateTime.toISOString(),
      table_id: selectedTable.id,
      notes: notes || null,
      special_requests: special_requests || null,
      status: "confirmed",
    })
    .select()
    .single();
  
  if (error) {
    console.error("[MediaStream] Reservation creation error:", error);
    return { success: false, message: "Sorry, there was an error creating your reservation. Please try again." };
  }
  
  console.log("[MediaStream] Reservation created:", reservation.id);
  
  const dateFormatted = reservationDateTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const timeFormatted = formatTime(reservationDateTime);
  
  return {
    success: true,
    message: `Your table for ${party_size} is booked for ${dateFormatted} at ${timeFormatted}. We've reserved ${selectedTable.table_number}${selectedTable.location ? ` in the ${selectedTable.location} area` : ""}. See you then!`
  };
}

async function executeCancelReservation(supabase: any, session: StreamSession, params: any): Promise<any> {
  console.log("[MediaStream] Cancelling reservation:", params);
  
  const { reservation_code, customer_name, reason } = params;
  
  // Find the reservation
  let query = supabase
    .from("reservations")
    .select("*")
    .eq("business_id", session.businessId)
    .neq("status", "cancelled")
    .gte("reservation_time", new Date().toISOString());
  
  if (customer_name) {
    query = query.ilike("customer_name", `%${customer_name}%`);
  } else {
    // Try to find by caller phone
    query = query.ilike("customer_phone", `%${session.callerPhone.slice(-10)}%`);
  }
  
  const { data: reservations, error } = await query.order("reservation_time").limit(5);
  
  if (error || !reservations || reservations.length === 0) {
    return { success: false, message: "I couldn't find your reservation. Can you give me the name it's under?" };
  }
  
  if (reservations.length > 1) {
    const resList = reservations.map((r: any) => {
      const dt = new Date(r.reservation_time);
      return `${r.customer_name} on ${dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at ${formatTime(dt)}`;
    }).join(", ");
    return { success: false, message: `I found multiple reservations: ${resList}. Which one would you like to cancel?` };
  }
  
  const reservation = reservations[0];
  
  // Cancel the reservation
  const { error: updateError } = await supabase
    .from("reservations")
    .update({ 
      status: "cancelled", 
      cancelled_at: new Date().toISOString(),
      notes: reservation.notes ? `${reservation.notes}\nCancellation reason: ${reason || "Customer requested"}` : `Cancellation reason: ${reason || "Customer requested"}`
    })
    .eq("id", reservation.id);
  
  if (updateError) {
    console.error("[MediaStream] Reservation cancellation error:", updateError);
    return { success: false, message: "Sorry, there was an error cancelling your reservation. Please try again." };
  }
  
  const resDateTime = new Date(reservation.reservation_time);
  
  return { 
    success: true, 
    message: `Your reservation for ${reservation.party_size} on ${resDateTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} at ${formatTime(resDateTime)} has been cancelled. Is there anything else I can help you with?`
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatTime(date: Date, timezone: string = "Europe/London"): string {
  // Use business timezone for customer-facing times
  return date
    .toLocaleTimeString("en-GB", { 
      hour: "numeric", 
      minute: "2-digit", 
      hour12: true,
      timeZone: timezone 
    })
    .toLowerCase();
}

// Helper to get current time in business timezone for pickup calculations
function getBusinessTime(timezone: string = "Europe/London"): { time: string; date: Date; dayOfWeek: number } {
  const now = new Date();
  
  // Create formatters for business timezone
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  
  // Get day of week in business timezone (not server time!)
  const businessDateStr = now.toLocaleString("en-US", { timeZone: timezone });
  const businessDate = new Date(businessDateStr);
  
  return {
    time: timeFormatter.format(now),
    date: now,
    dayOfWeek: businessDate.getDay(),
  };
}

// DEPRECATED: Kept for backwards compatibility - use getBusinessTime(timezone) instead
function getLondonTime(): { time: string; date: Date; dayOfWeek: number } {
  return getBusinessTime("Europe/London");
}

function formatPhoneNumberForSpeech(phone: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return null;

  // Convert common E.164 formats into a more familiar national format
  // to reduce model mistakes (e.g. +4474... => 07...).
  let digits = digitsOnly;
  let sayPlus = hasPlus;

  // UK: +44xxxxxxxxxx => 0xxxxxxxxxx (11 digits)
  if (digits.length === 12 && digits.startsWith("44")) {
    digits = `0${digits.slice(2)}`;
    sayPlus = false;
  }

  // US/CA: +1xxxxxxxxxx => xxxxxxxxxx (10 digits)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
    sayPlus = false;
  }

  // Create predictable pauses without using "..." (ellipses).
  const groups: string[] = [];

  if (digits.length === 11 && digits.startsWith("0")) {
    // Common UK national format: 5-3-3 (e.g., 07488 688 082)
    groups.push(digits.slice(0, 5), digits.slice(5, 8), digits.slice(8, 11));
  } else if (digits.length === 10) {
    // Common 10-digit format: 3-3-4
    groups.push(digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10));
  } else if (digits.length === 7) {
    // Short local numbers: 3-4
    groups.push(digits.slice(0, 3), digits.slice(3, 7));
  } else {
    // Fallback: readable 3-digit chunks
    for (let i = 0; i < digits.length; i += 3) {
      groups.push(digits.slice(i, i + 3));
    }
  }

  const speakGroup = (g: string) => g.split("").join(" ");
  const spoken = groups.map(speakGroup).join(", ");

  return sayPlus ? `plus ${spoken}` : spoken;
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
  // Restaurant-specific data
  menuCategories: any[];
  menuItems: any[];
  tables: any[];
}

async function buildFullSystemPrompt(
  supabase: any,
  businessId: string,
  businessName: string,
  businessAddress: string,
  assistantName: string,
  tone: string,
  voiceSpeed: string,
  callerPhone: string,
  twilioPhoneNumber: string | null,
  websiteKnowledge: string | null,
  businessType: BusinessType,
  restaurantSettings: any,
  businessTimezone: string = "Europe/London",
  callSid?: string
): Promise<PromptData> {
  const isRestaurant = businessType.startsWith("restaurant_");
  
  // Fetch all business data in parallel - include restaurant data if applicable
  const baseQueries = [
    supabase.from("staff").select("id, name, role, title, phone, ai_enabled, is_business_owner, working_hours").eq("business_id", businessId),
    supabase.from("services").select("id, name, duration_minutes, price, category, description, deposit_required, deposit_amount").eq("business_id", businessId),
    supabase.from("opening_hours").select("day_of_week, open_time, close_time, is_closed").eq("business_id", businessId),
    supabase.from("business_settings").select("min_booking_notice_hours, max_days_advance, cancellation_policy, currency, min_cancellation_notice_hours, min_reschedule_notice_hours, opening_context, business_name_phonetic").eq("business_id", businessId).maybeSingle(),
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
  ];
  
  // Add restaurant-specific queries
  if (isRestaurant) {
    baseQueries.push(
      supabase.from("menu_categories").select("id, name, description, display_order, is_active").eq("business_id", businessId).eq("is_active", true).order("display_order"),
      supabase.from("menu_items").select("id, name, description, price, category_id, dietary_tags, is_available, has_sizes, preparation_time_minutes").eq("business_id", businessId).eq("is_available", true),
      supabase.from("restaurant_tables").select("id, table_number, capacity, location, is_active").eq("business_id", businessId).eq("is_active", true),
    );
  }

  const results = await Promise.all(baseQueries);
  
  const [staffResult, servicesResult, hoursResult, settingsResult, timeOffResult, bookingsResult, customerSettingsResult] = results;
  
  // Extract restaurant data if applicable
  let menuCategories: any[] = [];
  let menuItems: any[] = [];
  let menuItemSizes: any[] = [];
  let menuItemOptionGroups: any[] = [];
  let menuItemOptions: any[] = [];
  let tables: any[] = [];
  
  if (isRestaurant && results.length > 7) {
    menuCategories = results[7]?.data || [];
    menuItems = results[8]?.data || [];
    tables = results[9]?.data || [];
    
    // Fetch menu item sizes and options for restaurants
    const menuItemIds = menuItems.map((item: any) => item.id);
    if (menuItemIds.length > 0) {
      const [sizesResult, optionGroupsResult] = await Promise.all([
        supabase.from("menu_item_sizes").select("id, menu_item_id, name, price, is_available, is_default, display_order").in("menu_item_id", menuItemIds).eq("is_available", true),
        supabase.from("menu_item_option_groups").select("id, menu_item_id, name, description, is_required, min_selections, max_selections, display_order").in("menu_item_id", menuItemIds),
      ]);
      
      menuItemSizes = sizesResult.data || [];
      menuItemOptionGroups = optionGroupsResult.data || [];
      
      // Fetch options for the option groups with has_sizes flag
      if (menuItemOptionGroups.length > 0) {
        const groupIds = menuItemOptionGroups.map((g: any) => g.id);
        const { data: optionsData } = await supabase.from("menu_item_options")
          .select("id, option_group_id, name, price_adjustment, is_available, is_default, display_order, has_sizes")
          .in("option_group_id", groupIds)
          .eq("is_available", true);
        menuItemOptions = optionsData || [];
        
        // Fetch option sizes for options that have sizes
        const optionsWithSizes = (optionsData || []).filter((o: any) => o.has_sizes);
        if (optionsWithSizes.length > 0) {
          const optionIds = optionsWithSizes.map((o: any) => o.id);
          const { data: optionSizesData } = await supabase.from("menu_item_option_sizes")
            .select("id, option_id, name, price, is_available, is_default, display_order")
            .in("option_id", optionIds)
            .eq("is_available", true);
          
          // Attach sizes to their parent options
          menuItemOptions = (optionsData || []).map((opt: any) => ({
            ...opt,
            sizes: (optionSizesData || []).filter((s: any) => s.option_id === opt.id)
          }));
        }
      }
    }
    
    console.log(`[MediaStream] Loaded restaurant data: ${menuCategories.length} categories, ${menuItems.length} items, ${menuItemSizes.length} sizes, ${tables.length} tables`);
  }

  const staff: StaffMember[] = (staffResult.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    title: s.title,
    phone: s.phone,
    ai_enabled: s.ai_enabled !== false,
    is_business_owner: s.is_business_owner === true,
    working_hours: s.working_hours,
  }));
  
  const services: Service[] = (servicesResult.data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    duration_minutes: s.duration_minutes,
    price: s.price,
    category: s.category,
    description: s.description,
    deposit_required: s.deposit_required,
    deposit_amount: s.deposit_amount,
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
    min_reschedule_notice_hours: settingsResult.data.min_reschedule_notice_hours || 24,
    cancellation_policy: settingsResult.data.cancellation_policy,
    currency: settingsResult.data.currency || "GBP",
    opening_context: settingsResult.data.opening_context || null,
  } : null;
  
  console.log("[MediaStream] Loaded opening_context:", businessSettings?.opening_context ? `"${businessSettings.opening_context.substring(0, 50)}..."` : "not set");
  
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
  
  console.log(`[MediaStream] Loaded ${staffServices.length} staff-service assignments for ${staffIds.length} staff members`);
  if (staffServices.length > 0) {
    console.log("[MediaStream] Staff-service assignments:", staffServices.map(ss => {
      const staffName = staff.find(s => s.id === ss.staff_id)?.name || "Unknown";
      const serviceName = services.find(s => s.id === ss.service_id)?.name || "Unknown";
      return `${staffName} -> ${serviceName}`;
    }).join(", "));
  }

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
  const callerInfo = await getCallerInfo(supabase, businessId, callerPhone, callSid);

  // Create a map of service ID to name for display
  const serviceNameMap: Record<string, string> = {};
  services.forEach(s => {
    serviceNameMap[s.id] = s.name;
  });

  // Format staff list with title, AI status, services, and working hours
  // CRITICAL: Use explicit "CAN ONLY BOOK FOR:" to prevent AI booking wrong service-staff pairs
  const dayAbbreviations = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const businessOwner = staff.find(s => s.is_business_owner);
  const staffList = staff.length > 0
    ? staff.map(s => {
        const aiStatus = !s.ai_enabled ? " [TRANSFER ONLY - NO AI BOOKING]" : "";
        const ownerStatus = s.is_business_owner ? " [BUSINESS OWNER]" : "";
        const staffServiceIds = staffServiceMap[s.id] || [];
        const canDoServices = staffServiceIds.map(sid => serviceNameMap[sid]).filter(Boolean);
        // Make it VERY explicit what services this staff can be booked for
        const servicesNote = canDoServices.length > 0 
          ? ` [CAN ONLY BOOK FOR: ${canDoServices.join(", ")}] ⚠️ REJECT booking for any other service!` 
          : " [NO SERVICES ASSIGNED - CANNOT BOOK]";
        
        // Format working hours if available
        let workingHoursNote = "";
        if (s.working_hours && Object.keys(s.working_hours).length > 0) {
          const workDays = Object.entries(s.working_hours)
            .filter(([_, v]: [string, any]) => v && v.start && v.end)
            .map(([day, hours]: [string, any]) => {
              const dayNum = parseInt(day);
              const dayName = dayAbbreviations[dayNum] || day;
              return `${dayName}:${hours.start?.slice(0,5)}-${hours.end?.slice(0,5)}`;
            });
          if (workDays.length > 0) {
            workingHoursNote = ` [WORKS: ${workDays.join(", ")}]`;
          }
        }
        
        return `- ${s.title ? s.title + " " : ""}${s.name}${ownerStatus}${aiStatus}${servicesNote}${workingHoursNote}`;
      }).join("\n")
    : "No staff configured";

  // Format services with who can perform each
  const servicesByCategory: Record<string, Service[]> = {};
  services.forEach(s => {
    const cat = s.category || "General";
    if (!servicesByCategory[cat]) servicesByCategory[cat] = [];
    servicesByCategory[cat].push(s);
  });
  
  // Check if any service requires deposit
  const hasDepositServices = services.some(s => s.deposit_required && s.deposit_amount && s.deposit_amount > 0);
  
  // Identify duplicate service names across categories
  const serviceNameCounts: Record<string, number> = {};
  services.forEach(s => {
    const normalizedName = s.name.toLowerCase().trim();
    serviceNameCounts[normalizedName] = (serviceNameCounts[normalizedName] || 0) + 1;
  });
  const duplicateServiceNames = new Set(
    Object.entries(serviceNameCounts)
      .filter(([_, count]) => count > 1)
      .map(([name]) => name)
  );
  
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
          
          // Show deposit requirement if applicable
          const depositNote = s.deposit_required && s.deposit_amount && s.deposit_amount > 0 
            ? ` [DEPOSIT: ${currency}${s.deposit_amount}]`
            : "";
          
          // For duplicate service names, show disambiguated name with category
          const normalizedName = s.name.toLowerCase().trim();
          const isDuplicate = duplicateServiceNames.has(normalizedName);
          const displayName = isDuplicate ? `${s.name} (${cat})` : s.name;
          const duplicateWarning = isDuplicate ? ` ⚠️ SAME NAME EXISTS IN OTHER CATEGORIES - ALWAYS CLARIFY!` : "";
          
          return `  - ${displayName}: ${s.duration_minutes}min, ${currency}${s.price}${availabilityNote}${depositNote}${duplicateWarning}`;
        }).join("\n")}`
      ).join("\n")
    : "Services available upon request";
  
  // Generate a warning about duplicate service names if any exist
  const duplicateServicesWarning = duplicateServiceNames.size > 0
    ? `\n⚠️ DUPLICATE SERVICE NAME ALERT: The following service names appear in MULTIPLE categories: ${[...duplicateServiceNames].join(", ")}. ALWAYS ask the customer which category (men/women/kids/etc.) before booking!`
    : "";

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

  // Format staff time off with precise times to avoid AI confusion
  const timeOffList = staffTimeOff.length > 0
    ? staffTimeOff.slice(0, 3).map(t => {
        const startDate = new Date(t.start_time);
        const endDate = new Date(t.end_time);
        const startDateStr = startDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        const endDateStr = endDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        const startTimeStr = formatTime(startDate);
        const endTimeStr = formatTime(endDate);
        
        // If same day, show times clearly
        if (startDateStr === endDateStr) {
          return `${t.staff_name}: ${startDateStr} (${startTimeStr}-${endTimeStr} ONLY)`;
        }
        return `${t.staff_name}: ${startDateStr} ${startTimeStr} to ${endDateStr} ${endTimeStr}`;
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

  // Get current date/time context IN BUSINESS TIMEZONE (not server time!)
  const now = new Date();
  
  // Use Intl formatters to get correct business timezone time
  const bizTimeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: businessTimezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const bizDateFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: businessTimezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const bizDayFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: businessTimezone,
    weekday: "long",
  });
  
  const currentTime = bizTimeFormatter.format(now).toLowerCase();
  const currentDate = bizDateFormatter.format(now);
  const currentDay = bizDayFormatter.format(now);
  
  // Get day of week in business timezone (not server time!) for opening hours lookup
  const bizDateStr = now.toLocaleString("en-US", { timeZone: businessTimezone });
  const bizDate = new Date(bizDateStr);
  const bizDayOfWeek = bizDate.getDay();

  // Determine if business is open TODAY (using business timezone day)
  const todayHours = hours.find(h => h.day_of_week === bizDayOfWeek);
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
  
  // Add personality touch based on tone for more human feel
  const personalityTouch = tone === "casual" 
    ? `PERSONALITY: Be warm and slightly playful. Light humor is okay. Say things like "No worries at all!" or "You're all sorted!"`
    : tone === "formal"
    ? `PERSONALITY: Be polished and professional but not stiff. Use "Certainly" and "Of course" naturally.`
    : `PERSONALITY: Be warm and professional. Balance friendliness with efficiency.`;

  // Build pacing instructions based on voice_speed setting
  let pacingInstruction = "";
  if (voiceSpeed === "slow") {
    pacingInstruction = `
SPEAKING STYLE:
- Speak at a calm, measured pace - take your time with each word
- Use longer pauses between sentences for emphasis
- Say "Let me check that for you" and similar thoughtful phrases
- Enunciate clearly and don't rush through important details`;
  } else if (voiceSpeed === "fast") {
    pacingInstruction = `
SPEAKING STYLE:
- Speak efficiently and get to the point quickly
- Keep responses concise and direct
- Skip unnecessary filler words
- Move the conversation forward purposefully`;
  } else {
    pacingInstruction = `
SPEAKING STYLE:
- Speak at a natural conversational pace
- Use contractions naturally (don't, won't, can't, I'll, we're)
- Include brief natural responses like "Sure!", "Absolutely!", "Of course!"
- Vary your sentence structure to sound more human`;
  }

  // Add comprehensive natural speech instructions for human-like voice
  const naturalSpeechRules = `
SOUND HUMAN - THIS IS CRITICAL:

**Filler Words & Thinking Sounds (USE THESE):**
- When checking something: "Hmm, let me take a look..." or "One sec, let me check that..."
- When processing: "Ah, okay..." or "Right, so..."
- When transitioning: "So..." or "Alright..."

**Emotional Reactions:**
- Confirming good news: "Oh, perfect!" or "Great news!" or "Lovely!"
- Showing empathy: "Oh no, I'm sorry to hear that" or "I understand, that's frustrating"
- Pleasant surprise: "Oh wonderful!" or "That works out nicely!"

**NEVER DO THESE (sounds robotic):**
- Starting every sentence with "I" or "So"
- Using the same acknowledgment twice in a row
- Saying "I understand" more than once per call
- Overly formal phrases like "I would be happy to assist you"
- Listing options in the exact same format every time

**Varied Response Openers (rotate these):**
- "Let me see..." / "One moment..." / "Let me just check..."
- "Perfect!" / "Great!" / "Lovely!" / "That works!"
- "Right, so..." / "Okay, so..." / "Alright..."
- "Ah, I see..." / "Got it..." / "Makes sense..."

**Natural Acknowledgments:**
- Quick: "Mhm" / "Right" / "Sure" / "Yep"
- Confirming: "Got it" / "Okay" / "Alright"
- Positive: "Absolutely" / "Of course" / "No problem"

**Conversational Flow:**
- React before responding: "Oh, 3pm? Let me check that for you..."
- Summarize naturally: "So that's a haircut with Sarah at 3pm on Friday - does that sound right?"
- End naturally: "Lovely, you're all booked in!" not "Your booking has been confirmed."
`;

  // Greeting - casual, personalized with recording disclosure (explains purpose)
  const greetingInstruction = callerInfo.isReturning 
    ? `Greet warmly: "Hey ${callerInfo.name?.split(' ')[0] || callerInfo.name}! Great to hear from you again! Quick heads up - this call may be recorded to help us improve our service. What can I do for you today?"`
    : `Greet: "Hey there! Thanks for calling ${businessName}! Just so you know, this call may be recorded to help us improve our service. I'm ${assistantName}, how can I help you today?"`;

  // Opening context from business owner - should be woven naturally into greeting
  const openingContext = businessSettings?.opening_context?.trim() || "";
  const openingContextSection = openingContext
    ? `
## OPENING CONTEXT FROM BUSINESS:
The business owner wants you to naturally incorporate the following information into your opening greeting.
Do NOT read this word-for-word - interpret it and weave it into your greeting naturally based on your personality:

"${openingContext}"

Work this information smoothly into your greeting without making it sound like a scripted announcement.
`
    : "";
  // Build customer data collection rules based on business settings
  let dataCollectionRules = "## DATA COLLECTION:\nCollect: name, phone (use caller's number by default).\nDO NOT ask for email, marketing consent, preferred staff, notes, or how they heard about us.";
  
  if (customerSettings) {
    const collectFields: string[] = [];
    const doNotAskFields: string[] = [];
    
    // Always collect name and phone by default
    if (customerSettings.collect_name) collectFields.push("name");
    if (customerSettings.collect_phone) collectFields.push("phone (use caller's number by default)");
    
    // Optional fields - only ask if enabled
    if (customerSettings.collect_email) {
      collectFields.push("email address");
    } else {
      doNotAskFields.push("email");
    }
    
    if (customerSettings.ask_preferred_staff) {
      collectFields.push("preferred staff member (if they have one)");
    } else {
      doNotAskFields.push("preferred staff");
    }
    
    if (customerSettings.ask_notes_preferences) {
      collectFields.push("any special notes or preferences");
    } else {
      doNotAskFields.push("notes or preferences");
    }
    
    if (customerSettings.ask_how_heard) {
      collectFields.push("how they heard about us (at the end of booking)");
    } else {
      doNotAskFields.push("how they heard about us");
    }
    
    if (customerSettings.ask_marketing_consent) {
      collectFields.push("if they'd like to receive marketing updates (at the end)");
    } else {
      doNotAskFields.push("marketing consent");
    }
    
    dataCollectionRules = `## DATA COLLECTION:
Collect: ${collectFields.join(", ")}.${doNotAskFields.length > 0 ? `\nDO NOT ask for: ${doNotAskFields.join(", ")}.` : ""}`; 
  }

  // Deposit instruction - only include if some services require deposits
  const depositInstruction = hasDepositServices 
    ? `\n## DEPOSITS (IMPORTANT - FOLLOW THIS FLOW):

**1. WHEN LISTING SERVICES or caller asks about prices:**
Include deposit info naturally when mentioning services that require one:
- "A haircut is £15, and there's a small £1 deposit to secure your booking"
- "That service is £30, with a £5 deposit payable by text"

**2. BEFORE CALLING create_booking (REQUIRED for deposit services):**
If the service has [DEPOSIT: X] in its description, you MUST:
- Say: "Just so you know, there's a [deposit amount] deposit for this service. You'll get a text with a secure payment link, and if it's not paid before your appointment, the booking may be cancelled. Is that okay with you?"
- WAIT for the caller to confirm (yes/okay/that's fine/etc.)
- Only THEN call create_booking
- If they say no or hesitate, offer alternatives or ask if they have questions

**3. AFTER BOOKING IS CONFIRMED:**
Remind them about the payment:
- "Perfect, you're all booked! You'll get a text shortly with your booking details and the payment link for the [deposit amount] deposit. Just a heads up - please pay before your appointment to keep your slot secure."

**4. IF THEY ASK ABOUT DEPOSITS:**
- "The deposit helps us secure your time slot. You'll get a text with an easy payment link - just takes a minute to pay. If it's not paid before your appointment, we may need to give your slot to someone else."

**DO NOT mention deposits for services that don't have [DEPOSIT: X] in their description.**`
    : "";

  // Website knowledge for FAQs
  const faqContext = websiteKnowledge 
    ? `\nFAQ INFO: ${websiteKnowledge.slice(0, 500)}`
    : "";

  // Policy info
  const minNotice = businessSettings?.min_booking_notice_hours || 2;
  const maxAdvance = businessSettings?.max_days_advance || 30;
  const minCancelNotice = businessSettings?.min_cancellation_notice_hours || 24;
  const cancellationPolicyText = businessSettings?.cancellation_policy || "";

  const businessPhoneForSpeech = formatPhoneNumberForSpeech(twilioPhoneNumber);

  const prompt = `You are ${assistantName}, phone receptionist for ${businessName}. ${toneInstruction}
${pacingInstruction}
${naturalSpeechRules}
${personalityTouch}

## MANDATORY AVAILABILITY CHECK (CRITICAL - NEVER SKIP):
**YOU MUST CALL check_availability BEFORE EVERY RESPONSE ABOUT AVAILABILITY.**

TRIGGER PHRASES - If the customer says ANY of these, call check_availability IMMEDIATELY:
- "Is [time/date] available?"
- "Can I come in at..."
- "Do you have anything..."
- "Is [staff name] free?"
- "Who's available at..."
- "Can I book for..."
- "What times do you have?"
- "Are you open on..."
- ANY mention of a specific time, date, or asking about availability

NEVER DO THIS:
❌ "Yes, 3pm is available" (without calling check_availability first)
❌ "Sarah is free tomorrow" (without calling check_availability first)
❌ "We have openings at..." (without calling check_availability first)
❌ Assume based on opening hours alone - there may be bookings!

ALWAYS DO THIS:
✅ Call check_availability first, THEN tell the customer what's actually available
✅ Even if you think you know, VERIFY with check_availability
✅ When asked "who's available", check availability for EACH relevant staff member

## ⛔ STAFF-SERVICE MATCHING (CRITICAL - BOOKING WILL FAIL IF IGNORED):
**BEFORE CALLING create_booking, YOU MUST CHECK:**
Look at the staff member's [CAN ONLY BOOK FOR: ...] list in the STAFF section below.
- If the requested service IS in that list → OK to proceed
- If the requested service is NOT in that list → DO NOT CALL create_booking!
  Instead say: "[Staff name] doesn't do [service]. That service is available with [list staff who have it in their CAN ONLY BOOK FOR]."

**Example:** 
- Customer asks for "Kids Haircut" with "Mike"
- Mike's line shows: [CAN ONLY BOOK FOR: Adult Haircut, Fade Cut]
- "Kids Haircut" is NOT listed → REJECT and suggest staff who CAN do Kids Haircut

## CRITICAL TOOL USAGE RULES (MUST FOLLOW):
1. **AVAILABILITY**: NEVER say a time is available or unavailable without calling check_availability first. NO EXCEPTIONS. NEVER GUESS.
2. **NAME REQUIRED**: BEFORE calling create_booking, you MUST have asked and received the customer's name. NEVER use "Unknown", "Guest", "Caller", or any placeholder - if you don't have their real name, ASK: "Can I get your name for the booking?"
3. **BOOKING - MANDATORY TOOL CALL**: You MUST call create_booking BEFORE confirming any booking to the customer. NEVER say "You're all booked in" or "I've booked you in" or "You're all set" UNTIL create_booking returns success=true. If you say the booking is confirmed without calling the tool, NO BOOKING IS ACTUALLY CREATED.
4. **BOOKING SEQUENCE**: Only call create_booking AFTER: a) check_availability confirms slot is free, b) you verified staff's [CAN ONLY BOOK FOR:] includes the service, c) you have the customer's REAL NAME, d) customer confirmed all details. THEN call create_booking. THEN after the tool succeeds, confirm to the customer.
5. **STAFF-SERVICE MISMATCH**: If staff CANNOT do the service, DO NOT attempt booking - tell customer who CAN do it.
6. **TRANSFER ONLY**: Staff marked [TRANSFER ONLY] cannot be booked - offer to transfer instead.

## ⚠️ RESCHEDULE vs CREATE - THIS IS CRITICAL! ⚠️
**RESCHEDULE** means MOVE AN EXISTING BOOKING to a new time/date.
- Keywords: "reschedule", "move", "change time", "change date", "move to", "switch to", "I have an appointment but need a different time"
- Action: **reschedule_booking** - NEVER create_booking!
- You MUST find the existing booking FIRST using their booking code or name, then UPDATE its time
- NEVER create a new booking when user wants to reschedule - this leaves duplicate bookings!

**CREATE** means make a BRAND NEW booking for someone who doesn't have one.
- Keywords: "book", "make appointment", "schedule", "new booking", "I'd like to book"
- Action: **create_booking**
- Only use when user explicitly wants a NEW appointment, not when moving an existing one

**EXAMPLES:**
✅ Customer says "I need to reschedule my appointment" → Ask for booking code/name → Use reschedule_booking
✅ Customer says "Can I move my booking to tomorrow?" → Use reschedule_booking  
✅ Customer says "I have an appointment but I need a different time" → Use reschedule_booking
✅ Customer says "I want to change my booking to next week" → Use reschedule_booking
❌ WRONG: Customer says "reschedule" but you call create_booking ← NEVER DO THIS - creates duplicates!

**ASK YOURSELF:** Does the customer want to MOVE an existing booking or CREATE a new one?
- If they mention reschedule/move/change an existing appointment → Ask for booking code or name, then use reschedule_booking
- If they want something completely new and don't have an existing booking → Use create_booking

## SERVICE CLARIFICATION (CRITICAL):
- NEVER assume which service type the customer wants (e.g., Kids Haircut vs Adult Haircut vs Women Haircut).
- ALWAYS ask "Is that for an adult, a child, or a woman?" BEFORE booking if there are multiple similar services.
- Use the EXACT service name when booking (e.g., "Kids Haircut" not just "haircut").
- ⚠️ Some services have the SAME NAME but different categories/prices (e.g., "Shape-up" for men vs kids). If the customer asks for a service that exists in multiple categories, you MUST ask which one they mean BEFORE attempting to book.
- When clarifying duplicate services, ask about the CATEGORY only - do NOT mention prices unless the customer specifically asks: "Is that the Shape-up for men or for kids?"
- Only mention prices when the customer asks "how much?" or "what's the price?"${duplicateServicesWarning}

## PHONE NUMBER HANDLING:
- Use the caller's phone number (the number they're calling from) by default for the booking.
- Only ask for a different phone number if the customer specifically says they want to use a different number.
- When confirming the booking, mention they will receive booking details by SMS.
- CRITICAL: If the caller asks for the business phone number, read EXACTLY the digits shown on the line "Business Phone Number" in CURRENT CONTEXT. Never invent a number, never give an example pattern, and never use "...". Speak one digit at a time; commas indicate short pauses.
- CRITICAL: If the caller asks for the business address/location/postcode, read EXACTLY what is shown on the line "Business Address" in CURRENT CONTEXT. NEVER invent, guess, or modify the address, street, or postcode - read it EXACTLY as written. If the address seems incomplete, still read exactly what is shown.
## POLICY ACCURACY (MUST FOLLOW):
- NEVER guess policy numbers.
- These are the ONLY correct numeric values:
  - Booking notice: ${minNotice} hours
  - Cancellation notice: ${minCancelNotice} hours (DO NOT CONFUSE WITH BOOKING NOTICE)
- If asked about cancellations, ALWAYS say: "Minimum cancellation notice is ${minCancelNotice} hours."

## NAME CORRECTION:
- If the caller says "that's not my name", "my name is actually...", "I go by...", "you can call me...", or indicates their name is wrong - use update_customer_name IMMEDIATELY.
- Apologize briefly ("Oh, sorry about that!") and confirm the new name.
- Use their corrected name for the rest of the call.

## PRONOUN CLARIFICATION (CRITICAL):
- If the customer uses pronouns like "he", "she", "him", "her", "my usual", "my regular barber", "the same person", "that guy" WITHOUT naming someone specific, ALWAYS ask for clarification.
- Example: Customer says "He's available today" → Ask "Which barber are you referring to?"
- Example: Customer says "I'll go with her" → Ask "Just to confirm, who would you like to book with?"
- Example: Customer says "my usual" → Ask "And who is your usual barber?"
- NEVER assume you know who they mean - always clarify names before proceeding with booking.

## STAFF SELECTION RULES:
- If customer says "whoever is available", "no preference", or similar → find the earliest available slot across all staff, then TELL them who that staff member is before booking
- If customer mentions a specific name → use that staff member
- If customer uses vague terms like "the same one", "my usual", "him/her", "that guy" → ASK: "Just to confirm, which barber are you thinking of?"
- ⚠️ ALWAYS tell the customer WHO they'll be seeing before confirming the booking - never leave this ambiguous

## GROUP BOOKING WORKFLOW (Multiple People):
When a customer wants to book for multiple people (e.g., "me and my son", "both of us", "two haircuts"):

**STEP 1 - CONFIRM SERVICES**:
- "Sure! What services would you like? A haircut for you and...?"
- Let them specify what each person needs

**STEP 2 - GET EACH PERSON'S NAME** (MANDATORY - DO NOT SKIP):
- You MUST ask for the name of each person being booked
- "And what's your son's name for the booking?"
- NEVER proceed to booking without getting EVERY person's name
- "your son" or "your daughter" is NOT acceptable as a customer name

**STEP 3 - ASK STAFF PREFERENCE**:
- "Would you like the same barber for both, or are you happy with whoever's available?"
- If same barber: appointments will be consecutive (one after the other)
- If any barber: appointments can be at the same time with different staff

**STEP 4 - CHECK AVAILABILITY**:
- Call check_availability for the date/time
- If same barber requested: find consecutive slots
- If any barber: can book simultaneously with different staff

**STEP 5 - EXPLAIN THE TIMING CLEARLY**:
- Same barber: "I can book [name1] at 12pm and [name2] right after at 12:30pm, both with [barber]"
- Different barbers: "I can book you both at 12pm - [name1] with [barber1] and [name2] with [barber2]"

**STEP 5.5 - CONFIRM BEFORE BOOKING** (MANDATORY):
- "Just to confirm - that's a [service1] for [name1] and a [service2] for [name2], both on [day] at [times]. Does that sound right?"
- WAIT for customer to say "yes" before proceeding to Step 6
- If they correct anything, update and re-confirm

**STEP 6 - BOOK EACH PERSON**:
- Call create_booking for EACH person separately
- Use their ACTUAL NAME (not "your son")
- Use the CALLER'S phone number for all bookings

**STEP 7 - CONFIRM WITH FULL DETAILS**:
- "You're all set! [Name1] at [time] with [barber1] for [service], and [Name2] at [time] with [barber2] for [service]. You'll get the details by SMS."

⚠️ CUSTOMER vs STAFF NAME CONFUSION:
- When customer mentions a name, NEVER assume it's a staff member
- If name matches a staff name: "Is [name] the person you're booking for, or would you like to book WITH [name]?"
- Customer names = people RECEIVING service → customer_name field
- Staff names = people PROVIDING service → staff_name field

## RECORDING OPT-OUT:
- If the caller says they don't want to be recorded (e.g., "I don't want to be recorded", "please turn off recording", "can you stop recording"), use stop_recording IMMEDIATELY.
- After stopping, confirm: "No problem, I've stopped the recording. How can I help you?"
- Continue the call normally after stopping the recording.
- Most callers are fine with recording - only stop if they explicitly ask.

## RECEPTIONIST CONVERSATION STYLE:

**Sound Human, Not Like a Script:**
- Use the customer's name naturally: "Alright ${callerInfo?.name || 'there'}, let me check that for you"
- Acknowledge what they said before checking: "Tuesday at 12pm - perfect, give me one second"
- Use natural fillers: "Let me just..." "One moment while I..." "Alright so..."
- Be warm but efficient - friendly without being over-the-top

**Acknowledge Before Acting:**
- When customer gives info, acknowledge before going quiet to check:
  - Customer: "Tuesday at 12pm" → You: "Tuesday at 12pm, let me check..." [then use tool]
  - Customer: "A haircut and a shape-up" → You: "Haircut and shape-up - perfect. And what's your son's name?"
- Don't just go silent - bridge the conversation naturally

**When You Mishear or Customer Corrects You:**
- "Oh sorry, I misheard! Tuesday - let me check that now."
- "My apologies, I must have misheard! Tuesday works great."
- NEVER just say "Got it" after being corrected - acknowledge the mistake briefly

**NEVER Dump Staff Names:**
- WRONG: "Aloma, Ibrahim and Toby are all available"
- RIGHT: "I've got availability at 12pm - do you have a preference for who you see?"
- Only mention specific staff if customer asks, or if there's a constraint
- If customer says "whoever's available" → Book the first available, then tell them WHO: "Great, I'll book you in with Ibrahim at 12pm"

## CONVERSATION RULES:
- Keep responses SHORT: 1-2 sentences max. Sound human, not robotic.
- NEVER end the call unless customer explicitly says goodbye (bye, thanks bye, etc.)
- After booking is confirmed, ask "Is there anything else?" and WAIT for response.
- Silence/pauses are NOT a reason to end - if you hear silence, say "Are you still there?" and wait.
- NEVER call end_call within the first 30 seconds of the call - the conversation needs time to develop.
- If unsure about availability, ALWAYS use check_availability tool - don't make assumptions.
- Do NOT ask for email - we send confirmations by SMS only.
- ALWAYS speak times in 12-hour format with AM/PM (e.g., "5pm", "10:30am", "2pm"). NEVER use 24-hour format like "seventeen hundred" or "14:00".

## WHEN CUSTOMER ASKS FOR A TIME:
1. IMMEDIATELY call check_availability (DO NOT SKIP).
2. If the customer mentions a specific time, include time in HH:MM (24-hour), e.g. 5pm -> 17:00.
3. If the customer mentions a service (e.g. haircut), include service_name (EXACT service name) so availability is filtered to staff who actually do that service.
4. If the tool returns available_staff, tell them who is available at that exact time.
5. If the tool returns available_slots, suggest a few options and ask which time works.
6. Only confirm availability that appears in the tool result.

## ⚠️ BOOKING WORKFLOW - NEVER SKIP create_booking ⚠️
When customer chooses a staff member and time:
1. **CONFIRM ALL DETAILS FIRST** - Before calling create_booking, summarize:
   "Just to confirm - that's a [SERVICE] with [STAFF NAME] at [TIME] on [DATE]. Does that sound right?"
2. **WAIT for customer confirmation** - They must say "yes", "correct", "sounds good", etc.
3. **THEN CALL create_booking** with all details (customer_name, customer_phone, service_name, staff_name, date, time)
4. **WAIT for the tool result** - if success=true, the booking is real
5. **ONLY AFTER success=true**, confirm: "Perfect, you're all set with [STAFF NAME] at [TIME]. You'll get a text with the details."
6. If the tool fails, tell the customer what went wrong and try to resolve it

⚠️ **CRITICAL RULES**:
- NEVER say "You're all booked" without calling create_booking first - the booking does NOT exist!
- ALWAYS mention the staff member's name in the final confirmation so the customer knows WHO they'll see
- The customer should NEVER have to ask "who would it be with?" - proactively tell them

## STAFF AVAILABILITY RULES:
- Each staff member's [WORKS:] shows which days/hours they work. If no [WORKS:] shown, assume they follow business hours.
- Staff marked in TIME OFF are unavailable during those times.
- When a customer asks for a time, you MUST still call check_availability to check for actual bookings - working hours alone are NOT enough!

## BUSINESS OWNER REQUESTS:
- If the caller asks to "speak to the owner", "talk to the business owner", "speak with the manager", or similar, look for staff marked [BUSINESS OWNER] in the STAFF list below.
- If a business owner is identified, use transfer_call to transfer them to the owner's number (if they have a phone).
- If no business owner is set or they don't have a phone number, apologize and offer to take a message or help with their query.

${greetingInstruction}
${openingContextSection}
## CURRENT CONTEXT:
- Today: ${currentDay}, ${currentDate} at ${currentTime}
- Business Status: ${todayStatus}
- Business Address: ${businessAddress}
${businessSettings?.business_name_phonetic ? `- PRONUNCIATION: When saying the business name aloud, pronounce it as: "${businessSettings.business_name_phonetic}"` : ""}
- Business Phone Number: ${businessPhoneForSpeech || "(not available)"}
- ${callerContext}
- Caller Phone: ${callerPhone} (use this for booking unless they request otherwise)
${callerInfo.recentCallContext ? `
═══════════════════════════════════════
📞 RECENT CALL MEMORY (< 30 min ago)
═══════════════════════════════════════
The caller spoke with you very recently. Here's what was discussed:
${callerInfo.recentCallContext}

INSTRUCTIONS: Acknowledge naturally if the caller references the previous call.
Do NOT repeat the entire summary — just use the context to help.
` : ""}

## STAFF (⚠️ CHECK [CAN ONLY BOOK FOR:] BEFORE BOOKING - service must be listed or booking WILL FAIL):
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
${depositInstruction}

${dataCollectionRules}${faqContext}`;

  // For restaurants, use the appropriate restaurant prompt builder instead
  if (isRestaurant) {
    // Enrich menu items with their sizes
    const enrichedMenuItems = menuItems.map((item: any) => {
      const sizes = menuItemSizes.filter((s: any) => s.menu_item_id === item.id);
      return {
        ...item,
        sizes: sizes.length > 0 ? sizes : null,
      };
    });
    
    // Get current time in business timezone for the AI
    const restNow = new Date();
    const bizTimeFormatter2 = new Intl.DateTimeFormat("en-GB", {
      timeZone: businessTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const bizDateFormatter2 = new Intl.DateTimeFormat("en-GB", {
      timeZone: businessTimezone,
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const bizDayFormatter2 = new Intl.DateTimeFormat("en-GB", {
      timeZone: businessTimezone,
      weekday: "long",
    });
    
    const restCurrentTime = bizTimeFormatter2.format(restNow);
    const restCurrentDate = bizDateFormatter2.format(restNow);
    const restCurrentDay = bizDayFormatter2.format(restNow);
    
    // Determine if business is currently open based on business timezone day
    const restBizDayOfWeek = new Date(restNow.toLocaleString("en-US", { timeZone: businessTimezone })).getDay();
    const restTodayHours = hours.find((h: any) => h.day_of_week === restBizDayOfWeek);
    const restIsOpenToday = restTodayHours && !restTodayHours.is_closed;
    const businessStatus = restIsOpenToday 
      ? `OPEN (${restTodayHours.open_time?.slice(0, 5)}-${restTodayHours.close_time?.slice(0, 5)})`
      : "CLOSED";
    
    const restaurantPrompt = buildSystemPromptForBusinessType({
      businessType,
      businessName,
      businessNamePhonetic: businessSettings?.business_name_phonetic || undefined,
      businessAddress,
      assistantName,
      tone,
      voiceSpeed,
      callerPhone,
      twilioPhoneNumber,
      websiteKnowledge,
      openingHours: hours,
      businessSettings,
      callerInfo,
      menuCategories,
      menuItems: enrichedMenuItems,
      menuItemOptions,
      menuItemOptionGroups,
      tables,
      restaurantSettings,
      openingContext: businessSettings?.opening_context || undefined,
      recentCallContext: callerInfo.recentCallContext,
      currentTime: restCurrentTime,
      currentDate: restCurrentDate,
      currentDay: restCurrentDay,
      businessStatus,
    });
    
    console.log(`[MediaStream] Built restaurant prompt for ${businessType} with ${menuItems.length} menu items`);
    
    return {
      prompt: restaurantPrompt,
      businessSettings,
      openingHours: hours,
      staffTimeOff,
      staffServices,
      staff,
      services,
      menuCategories,
      menuItems: enrichedMenuItems,
      tables,
    };
  }

  return {
    prompt,
    businessSettings,
    openingHours: hours,
    staffTimeOff,
    staffServices,
    staff,
    services,
    menuCategories: [],
    menuItems: [],
    tables: [],
  };
}

async function executeUpdateCustomerLanguage(supabase: any, session: StreamSession, args: any): Promise<any> {
  const { detected_language } = args;
  if (!detected_language) {
    return { success: false, message: "No language provided" };
  }

  const normalizedPhone = session.callerPhone.replace(/\D/g, "").slice(-10);
  
  try {
    const { error } = await supabase
      .from("customers")
      .update({ preferred_language: detected_language })
      .eq("business_id", session.businessId)
      .or(`phone.ilike.%${normalizedPhone}%,phone.eq.${session.callerPhone}`);

    if (error) {
      console.error("[MediaStream] Error updating customer language:", error);
      return { success: false, message: "Could not update language preference" };
    }

    console.log(`[MediaStream] Updated customer language to: ${detected_language}`);
    return { success: true, message: `Language preference saved: ${detected_language}` };
  } catch (err) {
    console.error("[MediaStream] Error in executeUpdateCustomerLanguage:", err);
    return { success: false, message: "Error updating language" };
  }
}

async function getCallerInfo(supabase: any, businessId: string, callerPhone: string, currentCallSid?: string): Promise<CallerInfo> {
  if (!callerPhone) {
    return { isReturning: false };
  }

  const normalizedPhone = callerPhone.replace(/\D/g, "").slice(-10);
  
  // Try to find customer by phone (include preferred_language)
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, total_visits, preferred_staff_id, preferred_language, preferred_staff:preferred_staff_id(id, name)")
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
    preferredLanguage: customer.preferred_language || undefined,
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
    } : undefined,
    recentCallContext: await getRecentCallContext(supabase, businessId, callerPhone, normalizedPhone, currentCallSid)
  };
}

async function getRecentCallContext(supabase: any, businessId: string, callerPhone: string, normalizedPhone: string, currentCallSid?: string): Promise<string | undefined> {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    let query = supabase
      .from("call_conversations")
      .select("messages, call_sid, created_at")
      .eq("business_id", businessId)
      .or(`caller_phone.ilike.%${normalizedPhone}%,caller_phone.eq.${callerPhone}`)
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (currentCallSid) {
      query = query.neq("call_sid", currentCallSid);
    }
    
    const { data: recentCall } = await query.maybeSingle();
    
    if (!recentCall || !recentCall.messages || !Array.isArray(recentCall.messages) || recentCall.messages.length === 0) {
      return undefined;
    }
    
    // Take the last 8 messages for context
    const recentMessages = recentCall.messages.slice(-8);
    const summary = recentMessages
      .map((msg: any) => `${msg.role === "user" ? "Caller" : "Assistant"}: ${msg.content}`)
      .join("\n");
    
    return summary;
  } catch (error) {
    console.error("[MediaStream] Error fetching recent call context:", error);
    return undefined;
  }
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
