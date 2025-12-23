import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { encode as encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// ============================================================================
// RATE LIMITING (in-memory, resets on function cold start)
// ============================================================================
interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blocked: boolean;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // max 30 requests per minute per IP
const RATE_LIMIT_BLOCK_DURATION_MS = 300000; // 5 minute block after exceeding

function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(clientIp);
  
  if (!entry) {
    rateLimitMap.set(clientIp, { count: 1, firstRequest: now, blocked: false });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  // Check if currently blocked
  if (entry.blocked) {
    if (now - entry.firstRequest < RATE_LIMIT_BLOCK_DURATION_MS) {
      console.warn(`[TwilioWebhook] Rate limit: IP ${clientIp} is blocked`);
      return { allowed: false, remaining: 0 };
    }
    // Block expired, reset
    rateLimitMap.set(clientIp, { count: 1, firstRequest: now, blocked: false });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  // Check if window expired
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(clientIp, { count: 1, firstRequest: now, blocked: false });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  
  // Within window, check count
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    entry.blocked = true;
    entry.firstRequest = now; // Reset for block duration
    console.warn(`[TwilioWebhook] Rate limit exceeded for IP ${clientIp}, blocking for 5 minutes`);
    return { allowed: false, remaining: 0 };
  }
  
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

// ============================================================================
// SECURITY LOGGING
// ============================================================================
function logSecurityEvent(event: string, details: Record<string, unknown>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };
  console.warn(`[SECURITY] ${JSON.stringify(logEntry)}`);
}

// ============================================================================
// TWILIO SIGNATURE VALIDATION
// ============================================================================

async function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null,
  clientIp: string
): Promise<boolean> {
  if (!signature) {
    logSecurityEvent("MISSING_SIGNATURE", { provider: "twilio", clientIp, url });
    return false;
  }

  try {
    // Sort params alphabetically and concatenate
    const sortedKeys = Object.keys(params).sort();
    let dataString = url;
    for (const key of sortedKeys) {
      dataString += key + params[key];
    }

    // Create HMAC-SHA1 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authToken);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    
    const data = encoder.encode(dataString);
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, data);
    const expectedSignature = encodeBase64(new Uint8Array(signatureBuffer));

    const isValid = expectedSignature === signature;
    if (!isValid) {
      logSecurityEvent("INVALID_SIGNATURE", { 
        provider: "twilio", 
        clientIp, 
        url,
        receivedSignaturePrefix: signature.substring(0, 10) + "..."
      });
    }
    return isValid;
  } catch (error) {
    logSecurityEvent("SIGNATURE_VALIDATION_ERROR", { provider: "twilio", clientIp, error: String(error) });
    return false;
  }
}

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

// Default ElevenLabs voice IDs
const DEFAULT_VOICES = {
  female: "EXAVITQu4vr4xnSDxMaL", // Sarah
  male: "CwhRBWXzGAHq8TQ4Fs17", // Roger
};

// Generate audio with ElevenLabs and upload to storage, return signed URL
async function generateAndUploadAudio(
  supabase: any,
  text: string,
  voiceId: string,
  callSid: string,
  messageId: string
): Promise<string | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  
  if (!ELEVENLABS_API_KEY) {
    console.error("[TwilioWebhook] ELEVENLABS_API_KEY not configured");
    return null;
  }

  try {
    console.log(`[TwilioWebhook] Generating ElevenLabs audio for voice ${voiceId}`);
    const startTime = Date.now();
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5", // Fastest model with good quality
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[TwilioWebhook] ElevenLabs API error:", response.status, errorText);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[TwilioWebhook] ElevenLabs audio generated in ${Date.now() - startTime}ms`);

    // Upload to storage
    const fileName = `voice-responses/${callSid}/${messageId}.mp3`;
    
    const { error: uploadError } = await supabase.storage
      .from("call-recordings")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[TwilioWebhook] Storage upload error:", uploadError);
      return null;
    }

    // Get signed URL (valid for 60 seconds - enough for Twilio to fetch)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("call-recordings")
      .createSignedUrl(fileName, 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("[TwilioWebhook] Failed to create signed URL:", signedUrlError);
      return null;
    }

    console.log(`[TwilioWebhook] Audio uploaded in ${Date.now() - startTime}ms total`);
    return signedUrlData.signedUrl;
  } catch (error) {
    console.error("[TwilioWebhook] Error generating audio:", error);
    return null;
  }
}

