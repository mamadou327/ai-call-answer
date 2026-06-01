import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  businessName: string;
  businessType: string;
  phone: string;
  userId: string;
  subscriptionTier: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Payload;
    const { businessName, businessType, phone, userId, subscriptionTier } = body;

    if (!businessName || !businessType || !phone || !userId || !subscriptionTier) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Verify the user exists
    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid user" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check for existing business for this owner
    const { data: existing } = await admin
      .from("businesses")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    let businessId: string;

    if (existing?.id) {
      businessId = existing.id;
    } else {
      const { data: bizData, error: bizError } = await admin
        .from("businesses")
        .insert({
          owner_id: userId,
          business_name: businessName,
          main_phone: phone,
          business_type: businessType,
          address: "",
          status: "pending",
          staff_count: 1,
        })
        .select("id")
        .single();

      if (bizError) {
        console.error("Business insert error:", bizError);
        return new Response(
          JSON.stringify({ error: bizError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      businessId = bizData.id;
    }

    const { error: settingsError } = await admin
      .from("business_settings")
      .upsert(
        { business_id: businessId, subscription_tier: subscriptionTier },
        { onConflict: "business_id" },
      );

    if (settingsError) {
      console.error("Settings upsert error:", settingsError);
      return new Response(
        JSON.stringify({ error: settingsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ businessId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-business-signup error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
