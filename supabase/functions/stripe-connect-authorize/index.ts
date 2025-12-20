import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[stripe-connect-authorize] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeClientId = Deno.env.get("STRIPE_CLIENT_ID")?.trim();
    if (!stripeClientId) throw new Error("STRIPE_CLIENT_ID is not set");
    logStep("Stripe Client ID verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get the business for this user
    const { data: business, error: businessError } = await supabaseClient
      .from("businesses")
      .select("id, business_name")
      .eq("owner_id", user.id)
      .single();

    if (businessError || !business) {
      throw new Error("Business not found for this user");
    }
    logStep("Business found", { businessId: business.id, name: business.business_name });

    const origin = req.headers.get("origin") || "https://zyqzypyncugihrawhppg.lovableproject.com";
    const redirectUri = `${origin}/stripe-connect-callback`;

    // Build the Stripe Connect OAuth URL
    const stateData = JSON.stringify({ 
      businessId: business.id, 
      userId: user.id 
    });
    const state = btoa(stateData);

    const stripeOAuthUrl = new URL("https://connect.stripe.com/oauth/authorize");
    stripeOAuthUrl.searchParams.set("response_type", "code");
    stripeOAuthUrl.searchParams.set("client_id", stripeClientId);
    stripeOAuthUrl.searchParams.set("scope", "read_write");
    stripeOAuthUrl.searchParams.set("redirect_uri", redirectUri);
    stripeOAuthUrl.searchParams.set("state", state);
    stripeOAuthUrl.searchParams.set("stripe_user[business_name]", business.business_name);

    logStep("Generated OAuth URL", { url: stripeOAuthUrl.toString() });

    return new Response(JSON.stringify({ url: stripeOAuthUrl.toString() }), {
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
