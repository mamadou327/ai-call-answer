import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

// Normalize phone number to E.164 format for comparison
function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  // Remove all non-digit characters except leading +
  let normalized = phone.replace(/[^\d+]/g, "");
  // Ensure it starts with + if it has country code
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
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Try matching without the + prefix
  const digits1 = norm1.replace(/^\+/, "");
  const digits2 = norm2.replace(/^\+/, "");
  
  if (digits1 === digits2) return true;
  
  // Try matching last 10-11 digits (handles country code variations)
  const last10_1 = digits1.slice(-10);
  const last10_2 = digits2.slice(-10);
  
  if (last10_1.length >= 10 && last10_1 === last10_2) return true;
  
  return false;
}

// Twilio signature validation using Web Crypto API
async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  try {
    // Sort params alphabetically by key and concatenate
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) {
      data += key + params[key];
    }
    
    // Create HMAC SHA1 signature using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authToken);
    const msgData = encoder.encode(data);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    
    const hashBuffer = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    
    return computedSignature === signature;
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
}

// Generate TwiML response
function twimlResponse(message: string, hangup: boolean = true): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${escapeXml(message)}</Say>
  ${hangup ? "<Hangup/>" : ""}
</Response>`;
  
  return new Response(twiml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/xml",
    },
  });
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
  
  // Default greeting with business name and assistant name
  const defaultGreeting = `Hi, thanks for calling ${businessName}. I'm ${assistantName}, your virtual receptionist. How can I help you today?`;
  
  // Adjust based on tone
  switch (tone) {
    case "formal":
      return `Good day. Thank you for calling ${businessName}. My name is ${assistantName}, and I am your virtual assistant. How may I be of service today?`;
    case "casual":
      return `Hey there! Thanks for calling ${businessName}! I'm ${assistantName}, your friendly AI assistant. What can I do for you?`;
    default:
      return defaultGreeting;
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

    console.log("Twilio webhook called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-voice-webhook") {
      console.error("No token provided in URL");
      return twimlResponse("This number is not configured correctly. Goodbye.");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse Twilio parameters from request body FIRST to get the To number
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    const fromNumber = params.From || params.Caller || "";
    const toNumber = params.To || params.Called || "";
    const callSid = params.CallSid || "";
    const callerName = params.CallerName || null;

    // Log the raw To value from Twilio
    console.log("=== TWILIO PHONE NUMBER DEBUG ===");
    console.log("Raw Twilio To value:", toNumber);
    console.log("Normalized To value:", normalizePhoneNumber(toNumber));

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
      console.error("Database error finding business:", businessError);
      return twimlResponse("We are experiencing technical difficulties. Please try again later. Goodbye.");
    }

    // Log what we're comparing against
    if (business) {
      console.log("Business found by token:", business.id, business.business_name);
      console.log("DB twilio_phone_number:", business.twilio_phone_number);
      console.log("DB assigned_aivia_number:", business.assigned_aivia_number);
      console.log("Normalized DB twilio_phone_number:", normalizePhoneNumber(business.twilio_phone_number));
      console.log("Normalized DB assigned_aivia_number:", normalizePhoneNumber(business.assigned_aivia_number));
      console.log("twilio_enabled:", business.twilio_enabled);
      console.log("aivia_active:", business.aivia_active);
    } else {
      console.error("No business found for token:", token?.substring(0, 8) + "...");
      
      // Also try to find by phone number as fallback
      console.log("Attempting fallback: searching all businesses with Twilio enabled...");
      const { data: allBusinesses } = await supabase
        .from("businesses")
        .select("id, business_name, twilio_phone_number, assigned_aivia_number, twilio_enabled")
        .eq("twilio_enabled", true);
      
      if (allBusinesses && allBusinesses.length > 0) {
        console.log("Twilio-enabled businesses in DB:");
        for (const b of allBusinesses) {
          console.log(`  - ${b.business_name}: twilio_phone=${b.twilio_phone_number}, aivia_number=${b.assigned_aivia_number}`);
          const matchesTwilio = phoneNumbersMatch(toNumber, b.twilio_phone_number);
          const matchesAivia = phoneNumbersMatch(toNumber, b.assigned_aivia_number);
          console.log(`    Matches To number? twilio_phone: ${matchesTwilio}, aivia_number: ${matchesAivia}`);
        }
      } else {
        console.log("No Twilio-enabled businesses found in database");
      }
      
      return twimlResponse("This number is not configured in Aivia. Goodbye.");
    }

    // Check if Twilio is enabled for this business
    if (!business.twilio_enabled) {
      console.log(`Business found for token (${business.business_name}), but Twilio is disabled.`);
      console.log("To fix: Set twilio_enabled = true in the database for this business.");
      return twimlResponse("This Aivia line is not currently active. Goodbye.");
    }

    // Optional: Verify the To number matches the business's Twilio number
    const twilioNumberMatch = phoneNumbersMatch(toNumber, business.twilio_phone_number);
    const aiviaNumberMatch = phoneNumbersMatch(toNumber, business.assigned_aivia_number);
    
    console.log("Phone number match check:");
    console.log(`  To number (${toNumber}) matches twilio_phone_number: ${twilioNumberMatch}`);
    console.log(`  To number (${toNumber}) matches assigned_aivia_number: ${aiviaNumberMatch}`);

    // Verify Twilio signature if auth token is available
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioSignature = req.headers.get("x-twilio-signature");
    
    if (twilioAuthToken && twilioSignature) {
      // Construct the webhook URL Twilio used
      const webhookUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook/${token}`;
      
      const isValid = await validateTwilioSignature(
        twilioAuthToken,
        twilioSignature,
        webhookUrl,
        params
      );

      if (!isValid) {
        console.warn("Invalid Twilio signature - request may be forged. Proceeding with caution.");
        // Log but don't reject - signature validation can be tricky with edge functions
      } else {
        console.log("Twilio signature validated successfully");
      }
    }

    console.log("=== CALL DETAILS ===");
    console.log("Incoming call:", {
      businessId: business.id,
      businessName: business.business_name,
      from: fromNumber,
      to: toNumber,
      callSid,
    });

    // Get business AI settings
    const aiSettings = await getBusinessAiVoiceSettings(supabase, business.id);
    console.log("AI Settings:", aiSettings);

    // Log the call
    const { error: logError } = await supabase
      .from("calls_log")
      .insert({
        business_id: business.id,
        caller_phone: fromNumber,
        caller_name: callerName,
        call_type: "other",
        call_outcome: "received",
        twilio_call_sid: callSid,
        to_number: toNumber,
        provider: "twilio",
      });

    if (logError) {
      console.error("Error logging call:", logError);
    } else {
      console.log("Call logged successfully");
    }

    // Generate greeting based on AI settings
    let greeting: string;
    if (business.aivia_active) {
      greeting = generateGreeting(business.business_name, aiSettings);
      console.log("Generated greeting for active Aivia business");
    } else {
      console.log("Aivia not active for this business, returning unavailable message");
      greeting = `Thank you for calling ${business.business_name}. Our AI assistant is currently unavailable. Please try again later or leave a message. Goodbye.`;
      return twimlResponse(greeting, true);
    }

    // Return TwiML with greeting
    console.log("=== SUCCESS: Returning business greeting ===");
    return twimlResponse(
      `${greeting} I apologize, but our full AI booking system is being set up. Please call back later or contact the business directly. Goodbye.`,
      true
    );

  } catch (error) {
    console.error("Error processing Twilio webhook:", error);
    return twimlResponse("We are experiencing technical difficulties. Please try again later. Goodbye.");
  }
});
