import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[public-create-order] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      businessSlug,
      items,
      customerName,
      customerPhone,
      customerEmail,
      orderType = "pickup",
      deliveryAddress,
      pickupTime,
      notes,
    } = await req.json();

    logStep("Received order request", { businessSlug, itemCount: items?.length, orderType });

    // Validate required fields
    if (!businessSlug || !items || items.length === 0 || !customerName || !customerPhone) {
      return json(400, { error: "Missing required fields" });
    }

    // Fetch business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(`
        id, business_name, address, main_phone, status, online_booking_enabled,
        minimum_order_amount, delivery_enabled, delivery_fee, delivery_minimum_order,
        average_prep_time_minutes
      `)
      .eq("booking_slug", businessSlug)
      .single();

    if (businessError || !business) {
      logStep("Business not found", { businessSlug });
      return json(404, { error: "Business not found" });
    }

    if (business.status !== "approved" || !business.online_booking_enabled) {
      return json(400, { error: "Online ordering is not available for this business" });
    }

    // Validate items and calculate total
    const menuItemIds = items.map((item: any) => item.menuItemId);
    const { data: menuItems, error: menuError } = await supabase
      .from("menu_items")
      .select("id, name, price, is_available, has_sizes")
      .eq("business_id", business.id)
      .in("id", menuItemIds);

    if (menuError || !menuItems) {
      logStep("Failed to fetch menu items", { error: menuError });
      return json(500, { error: "Failed to validate menu items" });
    }

    // Build order items with prices
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const menuItem = menuItems.find((mi: any) => mi.id === item.menuItemId);
      if (!menuItem) {
        return json(400, { error: `Menu item not found: ${item.menuItemId}` });
      }
      if (!menuItem.is_available) {
        return json(400, { error: `${menuItem.name} is currently unavailable` });
      }

      let unitPrice = menuItem.price;

      // Handle size
      if (item.sizeId) {
        const { data: size } = await supabase
          .from("menu_item_sizes")
          .select("name, price")
          .eq("id", item.sizeId)
          .single();
        
        if (size) {
          unitPrice = size.price;
        }
      }

      // Handle options
      let optionsDescription = [];
      if (item.options && item.options.length > 0) {
        for (const opt of item.options) {
          if (opt.optionSizeId) {
            const { data: optSize } = await supabase
              .from("menu_item_option_sizes")
              .select("name, price")
              .eq("id", opt.optionSizeId)
              .single();
            
            if (optSize) {
              unitPrice += optSize.price;
              optionsDescription.push(`${opt.optionName} (${optSize.name})`);
            }
          } else {
            unitPrice += opt.priceAdjustment || 0;
            optionsDescription.push(opt.optionName);
          }
        }
      }

      const quantity = item.quantity || 1;
      subtotal += unitPrice * quantity;

      orderItems.push({
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        quantity,
        unit_price: unitPrice,
        notes: [
          item.sizeName ? `Size: ${item.sizeName}` : null,
          optionsDescription.length > 0 ? `Options: ${optionsDescription.join(", ")}` : null,
          item.specialInstructions,
        ].filter(Boolean).join(" | ") || null,
      });
    }

    // Validate minimum order
    const minimumOrder = orderType === "delivery" 
      ? Math.max(business.minimum_order_amount || 0, business.delivery_minimum_order || 0)
      : business.minimum_order_amount || 0;

    if (subtotal < minimumOrder) {
      return json(400, { 
        error: `Minimum order amount is ${minimumOrder}. Your order total is ${subtotal}.` 
      });
    }

    // Validate delivery
    if (orderType === "delivery") {
      if (!business.delivery_enabled) {
        return json(400, { error: "Delivery is not available for this business" });
      }
      if (!deliveryAddress) {
        return json(400, { error: "Delivery address is required" });
      }
    }

    // Calculate total
    const deliveryFee = orderType === "delivery" ? (business.delivery_fee || 0) : 0;
    const total = subtotal + deliveryFee;

    // Generate order number
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        business_id: business.id,
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        order_type: orderType,
        pickup_time: pickupTime || null,
        notes: [
          notes,
          orderType === "delivery" ? `Delivery Address: ${deliveryAddress}` : null,
        ].filter(Boolean).join(" | ") || null,
        items: orderItems,
        subtotal,
        total,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      logStep("Failed to create order", { error: orderError });
      return json(500, { error: "Failed to create order" });
    }

    logStep("Order created successfully", { orderNumber, total });

    // Calculate estimated time
    const prepTime = business.average_prep_time_minutes || 20;
    const estimatedTime = new Date(Date.now() + prepTime * 60 * 1000);
    const estimatedTimeStr = estimatedTime.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // TODO: Send SMS notification to business and customer

    return json(200, {
      success: true,
      orderNumber,
      total,
      estimatedTime: estimatedTimeStr,
      orderType,
    });

  } catch (error) {
    logStep("Unexpected error", { error: String(error) });
    return json(500, { error: "An unexpected error occurred" });
  }
});
