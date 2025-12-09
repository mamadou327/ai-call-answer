import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// Normalize phone number to E.164 format for comparison
function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let normalized = phone.replace(/[^\d+]/g, "");
  if (normalized.length > 10 && !normalized.startsWith("+")) {
    normalized = "+" + normalized;
  }
  return normalized;
}

// Compare two phone numbers after normalization
function phoneNumbersMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const norm1 = normalizePhoneNumber(phone1);
  const norm2 = normalizePhoneNumber(phone2);
  
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  
  const digits1 = norm1.replace(/^\+/, "");
  const digits2 = norm2.replace(/^\+/, "");
  
  if (digits1 === digits2) return true;
  
  const last10_1 = digits1.slice(-10);
  const last10_2 = digits2.slice(-10);
  
  if (last10_1.length >= 10 && last10_1 === last10_2) return true;
  
  return false;
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ElevenLabs voice mapping based on settings (fallback if no custom voice selected)
function getDefaultElevenLabsVoiceId(voiceGender: string): string {
  switch (voiceGender) {
    case "male":
      return "JBFqnCBsd6RMkjVDRZzb"; // George - warm and professional
    case "neutral":
      return "SAz9YHcvj6GT2YYXdXww"; // River - neutral/androgynous
    default:
      return "EXAVITQu4vr4xnSDxMaL"; // Sarah - warm and natural female voice
  }
}

// Generate audio using ElevenLabs TTS
async function generateElevenLabsAudio(
  text: string,
  voiceId: string
): Promise<ArrayBuffer | null> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    console.error("[ElevenLabs] API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2_5", // Fast, high quality, multilingual
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3, // Slight expressiveness for natural conversation
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ElevenLabs] API error:", response.status, errorText);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("[ElevenLabs] Error generating audio:", error);
    return null;
  }
}

// Upload audio to Supabase storage and get public URL
async function uploadAudioToStorage(
  supabase: any,
  audioBuffer: ArrayBuffer,
  fileName: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("call-recordings")
      .upload(`tts/${fileName}`, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (error) {
      console.error("[Storage] Upload error:", error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("call-recordings")
      .getPublicUrl(`tts/${fileName}`);

    return urlData?.publicUrl || null;
  } catch (error) {
    console.error("[Storage] Error uploading audio:", error);
    return null;
  }
}

// Get Polly voice as fallback
function getPollyVoice(voiceGender: string, primaryLanguage: string): string {
  if (primaryLanguage?.toLowerCase().includes("english")) {
    return voiceGender === "male" ? "Polly.Brian-Neural" : "Polly.Amy-Neural";
  }
  return voiceGender === "male" ? "Polly.Matthew-Neural" : "Polly.Joanna-Neural";
}

// Get speech rate based on settings
function getSpeechRate(voiceSpeed: string): string {
  switch (voiceSpeed) {
    case "slow": return "95%";
    case "fast": return "115%";
    default: return "108%";
  }
}

// Generate TwiML with ElevenLabs audio (Play) or fallback to Polly (Say)
function twimlGatherWithAudio(
  audioUrl: string | null,
  sayText: string,
  gatherPrompt: string,
  gatherAudioUrl: string | null,
  actionUrl: string,
  recordingCallbackUrl: string,
  fallbackVoice: string,
  rate: string = "108%",
  timeout: number = 6
): Response {
  let playOrSay1 = audioUrl 
    ? `<Play>${audioUrl}</Play>`
    : `<Say voice="${fallbackVoice}" language="en-GB"><prosody rate="${rate}">${escapeXml(sayText)}</prosody></Say>`;
  
  let playOrSay2 = gatherAudioUrl
    ? `<Play>${gatherAudioUrl}</Play>`
    : `<Say voice="${fallbackVoice}" language="en-GB"><prosody rate="${rate}">${escapeXml(gatherPrompt)}</prosody></Say>`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Record recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST"/>
  </Start>
  ${playOrSay1}
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="auto" language="en-GB">
    ${playOrSay2}
  </Gather>
  <Say voice="${fallbackVoice}" language="en-GB"><prosody rate="${rate}">I didn't hear anything. Please call back if you need assistance. Goodbye.</prosody></Say>
  <Hangup/>
</Response>`;
  
  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

// Simple error TwiML
function twimlError(message: string, voice: string = "Polly.Amy-Neural", rate: string = "108%"): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-GB"><prosody rate="${rate}">${escapeXml(message)}</prosody></Say>
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio parameters from request body
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

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
        aivia_active,
        assigned_aivia_number,
        twilio_phone_number
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
    const fallbackVoice = getPollyVoice(aiSettings.voiceGender, aiSettings.primaryLanguage);
    const rate = getSpeechRate(aiSettings.voiceSpeed);
    // Use custom voice ID if set, otherwise fall back to default based on gender
    const elevenLabsVoiceId = aiSettings.elevenLabsVoiceId || getDefaultElevenLabsVoiceId(aiSettings.voiceGender);
    
    console.log("[TwilioWebhook] AI Settings:", aiSettings, "ElevenLabs Voice:", elevenLabsVoiceId);

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

    // Try to generate ElevenLabs audio for more natural voice
    let greetingAudioUrl: string | null = null;
    let gatherAudioUrl: string | null = null;
    
    const elevenlabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (elevenlabsKey) {
      console.log("[TwilioWebhook] Generating ElevenLabs audio...");
      
      // Generate audio for greeting and gather prompt in parallel
      const [greetingAudio, gatherAudio] = await Promise.all([
        generateElevenLabsAudio(greetingText, elevenLabsVoiceId),
        generateElevenLabsAudio(gatherPromptText, elevenLabsVoiceId),
      ]);

      if (greetingAudio) {
        const greetingFileName = `greeting_${callSid}_${Date.now()}.mp3`;
        greetingAudioUrl = await uploadAudioToStorage(supabase, greetingAudio, greetingFileName);
        console.log("[TwilioWebhook] Greeting audio URL:", greetingAudioUrl ? "generated" : "failed");
      }

      if (gatherAudio) {
        const gatherFileName = `gather_${callSid}_${Date.now()}.mp3`;
        gatherAudioUrl = await uploadAudioToStorage(supabase, gatherAudio, gatherFileName);
        console.log("[TwilioWebhook] Gather audio URL:", gatherAudioUrl ? "generated" : "failed");
      }
    } else {
      console.log("[TwilioWebhook] ElevenLabs API key not set, using Polly fallback");
    }

    console.log("[TwilioWebhook] Returning TwiML with", greetingAudioUrl ? "ElevenLabs" : "Polly", "voice");

    // Return TwiML with ElevenLabs audio or Polly fallback
    return twimlGatherWithAudio(
      greetingAudioUrl,
      greetingText,
      gatherPromptText,
      gatherAudioUrl,
      continueUrl,
      recordingCallbackUrl,
      fallbackVoice,
      rate,
      6
    );

  } catch (error) {
    console.error("[TwilioWebhook] Error:", error);
    return twimlError("We are experiencing technical difficulties. Please try again later. Goodbye.");
  }
});
