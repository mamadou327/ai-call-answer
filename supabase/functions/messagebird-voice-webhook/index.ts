import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, messagebird-signature, messagebird-request-timestamp",
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
      console.warn(`[MessageBirdWebhook] Rate limit: IP ${clientIp} is blocked`);
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
    console.warn(`[MessageBirdWebhook] Rate limit exceeded for IP ${clientIp}, blocking for 5 minutes`);
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

// MessageBird signature validation using Web Crypto API
async function validateMessageBirdSignature(
  signingKey: string,
  signature: string,
  timestamp: string,
  body: string,
  clientIp: string
): Promise<boolean> {
  try {
    if (!signingKey || !signature || !timestamp) {
      logSecurityEvent("MISSING_SIGNATURE", { provider: "messagebird", clientIp, hasSigningKey: !!signingKey, hasSignature: !!signature, hasTimestamp: !!timestamp });
      return false;
    }
    
    // MessageBird signature format: timestamp.body
    const payload = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(signingKey),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const hashBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
    const computedSignature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const isValid = computedSignature === signature;
    if (!isValid) {
      logSecurityEvent("INVALID_SIGNATURE", { 
        provider: "messagebird", 
        clientIp,
        receivedSignaturePrefix: signature.substring(0, 10) + "..."
      });
    }
    return isValid;
  } catch (error) {
    logSecurityEvent("SIGNATURE_VALIDATION_ERROR", { provider: "messagebird", clientIp, error: String(error) });
    return false;
  }
}

// Generate JSON response for Flow Builder
function jsonResponse(greeting: string, businessName: string, aiEnabled: boolean, status: number = 200): Response {
  return new Response(
    JSON.stringify({
      greeting,
      businessName,
      aiEnabled,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
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

  // Extract client IP for rate limiting and security logging
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("cf-connecting-ip") || 
                   "unknown";

  // Apply rate limiting
  const rateLimit = checkRateLimit(clientIp);
  if (!rateLimit.allowed) {
    logSecurityEvent("RATE_LIMIT_EXCEEDED", { provider: "messagebird", clientIp });
    return new Response(JSON.stringify({ error: "Too Many Requests" }), { 
      status: 429, 
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
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

    console.log("MessageBird webhook called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "messagebird-voice-webhook") {
      console.error("No token provided in URL");
      return jsonResponse("This number is not configured correctly. Goodbye.", "", false);
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find business by messagebird token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(`
        id,
        business_name,
        messagebird_enabled,
        aivia_active,
        assigned_aivia_number,
        messagebird_phone_number
      `)
      .eq("messagebird_token", token)
      .maybeSingle();

    if (businessError) {
      console.error("Database error finding business:", businessError);
      return jsonResponse("We are experiencing technical difficulties. Please try again later. Goodbye.", "", false);
    }

    if (!business) {
      console.error("Business not found for token");
      return jsonResponse("This number is not configured in Aivia. Goodbye.", "", false);
    }

    console.log("Found business:", business.id, business.business_name);

    if (!business.messagebird_enabled) {
      console.log("MessageBird disabled for business:", business.id);
      return jsonResponse("This Aivia line is not currently active. Goodbye.", business.business_name, false);
    }

    // Parse MessageBird parameters from query params or body
    const fromNumber = url.searchParams.get("source") || url.searchParams.get("from") || "";
    const toNumber = url.searchParams.get("destination") || url.searchParams.get("to") || business.messagebird_phone_number || "";
    const callId = url.searchParams.get("callId") || url.searchParams.get("id") || "";
    const callerName = url.searchParams.get("callerName") || null;

    // For POST requests, try to parse body and verify signature
    let bodyText = "";
    if (req.method === "POST") {
      bodyText = await req.text();
      
      // Verify MessageBird signature if API key is available
      const messageBirdApiKey = Deno.env.get("MESSAGEBIRD_API_KEY");
      const signature = req.headers.get("messagebird-signature");
      const timestamp = req.headers.get("messagebird-request-timestamp");
      
      if (!messageBirdApiKey) {
        logSecurityEvent("MISSING_AUTH_TOKEN", { provider: "messagebird", clientIp });
        console.error("MESSAGEBIRD_API_KEY not configured - rejecting request for security");
        return jsonResponse("Security configuration error. Please contact support. Goodbye.", "", false);
      }
      
      if (signature && timestamp) {
        const isValid = await validateMessageBirdSignature(
          messageBirdApiKey,
          signature,
          timestamp,
          bodyText,
          clientIp
        );
        
        if (!isValid) {
          console.error("Invalid MessageBird signature - request rejected as potentially forged");
          return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          console.log("MessageBird signature validated successfully");
        }
      } else {
        logSecurityEvent("MISSING_SIGNATURE", { provider: "messagebird", clientIp, hasSignature: !!signature, hasTimestamp: !!timestamp });
        console.error("Missing MessageBird signature headers - rejecting request");
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Incoming MessageBird call:", {
      businessId: business.id,
      businessName: business.business_name,
      from: fromNumber,
      to: toNumber,
      callId,
    });

    // Get business AI settings
    const aiSettings = await getBusinessAiVoiceSettings(supabase, business.id);
    console.log("AI Settings:", aiSettings);

    // Log the call with provider = messagebird
    const { error: logError } = await supabase
      .from("calls_log")
      .insert({
        business_id: business.id,
        caller_phone: fromNumber || "unknown",
        caller_name: callerName,
        call_type: "other",
        call_outcome: "received",
        to_number: toNumber,
        provider: "messagebird",
      });

    if (logError) {
      console.error("Error logging call:", logError);
    } else {
      console.log("Call logged successfully");
    }

    // Generate greeting based on AI settings
    const aiEnabled = business.aivia_active;
    let greeting: string;
    
    if (aiEnabled) {
      greeting = generateGreeting(business.business_name, aiSettings);
    } else {
      greeting = `Thank you for calling ${business.business_name}. Our AI assistant is currently unavailable. Please try again later or leave a message. Goodbye.`;
    }

    return jsonResponse(greeting, business.business_name, aiEnabled);

  } catch (error) {
    console.error("Error processing MessageBird webhook:", error);
    return jsonResponse("We are experiencing technical difficulties. Please try again later. Goodbye.", "", false);
  }
});
