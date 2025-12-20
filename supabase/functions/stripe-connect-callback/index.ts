import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[stripe-connect-callback] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripeClientId = Deno.env.get("STRIPE_CLIENT_ID");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!stripeClientId) throw new Error("STRIPE_CLIENT_ID is not set");
    logStep("Stripe keys verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { code, state } = await req.json();
    if (!code) throw new Error("No authorization code provided");
    if (!state) throw new Error("No state provided");
    logStep("Received callback", { code: code.substring(0, 10) + "...", state });

    // Decode state to get businessId
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      throw new Error("Invalid state parameter");
    }
    const { businessId, userId } = stateData;
    if (!businessId || !userId) throw new Error("Invalid state data");
    logStep("Decoded state", { businessId, userId });

    // Exchange code for access token
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const tokenResponse = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const stripeAccountId = tokenResponse.stripe_user_id;
    if (!stripeAccountId) throw new Error("No Stripe account ID returned");
    logStep("Got Stripe account", { stripeAccountId });

    // Update business with connected account
    const { error: updateError } = await supabaseClient
      .from("businesses")
      .update({
        stripe_account_id: stripeAccountId,
        stripe_connected_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (updateError) {
      throw new Error(`Failed to update business: ${updateError.message}`);
    }
    logStep("Business updated with Stripe account");

    return new Response(JSON.stringify({ 
      success: true, 
      stripe_account_id: stripeAccountId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
