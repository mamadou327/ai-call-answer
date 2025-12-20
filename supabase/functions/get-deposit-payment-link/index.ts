import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GetDepositPaymentLinkBody = {
  bookingCode?: string;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      console.error("[get-deposit-payment-link] Missing backend configuration");
      return json(500, { error: "Service not configured" });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const body = (await req.json().catch(() => ({}))) as GetDepositPaymentLinkBody;
    const bookingCodeRaw = (body.bookingCode ?? "").trim();

    if (!bookingCodeRaw) {
      return json(400, { error: "No booking code provided" });
    }

    const bookingCode = bookingCodeRaw.toUpperCase();

    console.log("[get-deposit-payment-link] Lookup", { bookingCode });

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("deposit_payment_link, deposit_paid_at, status")
      .eq("booking_code", bookingCode)
      .maybeSingle();

    if (bookingError) {
      console.error("[get-deposit-payment-link] Booking query error", bookingError);
      return json(500, { error: "Failed to look up booking" });
    }

    if (!booking) {
      return json(404, { error: "Booking not found" });
    }

    if (booking.deposit_paid_at) {
      return json(400, { error: "Deposit has already been paid" });
    }

    if (booking.status === "cancelled") {
      return json(400, { error: "This booking has been cancelled" });
    }

    if (!booking.deposit_payment_link) {
      return json(404, {
        error: "Payment link is not available. Please contact the business.",
      });
    }

    return json(200, { url: booking.deposit_payment_link });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[get-deposit-payment-link] ERROR", message);
    return json(500, { error: message });
  }
});
