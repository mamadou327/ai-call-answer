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

// Get Polly voice based on settings - using neural voices for natural UK sound
function getPollyVoice(voiceGender: string, primaryLanguage: string): string {
  // UK English neural voices
  if (primaryLanguage?.toLowerCase().includes("english")) {
    return voiceGender === "male" ? "Polly.Brian-Neural" : "Polly.Amy-Neural";
  }
  // US English neural voices as fallback
  return voiceGender === "male" ? "Polly.Matthew-Neural" : "Polly.Joanna-Neural";
}

// Generate TwiML response with Gather for speech input - using en-GB for UK
function twimlGather(
  sayText: string,
  gatherPrompt: string,
  actionUrl: string,
  voice: string,
  timeout: number = 6
): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="en-GB">${escapeXml(sayText)}</Say>
  <Gather input="speech" action="${actionUrl}" method="POST" timeout="${timeout}" speechTimeout="auto" language="en-GB">
    <Say voice="${voice}" language="en-GB">${escapeXml(gatherPrompt)}</Say>
  </Gather>
  <Say voice="${voice}" language="en-GB">I didn't hear anything. Please call back if you need assistance. Goodbye.</Say>
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
      return `Good day. Thank you for calling ${businessName}. My name is ${assistantName}, your virtual receptionist.`;
    case "casual":
      return `Hey there! Thanks for calling ${businessName}! I'm ${assistantName}, your AI assistant.`;
    default:
      return `Hi, thanks for calling ${businessName}. I'm ${assistantName}, your AI receptionist.`;
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
      return twimlError(`Thank you for calling ${business.business_name}. Our AI assistant is currently unavailable. Please try again later. Goodbye.`);
    }

    // Get business AI settings
    const aiSettings = await getBusinessAiVoiceSettings(supabase, business.id);
    const voice = getPollyVoice(aiSettings.voiceGender, aiSettings.primaryLanguage);
    console.log("[TwilioWebhook] AI Settings:", aiSettings, "Voice:", voice);

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

    // Generate greeting
    const greeting = generateGreeting(business.business_name, aiSettings);
    
    // Build the continue URL
    const continueUrl = `${supabaseUrl}/functions/v1/twilio-voice-continue/${token}`;

    console.log("[TwilioWebhook] Returning greeting with Gather, continue URL:", continueUrl);

    // Return TwiML with greeting and Gather
    return twimlGather(
      greeting,
      "How can I help you today?",
      continueUrl,
      voice,
      6
    );

  } catch (error) {
    console.error("[TwilioWebhook] Error:", error);
    return twimlError("We are experiencing technical difficulties. Please try again later. Goodbye.");
  }
});
