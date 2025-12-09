import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

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
