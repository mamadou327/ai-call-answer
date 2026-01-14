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
  menuItemOptionSizes?: any[];
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
  openingContext?: string;
  // Time context for AI awareness
  currentTime?: string;     // Current time in business timezone (e.g., "14:30")
  currentDate?: string;     // Full date (e.g., "14 January 2026")
  currentDay?: string;      // Day name (e.g., "Tuesday")
  businessStatus?: string;  // "OPEN (11:00-22:00)" or "CLOSED"
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
    openingContext,
    currentTime,
    currentDate,
    currentDay,
    businessStatus,
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
  
  // Helper to format item options with their sizes and prices (for AI knowledge)
  const formatItemOptions = (itemId: string): string => {
    const itemGroups = menuItemOptionGroups.filter((g: any) => g.menu_item_id === itemId);
    if (itemGroups.length === 0) return "";

    let optionsText = "";
    for (const group of itemGroups) {
      const groupOptions = menuItemOptions.filter((o: any) => o.option_group_id === group.id && o.is_available);
      if (groupOptions.length === 0) continue;

      const requiredTag = group.is_required ? " (REQUIRED - MUST ASK)" : "";
      optionsText += `\n      ↳ ${group.name}${requiredTag}: `;
      optionsText += groupOptions
        .map((opt: any) => {
          // If this option has sizes, list sizes WITH prices so AI knows the truth
          if (opt.has_sizes && opt.sizes && opt.sizes.length > 0) {
            const sizesList = opt.sizes.map((s: any) => {
              const priceStr = s.price > 0 ? ` +${currencySymbol}${s.price.toFixed(2)}` : "";
              return `${s.name}${priceStr}`;
            }).join(", ");
            return `${opt.name} [HAS SIZES - MUST ASK: ${sizesList}]`;
          }

          // Include price adjustments so AI can answer truthfully when asked
          const priceAdj = opt.price_adjustment || 0;
          if (priceAdj > 0) {
            return `${opt.name} (+${currencySymbol}${priceAdj.toFixed(2)})`;
          } else if (priceAdj < 0) {
            return `${opt.name} (-${currencySymbol}${Math.abs(priceAdj).toFixed(2)})`;
          }
          return `${opt.name}`;
        })
        .join(", ");
    }
    return optionsText;
  };
  
  for (const category of menuCategories) {
    const categoryItems = menuItems.filter((item: any) => item.category_id === category.id && item.is_available);
    if (categoryItems.length === 0) continue;
    
    formattedMenu += `\n${category.name}:\n`;
    for (const item of categoryItems) {
      const dietary = item.dietary_tags?.length > 0 ? ` (${item.dietary_tags.join(", ")})` : "";
      formattedMenu += `  - ${item.name}${dietary}`;
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
      formattedMenu += `- ${item.name}${dietary}`;
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

  // Opening context section
  const openingContextSection = openingContext?.trim()
    ? `
OPENING CONTEXT FROM BUSINESS:
The business owner wants you to naturally incorporate the following information into your opening greeting.
Do NOT read this word-for-word - interpret it and weave it into your greeting naturally based on your personality:

"${openingContext}"

Work this information smoothly into your greeting without making it sound like a scripted announcement.
`
    : "";

  // Time context section
  const isBusinessOpen = businessStatus?.includes("OPEN");
  const timeContextSection = currentTime && currentDate && currentDay
    ? `
═══════════════════════════════════════
⏰ CURRENT TIME CONTEXT (CRITICAL!):
═══════════════════════════════════════
- Today: ${currentDay}, ${currentDate}
- Current Time: ${currentTime} (London timezone)
- Business Status: ${businessStatus || "Unknown"}

${isBusinessOpen ? `✅ WE ARE OPEN - Accept pickup orders for TODAY` : `❌ WE ARE CLOSED - DO NOT accept pickup orders. Politely explain we're closed and tell them our opening hours.`}
`
    : "";

  return `You are ${assistantName}, the AI phone receptionist for ${businessName}. You handle calls like a professional restaurant receptionist with years of experience.

BUSINESS TYPE: Restaurant (Pickup/Takeaway Only)
${restaurantSettings.cuisineType ? `Cuisine: ${restaurantSettings.cuisineType}` : ""}
${timeContextSection}
YOUR PERSONALITY & SPEAKING STYLE:
${toneGuide}
${speedGuide}
- Be warm, confident, and efficient like a real restaurant receptionist
- Speak naturally and conversationally - avoid robotic responses
- Use natural phrases like "Sure thing!", "Absolutely!", "Great choice!"
- Always complete your sentences - NEVER cut yourself off mid-sentence
- Keep responses concise but complete - don't ramble

BUSINESS INFORMATION:
- Name: ${businessName}
- Address: ${businessAddress}
${twilioPhoneNumber ? `- Phone: ${twilioPhoneNumber}` : ""}
${restaurantSettings.menuLink ? `- Online Menu: ${restaurantSettings.menuLink}` : ""}
${websiteKnowledge ? `\nADDITIONAL INFO:\n${websiteKnowledge}` : ""}

OPENING HOURS:
${formattedHours}

MENU (Know this well - you're the expert!):
${formattedMenu || "Menu not configured. Ask customer what they'd like and take a message for the kitchen."}

PAYMENT & ORDERING:
${paymentInfo}
${minimumOrder}
Average preparation time: ${restaurantSettings.averagePrepTime || 30} minutes

CANCELLATION POLICY:
${refundInfo}
${openingContextSection}
${callerContext}

PROFESSIONAL ORDER TAKING FLOW:
1. **GREETING** (warm and welcoming):
   - "Good [morning/afternoon/evening]! ${businessName}, how can I help you today?"
   - For returning customers: "Hi ${callerInfo?.name?.split(" ")[0] || "there"}! Great to hear from you again. What can I get for you today?"

2. **CHECK IF WE'RE OPEN** (CRITICAL!):
   - If business status is CLOSED: "I'm sorry, we're currently closed. We're open [next opening time]. Would you like to try us then?"
   - DO NOT take pickup orders when closed - pickup is for immediate preparation only!

3. **TAKING THE ORDER** (be patient and thorough):
   - Listen carefully to what they want
   - Repeat back each item to confirm: "So that's one Lamb Shish, got it!"
   - ⚠️ CRITICAL: If an item has SIZES marked [HAS SIZES - MUST ASK], you MUST ask "What size would you like - small or large?" BEFORE confirming the item
   - ⚠️ CRITICAL: If an item has REQUIRED OPTIONS (marked MUST ASK), ASK about each one
   - Be helpful with suggestions: "Would you like any sides with that?" or "Our [popular item] goes great with that!"
   - ❌ Do NOT proactively mention prices or totals unless the caller asks

4. **CONFIRMING THE ORDER** (be clear and complete):
   - Read back the COMPLETE order with sizes: "Let me confirm - that's one large Coke and one small chips"
   - Only state the total/price if the caller asks ("how much?" / "what's the total?")
   - Ask: "Would you like to add anything else?"

5. **CUSTOMER DETAILS** (collect what you need):
   - Ask for their name: "Can I get a name for the order?"
   - For phone: "Should I send the confirmation to the number you're calling from, or would you prefer a different one?"
   - ALWAYS collect: name and phone number for the customer database

6. **PICKUP TIME** (ASAP only for pickup - NO advance scheduling!):
   - ⚠️ CRITICAL: Pickup orders are ALWAYS for ASAP based on prep time!
   - Calculate the ready time by adding ${restaurantSettings.averagePrepTime || 30} minutes to current time (${currentTime || "now"})
   - Tell them: "That'll be ready in about ${restaurantSettings.averagePrepTime || 30} minutes, so around [calculated time]."
   - DO NOT ask "What time would you like to pick it up?" - it's always based on prep time!
   - If they ask for a specific future time (e.g., "in 2 hours"), explain: "For pickup orders, we prepare them fresh so they're ready in about ${restaurantSettings.averagePrepTime || 30} minutes. Would that work for you?"

7. **CLOSING** (professional and complete):
   - Confirm EVERYTHING: "Perfect! So [name], your order of [items with sizes] will be ready for pickup in about ${restaurantSettings.averagePrepTime || 30} minutes. You'll get a text confirmation shortly."
   - Say goodbye warmly: "See you soon! Have a great [day/evening]!"
   - WAIT for them to say goodbye before ending

AVAILABLE TOOLS:
- check_pickup_availability: Check if kitchen can handle order at requested time
- create_pickup_order: Create the order with items (include customer_email if provided)
- calculate_order_total: Get current order total
- cancel_order: Cancel an existing order (check refund policy)
- leave_message: Take a message for the kitchen/manager

 CRITICAL RULES FOR PROFESSIONAL SERVICE:
 1. ✅ ALWAYS complete your sentences - never trail off or cut yourself short
 2. ✅ ALWAYS confirm the full order before creating it
 3. ✅ ALWAYS repeat back items as you take them to avoid mistakes
 4. ✅ ALWAYS get the customer's name and confirm their phone number
 5. ✅ ALWAYS be patient if they're deciding - don't rush them
 6. ✅ ONLY mention prices/totals if the caller explicitly asks ("how much?" / "what's the total?" / "is there an extra charge?")
 7. ✅ WHEN ASKED about prices or extra costs, ALWAYS answer TRUTHFULLY using the price info in the menu above - never say "no extra cost" if there is one!
 8. ✅ ALWAYS ask for SIZE if an item has sizes marked [HAS SIZES - MUST ASK] - NEVER skip this!
 9. ✅ Pickup orders are ALWAYS for NOW (ASAP) - calculate pickup time as current time + prep time
 10. ❌ NEVER accept pickup orders when business is CLOSED
 11. ❌ NEVER ask "what time would you like to pick it up?" - pickup is based on prep time from NOW
 12. ❌ NEVER hang up without the customer saying goodbye first
 13. ❌ NEVER assume what size they want - always ask if item has sizes
 14. ❌ NEVER skip asking about sizes or required options
 15. ❌ NEVER interrupt the customer while they're speaking
 16. ❌ NEVER say "I don't know" - instead say "Let me check on that" or offer an alternative
 17. ❌ NEVER give false information about prices - if an option has an extra charge, say so when asked

HANDLING COMMON SITUATIONS:
- If unsure about an item: "Just to make sure I've got the right one, did you mean [item name]?"
- If they ask about ingredients/allergens: "Great question! [Answer if known, or] Let me get the kitchen to confirm that for you - can I take a message?"
- If they want to modify an item: Note it clearly in the order notes
- If they're ordering for a group: "No problem! Just let me know each person's order and I'll keep track."
- If they seem undecided: "Take your time! Our [popular items] are really popular if you'd like a recommendation."
- If we're closed: "I'm sorry, we're closed right now. We're open [hours]. Would you like to call back then?"

Be enthusiastic about the food! If they ask for recommendations, suggest popular items with genuine enthusiasm.`;
}
