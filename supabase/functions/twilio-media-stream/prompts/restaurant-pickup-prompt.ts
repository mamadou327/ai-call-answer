// Restaurant Pickup/Takeaway specific system prompt builder
// Used for restaurants that only do pickup/takeaway orders

interface RestaurantPickupPromptData {
  businessName: string;
  businessAddress: string;
  assistantName: string;
  tone: string;
  voiceSpeed: string;
  callerPhone: string;
  twilioPhoneNumber: string | null;
  websiteKnowledge: string | null;
  openingHours: any[];
  menuCategories: any[];
  menuItems: any[];
  menuItemOptions?: any[];
  menuItemOptionGroups?: any[];
  businessSettings: any;
  restaurantSettings: {
    cuisineType: string | null;
    menuLink: string | null;
    paymentMethods: string[];
    requirePrepayment: boolean;
    prepaymentType: string;
    minimumOrderAmount: number | null;
    refundPolicy: string;
    refundWindowHours: number;
    averagePrepTime: number;
  };
  callerInfo: any;
}

export function buildRestaurantPickupSystemPrompt(data: RestaurantPickupPromptData): string {
  const {
    businessName,
    businessAddress,
    assistantName,
    tone,
    voiceSpeed,
    callerPhone,
    twilioPhoneNumber,
    websiteKnowledge,
    openingHours,
    menuCategories,
    menuItems,
    menuItemOptions = [],
    menuItemOptionGroups = [],
    businessSettings,
    restaurantSettings,
    callerInfo,
  } = data;

  // Format opening hours
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const formattedHours = openingHours
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map(h => {
      const day = dayNames[h.day_of_week];
      if (h.is_closed) return `${day}: CLOSED`;
      return `${day}: ${h.open_time?.slice(0, 5) || "11:00"} - ${h.close_time?.slice(0, 5) || "22:00"}`;
    })
    .join("\n");

  // Format menu by category with options
  let formattedMenu = "";
  const currency = businessSettings?.currency || "GBP";
  const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : currency === "EUR" ? "€" : currency;
  
  // Helper to format item options
  const formatItemOptions = (itemId: string): string => {
    const itemGroups = menuItemOptionGroups.filter((g: any) => g.menu_item_id === itemId);
    if (itemGroups.length === 0) return "";
    
    let optionsText = "";
    for (const group of itemGroups) {
      const groupOptions = menuItemOptions.filter((o: any) => o.option_group_id === group.id && o.is_available);
      if (groupOptions.length === 0) continue;
      
      const requiredTag = group.is_required ? " (REQUIRED)" : "";
      optionsText += `\n      ↳ ${group.name}${requiredTag}: `;
      optionsText += groupOptions.map((opt: any) => {
        const priceAdj = opt.price_adjustment !== 0 
          ? ` (${opt.price_adjustment > 0 ? '+' : ''}${currencySymbol}${opt.price_adjustment.toFixed(2)})`
          : "";
        return `${opt.name}${priceAdj}`;
      }).join(", ");
    }
    return optionsText;
  };
  
  for (const category of menuCategories) {
    const categoryItems = menuItems.filter((item: any) => item.category_id === category.id && item.is_available);
    if (categoryItems.length === 0) continue;
    
    formattedMenu += `\n${category.name}:\n`;
    for (const item of categoryItems) {
      const dietary = item.dietary_tags?.length > 0 ? ` (${item.dietary_tags.join(", ")})` : "";
      formattedMenu += `  - ${item.name}: ${currencySymbol}${item.price}${dietary}`;
      if (item.description) {
        formattedMenu += `\n    ${item.description}`;
      }
      formattedMenu += formatItemOptions(item.id);
      formattedMenu += "\n";
    }
  }

  // If no menu categories, list items directly
  if (menuCategories.length === 0 && menuItems.length > 0) {
    formattedMenu = "\nMenu Items:\n";
    for (const item of menuItems.filter((i: any) => i.is_available)) {
      const dietary = item.dietary_tags?.length > 0 ? ` (${item.dietary_tags.join(", ")})` : "";
      formattedMenu += `- ${item.name}: ${currencySymbol}${item.price}${dietary}`;
      formattedMenu += formatItemOptions(item.id);
      formattedMenu += "\n";
    }
  }

  // Payment methods formatting
  const paymentMethods = restaurantSettings.paymentMethods || ["card"];
  let paymentInfo = `Accepted payment: ${paymentMethods.map(m => m === "online" ? "online payment" : m).join(", ")}`;
  
  if (restaurantSettings.requirePrepayment) {
    paymentInfo += `\n⚠️ PREPAYMENT REQUIRED: ${restaurantSettings.prepaymentType === "full" ? "Full payment" : "Deposit"} must be paid when ordering.`;
  } else if (paymentMethods.includes("online")) {
    paymentInfo += "\nCustomers can pay online or when they collect their order.";
  }

  // Minimum order
  const minimumOrder = restaurantSettings.minimumOrderAmount && restaurantSettings.minimumOrderAmount > 0
    ? `Minimum order: ${currency} ${restaurantSettings.minimumOrderAmount}`
    : "No minimum order.";

  // Refund policy
  const refundPolicies: Record<string, string> = {
    full_refund: "Full refund available",
    partial_refund: "50% refund available",
    store_credit: "Store credit only",
    no_refund: "No refunds",
  };
  const refundInfo = `${refundPolicies[restaurantSettings.refundPolicy] || "Full refund"} if cancelled ${restaurantSettings.refundWindowHours} hours before pickup time.`;

  // Build caller context
  let callerContext = "";
  if (callerInfo?.isReturning) {
    callerContext = `
RETURNING CUSTOMER:
- Name: ${callerInfo.name}
- Total orders: ${callerInfo.totalVisits}
${callerInfo.lastBooking ? `- Last order: ${callerInfo.lastBooking.service} on ${callerInfo.lastBooking.date}` : ""}

Greet them warmly: "Hi ${callerInfo.name?.split(" ")[0]}, welcome back!"`;
  } else {
    callerContext = `
NEW CALLER: ${callerPhone}
Be welcoming! Ask for their name when taking the order.`;
  }

  // Tone mapping
  const toneGuide = {
    friendly: "Be warm and enthusiastic about the food! Make recommendations.",
    professional: "Be efficient and clear. Confirm order details precisely.",
    neutral: "Be helpful and conversational. Balance friendliness with efficiency.",
  }[tone] || "Be helpful and efficient.";

  // Speed mapping
  const speedGuide = {
    slow: "Speak clearly, especially when confirming order items and prices.",
    normal: "Speak at a conversational pace.",
    fast: "Be brisk but make sure to confirm order details clearly.",
  }[voiceSpeed] || "Speak at a natural pace.";

  return `You are ${assistantName}, the AI phone assistant for ${businessName}.

BUSINESS TYPE: Restaurant (Pickup/Takeaway Only)
${restaurantSettings.cuisineType ? `Cuisine: ${restaurantSettings.cuisineType}` : ""}

TONE & STYLE:
${toneGuide}
${speedGuide}

BUSINESS INFORMATION:
- Name: ${businessName}
- Address: ${businessAddress}
${twilioPhoneNumber ? `- Phone: ${twilioPhoneNumber}` : ""}
${restaurantSettings.menuLink ? `- Online Menu: ${restaurantSettings.menuLink}` : ""}
${websiteKnowledge ? `\nADDITIONAL INFO:\n${websiteKnowledge}` : ""}

OPENING HOURS:
${formattedHours}

MENU:
${formattedMenu || "Menu not configured. Ask customer what they'd like and take a message for the kitchen."}

PAYMENT & ORDERING:
${paymentInfo}
${minimumOrder}
Average preparation time: ${restaurantSettings.averagePrepTime || 30} minutes

CANCELLATION POLICY:
${refundInfo}

${callerContext}

ORDER TAKING FLOW:
1. Greet the customer warmly
2. Ask what they'd like to order
3. For each item:
   - Confirm the item name
   - If the item has OPTIONS (like size or sides), proactively ask: "What size would you like?" or "Which side would you like with that?"
   - List available options if the customer is unsure
   - Note any price adjustments for their selections
4. Calculate running total as you go (base price + option adjustments)
5. When they're done, read back the full order with total
6. Ask for their name (if new customer) and phone number
7. Suggest a pickup time based on prep time: "${restaurantSettings.averagePrepTime || 30} minutes from now, so around [TIME]?"
8. If prepayment required, inform them they'll receive a payment link
9. Confirm the order and pickup time

AVAILABLE TOOLS:
- check_pickup_availability: Check if kitchen can handle order at requested time
- create_pickup_order: Create the order with items
- calculate_order_total: Get current order total
- cancel_order: Cancel an existing order (check refund policy)
- leave_message: Take a message for the kitchen/manager

CRITICAL RULES:
1. ALWAYS confirm the order back to the customer before finalizing
2. If an item isn't on the menu, apologize and suggest alternatives
3. For dietary requirements, note them clearly in the order
4. Don't promise exact times - say "approximately" for pickup times
5. If order is below minimum, politely inform customer
6. NEVER hang up without the customer saying goodbye first

Be enthusiastic about the food! If they ask for recommendations, suggest popular items.`;
}
