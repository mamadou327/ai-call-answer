import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
      console.warn(`[twilio-sms-webhook] Rate limit: IP ${clientIp} is blocked`);
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
    console.warn(`[twilio-sms-webhook] Rate limit exceeded for IP ${clientIp}, blocking for 5 minutes`);
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

serve(async (req: Request): Promise<Response> => {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("[twilio-sms-webhook] Twilio credentials not configured");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Extract token from URL path (like voice webhook does)
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const token = pathParts[pathParts.length - 1];

    console.log(`[twilio-sms-webhook] Received request with token: ${token}`);

    if (!token || token === "twilio-sms-webhook") {
      console.error("[twilio-sms-webhook] No business token provided in URL path");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Parse incoming Twilio SMS webhook (form data)
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Validate Twilio signature for security
    const signature = req.headers.get("x-twilio-signature");
    const publicUrl = `${supabaseUrl}/functions/v1/twilio-sms-webhook/${token}`;
    
    console.log("[twilio-sms-webhook] Validating signature with URL:", publicUrl);
    
    const isValid = await validateTwilioSignature(twilioAuthToken, publicUrl, params, signature, clientIp);
    
    if (!isValid) {
      console.error("[twilio-sms-webhook] Invalid Twilio signature - request rejected");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }
    
    console.log("[twilio-sms-webhook] Signature validated successfully");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const from = params.From || "";
    const to = params.To || "";
    const body = (params.Body || "").trim().toUpperCase();

    console.log(`[twilio-sms-webhook] Received SMS from ${from} to ${to}: "${body}"`);

    // Check if message is requesting policies
    if (body !== "POLICIES" && body !== "POLICY") {
      console.log("[twilio-sms-webhook] Message is not a POLICIES request, ignoring");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    // Find business by webhook token (like voice webhook does)
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, business_name, twilio_phone_number, main_phone, twilio_enabled")
      .eq("twilio_webhook_token", token)
      .eq("twilio_enabled", true)
      .single();

    if (businessError || !business) {
      console.error("[twilio-sms-webhook] Business not found for token:", token, businessError);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { "Content-Type": "text/xml" } }
      );
    }

    console.log(`[twilio-sms-webhook] Found business: ${business.business_name} (${business.id})`);

    // Fetch business settings for policy info
    const { data: settings } = await supabase
      .from("business_settings")
      .select("min_cancellation_notice_hours, min_reschedule_notice_hours, min_booking_notice_hours, max_days_advance, cancellation_policy")
      .eq("business_id", business.id)
      .single();

    // Build context for AI to generate a friendly response
    let policyContext = `Business Name: ${business.business_name}\n`;
    
    if (settings) {
      if (settings.min_booking_notice_hours) {
        policyContext += `Minimum booking notice: ${settings.min_booking_notice_hours} hours\n`;
      }
      if (settings.max_days_advance) {
        policyContext += `Maximum advance booking: ${settings.max_days_advance} days\n`;
      }
      if (settings.min_cancellation_notice_hours) {
        policyContext += `Minimum cancellation notice: ${settings.min_cancellation_notice_hours} hours\n`;
      }
      if (settings.min_reschedule_notice_hours) {
        policyContext += `Minimum reschedule notice: ${settings.min_reschedule_notice_hours} hours\n`;
      }
      if (settings.cancellation_policy) {
        policyContext += `Full cancellation policy: ${settings.cancellation_policy}\n`;
      }
    }

    let policyMessage: string;

    // Use AI to generate a friendly, concise response if OpenAI is available
    if (openaiApiKey && settings) {
      try {
        console.log("[twilio-sms-webhook] Generating AI-powered policy response");
        
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `You are a friendly SMS assistant for a business. A customer texted "POLICIES" to learn about booking rules.

Your job is to summarize the business policies in a SHORT, friendly SMS format (max 320 characters).

Rules:
- Use emojis to make it scannable (📋, ⏰, 🔄, ❌, 💰)
- Be concise - this is SMS, not email
- Lead with the business name
- Explain each policy simply (no jargon)
- End with "Questions? Call us!" if there's room
- DO NOT repeat yourself
- DO NOT include the phone number in the response (they already have it)`
              },
              {
                role: "user",
                content: `Here are the policies to summarize:\n\n${policyContext}`
              }
            ],
            max_tokens: 150,
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          policyMessage = aiData.choices?.[0]?.message?.content || "";
          console.log("[twilio-sms-webhook] AI generated response:", policyMessage);
        } else {
          console.error("[twilio-sms-webhook] OpenAI API error:", await aiResponse.text());
          policyMessage = buildFallbackMessage(business.business_name, settings, business.main_phone);
        }
      } catch (aiError) {
        console.error("[twilio-sms-webhook] AI generation failed:", aiError);
        policyMessage = buildFallbackMessage(business.business_name, settings, business.main_phone);
      }
    } else {
      // Fallback to manual formatting if no OpenAI key or no settings
      policyMessage = buildFallbackMessage(business.business_name, settings, business.main_phone);
    }

    // Send SMS reply via Twilio
    console.log(`[twilio-sms-webhook] Sending policy SMS to ${from}`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const smsFormData = new URLSearchParams();
    smsFormData.append("To", from);
    smsFormData.append("From", to);
    smsFormData.append("Body", policyMessage);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: smsFormData.toString(),
    });

    const responseData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("[twilio-sms-webhook] Twilio API error:", responseData);
    } else {
      console.log(`[twilio-sms-webhook] Policy SMS sent successfully:`, responseData.sid);
    }

    // Return empty TwiML response
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );

  } catch (error: any) {
    console.error("[twilio-sms-webhook] Error:", error);
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { "Content-Type": "text/xml" } }
    );
  }
});

// Fallback message builder when AI is not available
function buildFallbackMessage(businessName: string, settings: any, mainPhone: string): string {
  let message = `📋 ${businessName} Policies\n\n`;

  if (settings) {
    const policies: string[] = [];

    if (settings.min_booking_notice_hours) {
      policies.push(`⏰ Book ${settings.min_booking_notice_hours}h+ ahead`);
    }

    if (settings.max_days_advance) {
      policies.push(`📅 Up to ${settings.max_days_advance} days advance`);
    }

    if (settings.min_cancellation_notice_hours) {
      policies.push(`❌ Cancel ${settings.min_cancellation_notice_hours}h+ notice`);
    }

    if (settings.min_reschedule_notice_hours) {
      policies.push(`🔄 Reschedule ${settings.min_reschedule_notice_hours}h+ notice`);
    }

    if (policies.length > 0) {
      message += policies.join("\n") + "\n\n";
    }
  } else {
    message += "Contact us for policy details.\n\n";
  }

  message += `Questions? Call ${mainPhone}`;

  return message;
}