// Simple error TwiML with Polly fallback
function twimlError(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB"><prosody rate="108%">${escapeXml(message)}</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Base speech hints for better STT recognition with accents
const BASE_SPEECH_HINTS = "booking, appointment, cancel, reschedule, haircut, beard, trim, shave, fade, lineup, braids, cornrows, locs, twists, weave, relaxer, perm, colour, color, highlights, balayage, blowout, wash, style, tomorrow, today, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, morning, afternoon, evening, o'clock, half past, quarter past, available, availability, name, phone, confirm, yes, no, please, thank you, next week, this week";

// Fetch dynamic speech hints from business data (staff names, services)
async function getBusinessSpeechHints(supabase: any, businessId: string): Promise<string> {
  const hints: string[] = [BASE_SPEECH_HINTS];
  
  try {
    // Fetch staff names
    const { data: staff } = await supabase
      .from("staff")
      .select("name")
      .eq("business_id", businessId);
    
    if (staff && staff.length > 0) {
      const staffNames = staff.map((s: any) => s.name).filter(Boolean);
      if (staffNames.length > 0) {
        hints.push(staffNames.join(", "));
      }
    }
    
    // Fetch service names
    const { data: services } = await supabase
      .from("services")
      .select("name, category")
      .eq("business_id", businessId);
    
    if (services && services.length > 0) {
      const serviceNames = services.map((s: any) => s.name).filter(Boolean);
      const categories = [...new Set(services.map((s: any) => s.category).filter(Boolean))];
      if (serviceNames.length > 0) {
        hints.push(serviceNames.join(", "));
      }
      if (categories.length > 0) {
        hints.push(categories.join(", "));
      }
    }
    
    console.log(`[TwilioWebhook] Built speech hints with ${staff?.length || 0} staff and ${services?.length || 0} services`);
  } catch (error) {
    console.error("[TwilioWebhook] Error fetching speech hints:", error);
  }
  
  return hints.join(", ");
}

// Generate TwiML with ElevenLabs audio - using Deepgram nova-2 for better accent recognition
function twimlGatherWithAudio(
  audioUrl: string,
  gatherAudioUrl: string | null,
  gatherText: string,
  actionUrl: string,
  recordingCallbackUrl: string,
  speechHints: string,
  timeout: number = 6
): Response {
  // If gather audio is available, use Play; otherwise fallback to Say
  const gatherContent = gatherAudioUrl 
    ? `<Play>${gatherAudioUrl}</Play>`
    : `<Say voice="Polly.Amy-Neural" language="en-GB"><prosody rate="108%">${escapeXml(gatherText)}</prosody></Say>`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Record recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST"/>
  </Start>
  <Play>${audioUrl}</Play>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${escapeXml(speechHints)}">
    ${gatherContent}
  </Gather>
  <Say voice="Polly.Amy-Neural" language="en-GB"><prosody rate="108%">I didn't hear anything. Please call back if you need assistance. Goodbye.</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Fallback TwiML with Polly voice - using Deepgram nova-2 for better accent recognition
function twimlGatherWithPolly(
  sayText: string,
  gatherPrompt: string,
  actionUrl: string,
  recordingCallbackUrl: string,
  speechHints: string,
  voice: string,
  rate: string = "108%",
  timeout: number = 6
): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Record recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST"/>
  </Start>
  <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">${escapeXml(sayText)}</prosody></Say>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${escapeXml(speechHints)}">
    <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">${escapeXml(gatherPrompt)}</prosody></Say>
  </Gather>
  <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">I didn't hear anything. Please call back if you need assistance. Goodbye.</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Helper function to get business AI voice settings
async function getBusinessAiVoiceSettings(supabase: any, businessId: string) {
  const { data: settings, error } = await supabase
    .from("business_settings")
    .select("assistant_name, tone, primary_language, voice_gender, voice_speed, elevenlabs_voice_id")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching business settings:", error);
  }

  return {
    assistantName: settings?.assistant_name || "Aivia",
    tone: settings?.tone || "neutral",
    primaryLanguage: settings?.primary_language || "English",
    voiceGender: settings?.voice_gender || "female",
    voiceSpeed: settings?.voice_speed || "normal",
    elevenLabsVoiceId: settings?.elevenlabs_voice_id || null,
  };
}
// Look up caller in customers table to check if returning customer
async function getCallerInfo(supabase: any, businessId: string, callerPhone: string): Promise<{ name: string | null; totalVisits: number } | null> {
  const normalizedPhone = callerPhone.replace(/\D/g, "").slice(-10);
  
  try {
    const { data: customer } = await supabase
      .from("customers")
      .select("name, total_visits")
      .eq("business_id", businessId)
      .eq("is_blocked", false)
      .or(`phone.ilike.%${normalizedPhone}%,phone.eq.${callerPhone}`)
      .maybeSingle();
    
    if (customer) {
      console.log(`[TwilioWebhook] Found returning customer: ${customer.name}, visits: ${customer.total_visits}`);
      return { name: customer.name, totalVisits: customer.total_visits };
    }
    return null;
  } catch (error) {
    console.error("[TwilioWebhook] Error looking up caller:", error);
    return null;
  }
}

// Extract first name from full name
function getFirstName(fullName: string | null): string | null {
  if (!fullName) return null;
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName || null;
}

// Generate personalized casual greeting with recording disclosure
function generateGreeting(businessName: string, settings: any, callerInfo: { name: string | null; totalVisits: number } | null): string {
  const { assistantName } = settings;
  const firstName = getFirstName(callerInfo?.name || null);
  const isReturning = callerInfo && callerInfo.totalVisits > 0;
  
  if (isReturning && firstName) {
    // Returning customer with known name
    return `Hey ${firstName}! Great to hear from you again! Just a heads up, this call's recorded. What can I do for you today?`;
  } else if (isReturning) {
    // Returning customer but no name
    return `Hey there! Welcome back to ${businessName}! Just so you know, this call may be recorded. I'm ${assistantName}, how can I help?`;
  } else {
    // New caller
    return `Hey there! Thanks for calling ${businessName}! Just so you know, this call may be recorded. I'm ${assistantName}, how can I help you today?`;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Extract client IP for rate limiting and security logging
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("cf-connecting-ip") || 
                   "unknown";

  // Apply rate limiting
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", { provider: "twilio", clientIp });
    return new Response("Too Many Requests", { 
      status: 429, 
      headers: { 
        ...corsHeaders, 
        "Retry-After": "300",
        "X-RateLimit-Remaining": "0"
      } 
    });
  }

  try {
    // Extract token from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    console.log("[TwilioWebhook] Called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-voice-webhook") {
      console.error("[TwilioWebhook] No token provided in URL");
      return twimlError("This number is not configured correctly. Goodbye.");
    }

    // Parse Twilio parameters from request body
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Validate Twilio signature for security
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      
      // Build the webhook URL as Twilio sees it (the public URL, not internal)
      // Twilio sends requests to the configured webhook URL which uses the public Supabase functions URL
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const publicUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook/${token}`;
      
      console.log("[TwilioWebhook] Validating signature with URL:", publicUrl);
      
      const isValid = await validateTwilioSignature(twilioAuthToken, publicUrl, params, signature, clientIp);
      
      if (!isValid) {
        console.error("[TwilioWebhook] Invalid Twilio signature - request rejected");
        return twimlError("Security validation failed. Goodbye.");
      }
      
      console.log("[TwilioWebhook] Signature validated successfully");
    } else {
      logSecurityEvent("MISSING_AUTH_TOKEN", { provider: "twilio", clientIp });
      console.error("[TwilioWebhook] TWILIO_AUTH_TOKEN not configured - rejecting request for security");
      return twimlError("Security configuration error. Please contact support. Goodbye.");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const fromNumber = params.From || params.Caller || "";
    const toNumber = params.To || params.Called || "";
    const callSid = params.CallSid || "";
    const callerName = params.CallerName || null;

    console.log("[TwilioWebhook] Call details:", { from: fromNumber, to: toNumber, callSid });

    // Find business by webhook token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(`
        id,
        business_name,
        twilio_enabled,
        aivia_active
      `)
      .eq("twilio_webhook_token", token)
      .maybeSingle();

    if (businessError) {
      console.error("[TwilioWebhook] Database error finding business:", businessError);
      return twimlError("We are experiencing technical difficulties. Please try again later. Goodbye.");
    }

    if (!business) {
      console.error("[TwilioWebhook] No business found for token:", token?.substring(0, 8) + "...");
      return twimlError("This number is not configured in our system. Goodbye.");
    }

    console.log("[TwilioWebhook] Business found:", business.id, business.business_name);

    // Check if Twilio is enabled
    if (!business.twilio_enabled) {
      console.log(`[TwilioWebhook] Business ${business.business_name} has Twilio disabled`);
      return twimlError("This line is not currently active. Goodbye.");
    }

    // Check if Aivia is active
    if (!business.aivia_active) {
      console.log(`[TwilioWebhook] Business ${business.business_name} has Aivia inactive`);
      return twimlError(`Thank you for calling ${business.business_name}. We're currently unable to take calls. Please try again later. Goodbye.`);
    }

    // Check if caller is blocked
    const normalizedCaller = fromNumber.replace(/\D/g, "").slice(-10);
    const { data: blockedCustomer } = await supabase
      .from("customers")
      .select("id, name, is_blocked")
      .eq("business_id", business.id)
      .eq("is_blocked", true)
      .or(`phone.ilike.%${normalizedCaller}%,phone.eq.${fromNumber}`)
      .maybeSingle();

    if (blockedCustomer) {
      console.log(`[TwilioWebhook] Blocked caller detected: ${fromNumber} (Customer: ${blockedCustomer.name})`);
      return twimlError("I'm sorry, we're unable to take bookings from this number. If you believe this is an error, please contact the business directly. Goodbye.");
    }

    // Get business AI settings
    const aiSettings = await getBusinessAiVoiceSettings(supabase, business.id);
    
    // Determine which ElevenLabs voice to use
    const voiceId = aiSettings.elevenLabsVoiceId || DEFAULT_VOICES[aiSettings.voiceGender as keyof typeof DEFAULT_VOICES] || DEFAULT_VOICES.female;
    
    console.log("[TwilioWebhook] AI Settings:", aiSettings, "ElevenLabs Voice:", voiceId);

    // Log the call
    const { error: logError } = await supabase
      .from("calls_log")
      .insert({
        business_id: business.id,
        caller_phone: fromNumber,
        caller_name: callerName,
        call_type: "other",
        call_outcome: "in_progress",
        twilio_call_sid: callSid,
        to_number: toNumber,
        provider: "twilio",
      });

    if (logError) {
      console.error("[TwilioWebhook] Error logging call:", logError);
    }

    // Create conversation record
    const { error: convError } = await supabase
      .from("call_conversations")
      .insert({
        call_sid: callSid,
        business_id: business.id,
        caller_phone: fromNumber,
        caller_name: callerName,
        messages: [],
        status: "active",
      });

    if (convError) {
      console.error("[TwilioWebhook] Error creating conversation:", convError);
    }

    // Look up if this is a returning customer
    const callerInfo = await getCallerInfo(supabase, business.id, fromNumber);
    
    // Generate personalized greeting text
    const greetingText = generateGreeting(business.business_name, aiSettings, callerInfo);
    const gatherPromptText = ""; // Prompt is now included in the greeting

    // Build URLs
    const continueUrl = `${supabaseUrl}/functions/v1/twilio-voice-continue/${token}`;
    const recordingCallbackUrl = `${supabaseUrl}/functions/v1/twilio-recording-callback/${token}`;

    // Get dynamic speech hints including staff names and services
    const speechHints = await getBusinessSpeechHints(supabase, business.id);

    // Try to generate ElevenLabs audio
    const greetingAudioUrl = await generateAndUploadAudio(
      supabase, 
      greetingText, 
      voiceId, 
      callSid, 
      "greeting"
    );

    if (greetingAudioUrl) {
      console.log("[TwilioWebhook] Using ElevenLabs audio");
      
      // Also generate the gather prompt audio
      const gatherAudioUrl = await generateAndUploadAudio(
        supabase,
        gatherPromptText,
        voiceId,
        callSid,
        "gather"
      );
      
      return twimlGatherWithAudio(
        greetingAudioUrl,
        gatherAudioUrl,
        gatherPromptText,
        continueUrl,
        recordingCallbackUrl,
        speechHints,
        6
      );
    }

    // Fallback to Polly if ElevenLabs fails
    console.log("[TwilioWebhook] Falling back to Polly voice");
    const pollyVoice = aiSettings.voiceGender === "male" ? "Polly.Brian-Neural" : "Polly.Amy-Neural";
    
    return twimlGatherWithPolly(
      greetingText,
      gatherPromptText,
      continueUrl,
      recordingCallbackUrl,
      speechHints,
      pollyVoice,
      "108%",
      6
    );

  } catch (error) {
    console.error("[TwilioWebhook] Error:", error);
    return twimlError("We are experiencing technical difficulties. Please try again later. Goodbye.");
  }
});
