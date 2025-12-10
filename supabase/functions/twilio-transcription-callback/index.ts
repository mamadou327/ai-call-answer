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
    console.error("[TranscriptionCallback] No X-Twilio-Signature header provided");
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
      console.error("[TranscriptionCallback] Signature mismatch");
    }
    return isValid;
  } catch (error) {
    console.error("[TranscriptionCallback] Error validating signature:", error);
    return false;
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

    console.log("[TranscriptionCallback] Called with token:", token?.substring(0, 8) + "...");

    if (!token || token === "twilio-transcription-callback") {
      console.error("[TranscriptionCallback] No token provided");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Parse Twilio parameters from request body
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = value.toString();
    }

    // Validate Twilio signature
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (twilioAuthToken) {
      const signature = req.headers.get("x-twilio-signature");
      const fullUrl = req.url;
      
      const isValid = await validateTwilioSignature(twilioAuthToken, fullUrl, params, signature);
      if (!isValid) {
        console.error("[TranscriptionCallback] Invalid Twilio signature - rejecting request");
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
      console.log("[TranscriptionCallback] Twilio signature validated successfully");
    } else {
      console.warn("[TranscriptionCallback] TWILIO_AUTH_TOKEN not set - skipping signature validation");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const callSid = params.CallSid || "";
    const recordingSid = params.RecordingSid || "";
    const transcriptionSid = params.TranscriptionSid || "";
    const transcriptionText = params.TranscriptionText || "";
    const transcriptionStatus = params.TranscriptionStatus || "";

    console.log("[TranscriptionCallback] Transcription details:", {
      callSid,
      recordingSid,
      transcriptionSid,
      transcriptionStatus,
      textLength: transcriptionText.length,
    });

    if (transcriptionStatus !== "completed" || !transcriptionText) {
      console.log("[TranscriptionCallback] Transcription not completed or empty, skipping");
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Find business by webhook token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("twilio_webhook_token", token)
      .maybeSingle();

    if (businessError || !business) {
      console.error("[TranscriptionCallback] Business not found:", businessError);
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // Update the call log with the transcription
    const { error: updateError } = await supabase
      .from("calls_log")
      .update({
        transcription: transcriptionText,
      })
      .eq("twilio_call_sid", callSid)
      .eq("business_id", business.id);

    if (updateError) {
      console.error("[TranscriptionCallback] Error updating call log:", updateError);
    } else {
      console.log("[TranscriptionCallback] Call log updated with transcription");
    }

    return new Response("OK", { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("[TranscriptionCallback] Error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});
