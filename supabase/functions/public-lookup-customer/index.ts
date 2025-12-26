import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PUBLIC-LOOKUP-CUSTOMER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { businessSlug, phone } = await req.json();

    logStep("Request received", { businessSlug, phone: phone?.slice(-4) });

    if (!businessSlug || !phone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, online_booking_enabled, status")
      .eq("booking_slug", businessSlug)
      .single();

    if (businessError || !business) {
      logStep("Business not found", { businessSlug });
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!business.online_booking_enabled || business.status !== "approved") {
      return new Response(
        JSON.stringify({ error: "Online booking not available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number for search (remove spaces, dashes)
    const normalizedPhone = phone.replace(/[\s\-()]/g, "");

    // Look up customer by phone
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, name, email, phone, total_visits, first_visit_date, preferred_staff_id")
      .eq("business_id", business.id)
      .or(`phone.eq.${normalizedPhone},phone.eq.${phone}`)
      .single();

    if (customerError || !customer) {
      logStep("Customer not found", { phone: phone?.slice(-4) });
      return new Response(
        JSON.stringify({ found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Customer found", { customerId: customer.id, visits: customer.total_visits });

    // Get last 3 bookings for this customer
    const { data: recentBookings } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_code,
        start_time,
        status,
        service:service_id(id, name, price),
        staff:staff_id(id, name)
      `)
      .eq("business_id", business.id)
      .eq("customer_phone", phone)
      .in("status", ["confirmed", "completed"])
      .order("start_time", { ascending: false })
      .limit(3);

    // Get preferred staff name if set
    let preferredStaffName = null;
    if (customer.preferred_staff_id) {
      const { data: staff } = await supabase
        .from("staff")
        .select("name")
        .eq("id", customer.preferred_staff_id)
        .single();
      preferredStaffName = staff?.name;
    }

    return new Response(
      JSON.stringify({
        found: true,
        customer: {
          name: customer.name,
          email: customer.email,
          totalVisits: customer.total_visits,
          firstVisitDate: customer.first_visit_date,
          preferredStaffId: customer.preferred_staff_id,
          preferredStaffName,
        },
        recentBookings: recentBookings || [],
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
