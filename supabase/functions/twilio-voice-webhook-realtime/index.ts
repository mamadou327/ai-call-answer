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
      console.warn(`[VoiceWebhookRT] Rate limit: IP ${clientIp} is blocked`);
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
    console.warn(`[VoiceWebhookRT] Rate limit exceeded for IP ${clientIp}, blocking for 5 minutes`);
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function twimlError(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">${escapeXml(message)}</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml, {
    headers: { ...corsHeaders, "Content-Type": "text/xml" },
  });
}

Deno.serve(async (req) => {
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
    return twimlError("Too many requests. Please try again later.");
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    console.log("[VoiceWebhookRT] Called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-voice-webhook-realtime") {
      return twimlError("This number is not configured correctly. Goodbye.");
    }

    // Parse Twilio parameters
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate Twilio signature for security
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      const publicUrl = `${supabaseUrl}/functions/v1/twilio-voice-webhook-realtime/${token}`;
      
      console.log("[VoiceWebhookRT] Validating signature with URL:", publicUrl);
      
      const isValid = await validateTwilioSignature(twilioAuthToken, publicUrl, params, signature, clientIp);
      
      if (!isValid) {
        console.error("[VoiceWebhookRT] Invalid Twilio signature - request rejected");
        return twimlError("Security validation failed. Goodbye.");
      }
      
      console.log("[VoiceWebhookRT] Signature validated successfully");
    } else {
      logSecurityEvent("MISSING_AUTH_TOKEN", { provider: "twilio", clientIp });
      console.warn("[VoiceWebhookRT] TWILIO_AUTH_TOKEN not configured - skipping signature validation");
    }

    const fromNumber = params.From || params.Caller || "";
    const toNumber = params.To || params.Called || "";
    const callSid = params.CallSid || "";
    const callerName = params.CallerName || null;

    console.log("[VoiceWebhookRT] Call details:", { from: fromNumber, to: toNumber, callSid });

    // Find business by webhook token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, twilio_enabled, aivia_active")
      .eq("twilio_webhook_token", token)
      .maybeSingle();

    if (businessError || !business) {
      console.error("[VoiceWebhookRT] Business not found");
      return twimlError("This number is not configured. Goodbye.");
    }

    if (!business.twilio_enabled || !business.aivia_active) {
      return twimlError(`Thank you for calling ${business.business_name}. We're currently unavailable. Please try again later.`);
    }

    // Check if caller is blocked AND look up customer info
    const normalizedCaller = fromNumber.replace(/\D/g, "").slice(-10);
    const { data: blockedCustomer } = await supabase
      .from("customers")
      .select("id, is_blocked")
      .eq("business_id", business.id)
      .eq("is_blocked", true)
      .or(`phone.ilike.%${normalizedCaller}%,phone.eq.${fromNumber}`)
      .maybeSingle();

    if (blockedCustomer) {
      console.log("[VoiceWebhookRT] Blocked caller:", fromNumber);
      return twimlError("I'm sorry, we're unable to take bookings from this number. Goodbye.");
    }

    // Look up if this is a returning customer (for personalized greeting in media stream)
    const { data: customerInfo } = await supabase
      .from("customers")
      .select("name, total_visits")
      .eq("business_id", business.id)
      .eq("is_blocked", false)
      .or(`phone.ilike.%${normalizedCaller}%,phone.eq.${fromNumber}`)
      .maybeSingle();

    const isReturning = customerInfo && customerInfo.total_visits > 0;
    const customerFirstName = customerInfo?.name?.trim().split(/\s+/)[0] || null;

    console.log("[VoiceWebhookRT] Customer lookup:", { isReturning, customerFirstName, totalVisits: customerInfo?.total_visits });

    // Log the call
    await supabase.from("calls_log").insert({
      business_id: business.id,
      caller_phone: fromNumber,
      caller_name: callerName || customerInfo?.name,
      call_type: "other",
      call_outcome: "in_progress",
      twilio_call_sid: callSid,
      to_number: toNumber,
      provider: "twilio",
    });

    // Create conversation record
    await supabase.from("call_conversations").insert({
      call_sid: callSid,
      business_id: business.id,
      caller_phone: fromNumber,
      caller_name: callerName || customerInfo?.name,
      messages: [],
      status: "active",
    });

    // Build Media Stream URL
    const mediaStreamUrl = `wss://${new URL(supabaseUrl).hostname}/functions/v1/twilio-media-stream/${token}`;

    // Build action URL for when stream ends (used for transfers and reconnects)
    // Start with reconnect=0 so reconnect logic can increment
    const streamActionUrl = `${supabaseUrl}/functions/v1/twilio-stream-action/${token}?callSid=${encodeURIComponent(callSid)}&from=${encodeURIComponent(fromNumber)}&reconnect=0`;

    // Recording callback URL (stores recording in backend storage and links it to calls_log)
    const recordingCallbackUrl = `${supabaseUrl}/functions/v1/twilio-recording-callback/${token}`;

    console.log("[VoiceWebhookRT] Starting media stream to:", mediaStreamUrl);

    // Return TwiML with Media Stream - the action URL is called when the stream ends
    // Pass recordingCallbackUrl so twilio-media-stream can start recording when call is in-progress
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy-Neural" language="en-GB">This call may be recorded for quality and training purposes.</Say>
  <Connect action="${escapeXml(streamActionUrl)}">
    <Stream url="${escapeXml(mediaStreamUrl)}">
      <Parameter name="callerPhone" value="${escapeXml(fromNumber)}"/>
      <Parameter name="callSid" value="${escapeXml(callSid)}"/>
      <Parameter name="recordingCallbackUrl" value="${escapeXml(recordingCallbackUrl)}"/>
      <Parameter name="isReturning" value="${isReturning ? 'true' : 'false'}"/>
      <Parameter name="customerFirstName" value="${escapeXml(customerFirstName || '')}"/>
    </Stream>
  </Connect>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, "Content-Type": "text/xml" },
    });

  } catch (error) {
    console.error("[VoiceWebhookRT] Error:", error);
    return twimlError("We're experiencing technical difficulties. Please try again later.");
  }
});
