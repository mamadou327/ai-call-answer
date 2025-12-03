import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate TwiML response
function twimlResponse(message: string, hangup: boolean = true): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${message}</Say>
  ${hangup ? "<Hangup/>" : ""}
</Response>`;
  
  return new Response(twiml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/xml",
    },
  });
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

    if (!token || token === "twilio-voice-webhook") {
      return twimlResponse("This number is not configured correctly. Goodbye.");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find business by webhook token
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(`
        id,
        business_name,
        twilio_enabled,
        aivia_active,
        assigned_aivia_number
      `)
      .eq("twilio_webhook_token", token)
      .single();

    if (businessError || !business) {
      console.error("Business not found for token:", token);
      return twimlResponse("This number is not configured in Aivia. Goodbye.");
    }

    if (!business.twilio_enabled) {
      console.log("Twilio disabled for business:", business.id);
      return twimlResponse("This Aivia line is not currently active. Goodbye.");
    }

    // Parse Twilio parameters from request body
    const formData = await req.formData();
    const fromNumber = formData.get("From")?.toString() || "";
    const toNumber = formData.get("To")?.toString() || "";
    const callSid = formData.get("CallSid")?.toString() || "";
    const callerName = formData.get("CallerName")?.toString() || null;

    console.log("Incoming call:", {
      businessId: business.id,
      businessName: business.business_name,
      from: fromNumber,
      to: toNumber,
      callSid,
    });

    // Get business AI settings
    const { data: settings } = await supabase
      .from("business_settings")
      .select("assistant_name, tone, primary_language")
      .eq("business_id", business.id)
      .single();

    const assistantName = settings?.assistant_name || "Aivia";

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
      });

    if (logError) {
      console.error("Error logging call:", logError);
    }

    // Generate greeting based on AI settings
    let greeting: string;
    if (business.aivia_active) {
      greeting = `Hello! Thank you for calling ${business.business_name}. My name is ${assistantName}, your AI assistant. How may I help you today?`;
    } else {
      greeting = `Thank you for calling ${business.business_name}. Our AI assistant is currently unavailable. Please try again later or leave a message. Goodbye.`;
      return twimlResponse(greeting, true);
    }

    // Return TwiML with greeting (for now, just say the greeting and hang up)
    // Full AI streaming will be implemented later
    return twimlResponse(
      `${greeting} I apologize, but our full AI booking system is being set up. Please call back later or contact the business directly. Goodbye.`,
      true
    );

  } catch (error) {
    console.error("Error processing Twilio webhook:", error);
    return twimlResponse("We are experiencing technical difficulties. Please try again later. Goodbye.");
  }
});