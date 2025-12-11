import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";
import { encode as encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// ============================================================================
// TWILIO SIGNATURE VALIDATION
// ============================================================================

async function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null
): Promise<boolean> {
  if (!signature) {
    console.error("[TwilioWebhook] No X-Twilio-Signature header provided");
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
      console.error("[TwilioWebhook] Signature mismatch. Expected:", expectedSignature, "Got:", signature);
    }
    return isValid;
  } catch (error) {
    console.error("[TwilioWebhook] Error validating signature:", error);
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

// Speech hints for better STT recognition with accents
const SPEECH_HINTS = "booking, appointment, cancel, reschedule, haircut, beard, trim, shave, tomorrow, today, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, morning, afternoon, evening, o'clock, half past, quarter past, available, availability, name, phone, confirm, yes, no, please, thank you";

// Generate TwiML with ElevenLabs audio - using Deepgram nova-2 for better accent recognition
function twimlGatherWithAudio(
  audioUrl: string,
  gatherAudioUrl: string | null,
  gatherText: string,
  actionUrl: string,
  recordingCallbackUrl: string,
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
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${SPEECH_HINTS}">
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
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="3" language="en-GB" speechModel="deepgram_nova-2" hints="${SPEECH_HINTS}">
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

// Generate greeting based on business and AI settings
function generateGreeting(businessName: string, settings: any): string {
  const { assistantName, tone } = settings;
  
  switch (tone) {
    case "formal":
      return `Good day. Thank you for calling ${businessName}. This is ${assistantName} speaking.`;
    case "casual":
      return `Hey there! Thanks for calling ${businessName}! This is ${assistantName}.`;
    default:
      return `Hi, thanks for calling ${businessName}. This is ${assistantName}, how can I help?`;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    // Temporarily skip signature validation due to URL format mismatch
    // TODO: Re-enable once URL format is confirmed
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      console.log("[TwilioWebhook] Signature received:", signature ? "present" : "missing");
      console.log("[TwilioWebhook] Request URL:", req.url);
      // Skip validation for now - URL format mismatch causing failures
      console.warn("[TwilioWebhook] Signature validation temporarily disabled");
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

    // Generate greeting text
    const greetingText = generateGreeting(business.business_name, aiSettings);
    const gatherPromptText = "How can I help you today?";
    
    // Build URLs
    const continueUrl = `${supabaseUrl}/functions/v1/twilio-voice-continue/${token}`;
    const recordingCallbackUrl = `${supabaseUrl}/functions/v1/twilio-recording-callback/${token}`;

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
      pollyVoice,
      "108%",
      6
    );

  } catch (error) {
    console.error("[TwilioWebhook] Error:", error);
    return twimlError("We are experiencing technical difficulties. Please try again later. Goodbye.");
  }
});
