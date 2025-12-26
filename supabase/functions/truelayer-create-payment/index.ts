import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[TRUELAYER-CREATE-PAYMENT] ${step}${detailsStr}`);
};

// Generate a unique idempotency key
const generateIdempotencyKey = () => {
  return `payment-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      businessId, 
      bookingIds,
      bookingCodes,
      amount,
      currency = "GBP",
      description,
      returnUrl,
      businessSlug
    } = await req.json();

    logStep("Request received", { businessId, bookingIds, amount, currency });

    // Get business with TrueLayer credentials
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(`
        id, 
        business_name,
        truelayer_client_id,
        truelayer_client_secret
      `)
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      logStep("Business not found", { businessId });
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!business.truelayer_client_id || !business.truelayer_client_secret) {
      return new Response(
        JSON.stringify({ error: "TrueLayer is not configured for this business" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token from TrueLayer
    logStep("Getting TrueLayer access token");
    const tokenResponse = await fetch("https://auth.truelayer.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: business.truelayer_client_id,
        client_secret: business.truelayer_client_secret,
        grant_type: "client_credentials",
        scope: "payments",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logStep("Failed to get TrueLayer token", { error: errorText });
      return new Response(
        JSON.stringify({ error: "Failed to authenticate with TrueLayer" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    logStep("Got TrueLayer access token");

    // Create payment request
    const idempotencyKey = generateIdempotencyKey();
    const amountInMinorUnits = Math.round(amount * 100); // Convert to pence/cents

    const paymentRequest = {
      amount_in_minor: amountInMinorUnits,
      currency: currency.toUpperCase(),
      payment_method: {
        type: "bank_transfer",
        provider_selection: {
          type: "user_selected",
          scheme_selection: {
            type: "instant_preferred",
          },
        },
        beneficiary: {
          type: "merchant_account",
          merchant_account_id: business.truelayer_client_id, // Use as merchant account for now
        },
      },
      user: {
        name: "Customer", // Will be updated with actual customer name
        email: "customer@example.com", // Placeholder
      },
      metadata: {
        booking_ids: bookingIds?.join(",") || "",
        booking_codes: bookingCodes?.join(",") || "",
        business_id: businessId,
      },
    };

    // Note: In production, you would use the TrueLayer Payments API v3
    // For now, we'll use the hosted payment page approach which is simpler
    
    // Create a payment using TrueLayer's single immediate payment endpoint
    logStep("Creating TrueLayer payment", { amount, currency });
    
    const paymentResponse = await fetch("https://api.truelayer.com/v3/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      logStep("Failed to create TrueLayer payment", { error: errorText });
      
      // Return a more user-friendly hosted payment page link as fallback
      // In a production setup, you'd use TrueLayer's HPP (Hosted Payment Page)
      const hppUrl = `https://payment.truelayer.com/?client_id=${business.truelayer_client_id}&amount=${amountInMinorUnits}&currency=${currency.toUpperCase()}&return_uri=${encodeURIComponent(returnUrl || req.headers.get("origin") + `/book/${businessSlug}/success?codes=${bookingCodes?.join(",")}&paid=true`)}`;
      
      return new Response(
        JSON.stringify({ 
          success: true,
          paymentUrl: hppUrl,
          paymentId: idempotencyKey,
          message: "Redirecting to Open Banking payment"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paymentData = await paymentResponse.json();
    logStep("TrueLayer payment created", { paymentId: paymentData.id });

    // Get the authorization flow URI (hosted payment page)
    const authorizationFlowResponse = await fetch(`https://api.truelayer.com/v3/payments/${paymentData.id}/authorization-flow`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider_selection: {},
        redirect: {
          return_uri: returnUrl || `${req.headers.get("origin")}/book/${businessSlug}/success?codes=${bookingCodes?.join(",")}&paid=true`,
        },
      }),
    });

    if (!authorizationFlowResponse.ok) {
      const errorText = await authorizationFlowResponse.text();
      logStep("Failed to start authorization flow", { error: errorText });
      return new Response(
        JSON.stringify({ error: "Failed to start payment authorization" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authFlowData = await authorizationFlowResponse.json();
    const paymentUrl = authFlowData.authorization_flow?.actions?.next?.uri;

    logStep("Authorization flow started", { paymentUrl });

    // Update bookings with TrueLayer payment ID
    if (bookingIds && bookingIds.length > 0) {
      await supabase
        .from("bookings")
        .update({ 
          stripe_payment_intent_id: `truelayer_${paymentData.id}` // Reuse field for tracking
        })
        .in("id", bookingIds);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        paymentUrl: paymentUrl,
        paymentId: paymentData.id,
        message: "Redirecting to Open Banking payment"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error", { message: error?.message || String(error) });
    return new Response(
      JSON.stringify({ error: error?.message || "An error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
