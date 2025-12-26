import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TRUELAYER-CONNECT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get the auth token from the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, clientId, clientSecret, businessId } = await req.json();

    logStep("Request received", { action, businessId, userId: user.id });

    // Verify user owns the business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_id, truelayer_client_id, truelayer_connected_at")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .single();

    if (businessError || !business) {
      return new Response(
        JSON.stringify({ error: "Business not found or unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "connect") {
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ error: "Client ID and Client Secret are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Determine if this is a sandbox client (sandbox client IDs often contain specific patterns)
      // TrueLayer sandbox uses different endpoints
      const isSandbox = clientId.includes("sandbox") || clientId.includes("ede904") || !clientId.startsWith("live-");
      const authUrl = isSandbox 
        ? "https://auth.truelayer-sandbox.com/connect/token"
        : "https://auth.truelayer.com/connect/token";

      logStep("Validating credentials", { isSandbox, authUrl });

      // Validate credentials by making a test request to TrueLayer
      try {
        const tokenResponse = await fetch(authUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
            scope: "payments",
          }),
        });

        const responseText = await tokenResponse.text();
        logStep("TrueLayer auth response", { status: tokenResponse.status, response: responseText });

        if (!tokenResponse.ok) {
          let errorMessage = "Invalid TrueLayer credentials. Please check your Client ID and Secret.";
          
          try {
            const errorData = JSON.parse(responseText);
            if (errorData.error === "invalid_client") {
              errorMessage = "Invalid Client ID or Secret. Make sure you're using the correct credentials from your TrueLayer Console.";
            } else if (errorData.error === "invalid_scope") {
              errorMessage = "Your TrueLayer application doesn't have payment permissions. Please check your TrueLayer Console settings.";
            } else if (errorData.error_description) {
              errorMessage = errorData.error_description;
            }
          } catch {
            // Use default error message
          }
          
          return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStep("TrueLayer credentials validated successfully");
      } catch (validationError: any) {
        logStep("TrueLayer validation error", { error: validationError.message });
        return new Response(
          JSON.stringify({ error: "Failed to validate TrueLayer credentials" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store credentials in database
      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          truelayer_client_id: clientId,
          truelayer_client_secret: clientSecret,
          truelayer_connected_at: new Date().toISOString(),
        })
        .eq("id", businessId);

      if (updateError) {
        logStep("Failed to store credentials", { error: updateError });
        return new Response(
          JSON.stringify({ error: "Failed to save TrueLayer credentials" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logStep("TrueLayer connected successfully", { businessId });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "TrueLayer connected successfully",
          connectedAt: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      const { error: updateError } = await supabase
        .from("businesses")
        .update({
          truelayer_client_id: null,
          truelayer_client_secret: null,
          truelayer_connected_at: null,
          // Reset to Stripe if TrueLayer was the preferred provider
          preferred_payment_provider: "stripe",
        })
        .eq("id", businessId);

      if (updateError) {
        logStep("Failed to disconnect", { error: updateError });
        return new Response(
          JSON.stringify({ error: "Failed to disconnect TrueLayer" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logStep("TrueLayer disconnected successfully", { businessId });

      return new Response(
        JSON.stringify({ success: true, message: "TrueLayer disconnected successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error", { message: error?.message || String(error) });
    return new Response(
      JSON.stringify({ error: error?.message || "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
