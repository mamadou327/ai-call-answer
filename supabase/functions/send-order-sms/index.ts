import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOrderSmsRequest {
  businessId: string;
  orderId: string;
  type: "confirmation" | "ready" | "cancelled";
}

const normalizePhoneToE164 = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    trimmed.includes("[") ||
    trimmed.includes("]") ||
    lower.includes("use existing") ||
    lower.includes("existing phone") ||
    lower.includes("phone number") ||
    lower === "unknown"
  ) {
    return null;
  }

  let cleaned = trimmed.replace(/[^\d+]/g, "");

  if (cleaned.startsWith("00")) cleaned = `+${cleaned.slice(2)}`;

  if (cleaned.startsWith("0") && !cleaned.startsWith("+") && cleaned.length >= 10 && cleaned.length <= 11) {
    cleaned = `+44${cleaned.slice(1)}`;
  }

  if (!cleaned.startsWith("+") && /^\d{10,15}$/.test(cleaned)) {
    cleaned = `+${cleaned}`;
  }

  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
  return null;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!twilioAccountSid || !twilioAuthToken) {
      console.error("Twilio credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { businessId, orderId, type }: SendOrderSmsRequest = await req.json();

    console.log(`[send-order-sms] Processing ${type} SMS for order ${orderId}`);

    // Fetch business details
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    if (businessError || !business) {
      console.error("Business not found:", businessError);
      return new Response(
        JSON.stringify({ error: "Business not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if SMS is enabled
    if (!business.twilio_enabled || !business.twilio_phone_number) {
      console.log(`[send-order-sms] Twilio not configured for business ${businessId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "Twilio not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientPhone = normalizePhoneToE164(order.customer_phone);

    if (!recipientPhone) {
      console.log(`[send-order-sms] Invalid/missing customer phone for order ${orderId}`);
      return new Response(
        JSON.stringify({ success: false, reason: "Invalid or missing customer phone number" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business settings for currency
    const { data: settings } = await supabase
      .from("business_settings")
      .select("currency")
      .eq("business_id", businessId)
      .single();

    const currency = settings?.currency || "GBP";
    const currencySymbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";

    // Parse order items - include notes and sizes
    const items = Array.isArray(order.items) ? order.items : [];
    const itemsList = items.slice(0, 5).map((item: any) => {
      const qty = item.quantity || 1;
      const name = item.item_name || item.name || "Item";
      const size = item.size ? ` (${item.size})` : "";
      const notes = item.notes ? ` - ${item.notes}` : "";
      return `${qty}x ${name}${size}${notes}`;
    }).join("\n");
    const moreItems = items.length > 5 ? `\n+${items.length - 5} more items` : "";

    const customerName = order.customer_name || "there";
    const orderNumber = order.order_number;
    const total = order.total || 0;
    const orderType = order.order_type === "delivery" ? "Delivery" : "Pickup";

    // Format pickup/ready time based on SMS type
    let pickupInfo = "";
    if (type === "confirmation") {
      // For confirmation, show estimated ready time based on prep time
      const prepTime = business.average_prep_time_minutes || 20;
      const estimatedReady = new Date(Date.now() + prepTime * 60 * 1000);
      pickupInfo = `\n⏰ Ready in ~${prepTime} mins (around ${estimatedReady.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })})`;
    } else if (order.pickup_time) {
      // For ready/cancelled SMS, show the original pickup time if set
      const pickupTime = new Date(order.pickup_time);
      pickupInfo = `\n⏰ ${orderType} time: ${pickupTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    }

    // Build SMS message based on type
    let message = "";

    if (type === "confirmation") {
      message = `✅ Order Confirmed!

Hi ${customerName},

Your order #${orderNumber} has been received.

${itemsList}${moreItems}

💰 Total: ${currencySymbol}${total.toFixed(2)}
📦 ${orderType}${pickupInfo}

📍 ${business.address}
📞 ${business.main_phone}

Thank you for your order!
${business.business_name}`;

    } else if (type === "ready") {
      message = `🎉 Order Ready!

Hi ${customerName},

Your order #${orderNumber} is ready for ${orderType.toLowerCase()}!

📍 ${business.address}
📞 ${business.main_phone}

See you soon!
${business.business_name}`;

    } else if (type === "cancelled") {
      message = `❌ Order Cancelled

Hi ${customerName},

Your order #${orderNumber} has been cancelled.

If you have any questions, please contact us:
📞 ${business.main_phone}

${business.business_name}`;
    }

    // Send SMS via Twilio
    console.log(`[send-order-sms] Sending ${type} SMS to ${recipientPhone} via Twilio`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append("To", recipientPhone);
    formData.append("From", business.twilio_phone_number);
    formData.append("Body", message);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const responseData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("[send-order-sms] Twilio API error:", responseData);
      return new Response(
        JSON.stringify({ error: "Failed to send SMS", details: responseData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-order-sms] SMS sent successfully via Twilio:`, responseData.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: responseData.sid,
        type,
        recipient: recipientPhone 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[send-order-sms] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
