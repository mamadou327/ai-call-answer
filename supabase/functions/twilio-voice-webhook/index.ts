import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Get Polly voice based on settings
// Note: Using Polly for speed - Twilio doesn't support data URIs and storage uploads add latency
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

// Generate TwiML with Polly voice (fast - no network upload needed)
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
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="auto" language="en-GB">
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
    .select("assistant_name, tone, primary_language, voice_gender, voice_speed")
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
    const pollyVoice = getPollyVoice(aiSettings.voiceGender, aiSettings.primaryLanguage);
    const rate = getSpeechRate(aiSettings.voiceSpeed);
    
    console.log("[TwilioWebhook] AI Settings:", aiSettings, "Polly Voice:", pollyVoice);

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

    console.log("[TwilioWebhook] Returning TwiML with Polly voice:", pollyVoice);

    // Return TwiML with Polly voice (fast - no ElevenLabs latency)
    return twimlGatherWithPolly(
      greetingText,
      gatherPromptText,
      continueUrl,
      recordingCallbackUrl,
      pollyVoice,
      rate,
      6
    );

  } catch (error) {
    console.error("[TwilioWebhook] Error:", error);
    return twimlError("We are experiencing technical difficulties. Please try again later. Goodbye.");
  }
});
