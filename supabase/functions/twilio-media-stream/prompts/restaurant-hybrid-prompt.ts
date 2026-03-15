// Restaurant Hybrid specific system prompt builder
// Used for restaurants that do both pickup/takeaway AND dine-in reservations

interface RestaurantHybridPromptData {
  businessName: string;
  businessNamePhonetic?: string;
  businessAddress: string;
  assistantName: string;
  tone: string;
  voiceSpeed: string;
  callerPhone: string;
  twilioPhoneNumber: string | null;
  websiteKnowledge: string | null;
  openingHours: any[];
  tables: any[];
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
  recentCallContext?: string;
  // Time context for AI awareness
  currentTime?: string;     // Current time in business timezone (e.g., "14:30")
  currentDate?: string;     // Full date (e.g., "14 January 2026")
  currentDay?: string;      // Day name (e.g., "Tuesday")
  businessStatus?: string;  // "OPEN (11:00-22:00)" or "CLOSED"
}

export function buildRestaurantHybridSystemPrompt(data: RestaurantHybridPromptData): string {
  const {
    businessName,
    businessNamePhonetic,
    businessAddress,
    assistantName,
    tone,
    voiceSpeed,
    callerPhone,
    twilioPhoneNumber,
    websiteKnowledge,
    openingHours,
    tables,
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
      formattedMenu += formatItemOptions(item.id);
      formattedMenu += "\n";
    }
  }

  // Table info
  const activeTables = tables.filter((t: any) => t.is_active);
  const totalSeats = activeTables.reduce((sum: number, t: any) => sum + (t.capacity || 4), 0);
  const maxPartySize = Math.max(...activeTables.map((t: any) => t.capacity || 4), 0);

  // Payment methods formatting
  const paymentMethods = restaurantSettings.paymentMethods || ["card"];
  let paymentInfo = `Pickup payment: ${paymentMethods.map(m => m === "online" ? "online payment" : m).join(", ")}`;
  if (restaurantSettings.requirePrepayment) {
    paymentInfo += ` (${restaurantSettings.prepaymentType === "full" ? "Full payment" : "Deposit"} required for pickup orders)`;
  }

  // Minimum order
  const minimumOrder = restaurantSettings.minimumOrderAmount && restaurantSettings.minimumOrderAmount > 0
    ? `Minimum pickup order: ${currency} ${restaurantSettings.minimumOrderAmount}`
    : "";

  // Refund policy
  const refundPolicies: Record<string, string> = {
    full_refund: "Full refund available",
    partial_refund: "50% refund available",
    store_credit: "Store credit only",
    no_refund: "No refunds",
  };
  const refundInfo = `${refundPolicies[restaurantSettings.refundPolicy] || "Full refund"} if cancelled ${restaurantSettings.refundWindowHours} hours in advance.`;

  // Build caller context
  let callerContext = "";
  if (callerInfo?.isReturning) {
    callerContext = `
═══════════════════════════════════════
✅ RETURNING CUSTOMER - DO NOT ASK FOR DETAILS!
═══════════════════════════════════════
- Name: ${callerInfo.name}
- Phone: ${callerPhone}
- Previous orders/visits: ${callerInfo.totalVisits}
${callerInfo.upcomingBooking ? `- UPCOMING BOOKING: ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} (Ref: ${callerInfo.upcomingBooking.code})` : ""}

⚠️ CRITICAL: You ALREADY have their name and phone number! 
- DO NOT ask "Can I get a name?" - you already know it's ${callerInfo.name}
- DO NOT ask for their phone number - you already have ${callerPhone}
- Just use these details when creating orders/reservations
- Greet them warmly: "Hi ${callerInfo.name?.split(" ")[0]}, lovely to hear from you again! How can I help?"`;
  } else {
    callerContext = `
NEW CALLER: ${callerPhone}
Be welcoming! You'll need to ask for their name when taking order or reservation.
You already have their phone: ${callerPhone} - just confirm it's correct.`;
  }

  // Tone and speed
  const toneGuide = {
    friendly: "Be warm and enthusiastic! Make recommendations.",
    professional: "Be polished and efficient. Confirm details precisely.",
    neutral: "Be helpful and pleasant. Balance warmth with efficiency.",
  }[tone] || "Be warm and helpful.";

  const speedGuide = {
    slow: "Speak clearly and take your time.",
    normal: "Speak at a conversational pace.",
    fast: "Be efficient but make sure to confirm all details.",
  }[voiceSpeed] || "Speak naturally.";

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

  // Time context section - CRITICAL for pickup time calculations
  const isBusinessOpen = businessStatus?.includes("OPEN");
  const timeContextSection = currentTime && currentDate && currentDay
    ? `
═══════════════════════════════════════
⏰ CURRENT TIME CONTEXT (CRITICAL FOR PICKUP TIMES!):
═══════════════════════════════════════
- Today: ${currentDay}, ${currentDate}
- Current Time RIGHT NOW: ${currentTime} (local business time)
- Business Status: ${businessStatus || "Unknown"}

⚠️ PICKUP TIME CALCULATION:
When calculating pickup ready time, add ${data.restaurantSettings.averagePrepTime || 30} minutes to ${currentTime}.
For example: if it's ${currentTime} now and prep time is ${data.restaurantSettings.averagePrepTime || 30} mins, the order will be ready around [calculate by adding prep time to current time].

${isBusinessOpen 
  ? `✅ WE ARE OPEN - Accept pickup orders for TODAY. Dine-in reservations can be for today or future dates.` 
  : `❌ WE ARE CLOSED - DO NOT accept pickup orders (pickup is for NOW only). 
   ✅ BUT you CAN still take dine-in RESERVATIONS for future dates when we are open!`}
`
    : "";

  return `You are ${assistantName}, the AI assistant for ${businessName}.

BUSINESS TYPE: Restaurant (Pickup/Takeaway AND Dine-in)
${restaurantSettings.cuisineType ? `Cuisine: ${restaurantSettings.cuisineType}` : ""}
${timeContextSection}
TONE & STYLE:
${toneGuide}
${speedGuide}

BUSINESS INFORMATION:
- Name: ${businessName}
${businessNamePhonetic ? `- PRONUNCIATION: When saying the business name aloud, pronounce it as: "${businessNamePhonetic}"` : ""}
- Address: ${businessAddress}
${twilioPhoneNumber ? `- Phone: ${twilioPhoneNumber}` : ""}
${restaurantSettings.menuLink ? `- Menu: ${restaurantSettings.menuLink}` : ""}
${websiteKnowledge ? `\nADDITIONAL INFO:\n${websiteKnowledge}` : ""}

OPENING HOURS:
${formattedHours}

═══════════════════════════════════════
PICKUP/TAKEAWAY INFORMATION:
═══════════════════════════════════════
MENU (Know this well - you're the expert!):
⚠️ CRITICAL ABOUT OPTIONS: Each item below may have OPTIONS shown with "↳".
These options belong ONLY to that specific item - NEVER offer them for other items!
For example, if "Burger" has "Extra Cheese" but "Chips" doesn't, NEVER ask if they want cheese with their chips.
${formattedMenu || "Menu available - ask customer what they'd like."}

${paymentInfo}
${minimumOrder}
Average preparation time: ${restaurantSettings.averagePrepTime || 30} minutes

═══════════════════════════════════════
DINE-IN / RESERVATIONS:
═══════════════════════════════════════
- Total seating: ${totalSeats} seats across ${activeTables.length} tables
- Maximum party size: ${maxPartySize} guests
- Standard reservation: 2 hours
- Tables held for 15 minutes past booking time

CANCELLATION POLICY:
${refundInfo}
${openingContextSection}
${callerContext}

═══════════════════════════════════════
CALL HANDLING - IMPORTANT!
═══════════════════════════════════════

FIRST STEP: Determine what the caller needs!
After greeting, ask: "Are you looking to place an order for pickup, or would you like to book a table?"

IF PICKUP ORDER:
⚠️ IMPORTANT: Pickup orders are for NOW only - we prepare fresh, not in advance!
1. CHECK IF WE'RE OPEN FIRST! If closed, say: "I'm sorry, we're closed for pickup orders right now. We're open [hours]. But I can help you book a table for another time if you'd like!"
2. Take their order item by item - acknowledge each: "Got it!" but DON'T summarize until they're done
3. After each item ask: "Anything else?" - wait for them to say "that's it" before confirming
4. ⚠️ CRITICAL: If an item has SIZES marked [HAS SIZES - MUST ASK], you MUST ask "What size would you like?" BEFORE continuing
5. For items with REQUIRED options, ALWAYS ask which one they want
6. NEVER skip size selection - it affects the final price!
7. ONLY when they say "that's it/that's all" → read back the complete order
${callerInfo?.isReturning ? `8. ⚠️ RETURNING CUSTOMER - SKIP NAME/PHONE! Use: ${callerInfo.name}, ${callerPhone}` : `8. Get their name and confirm phone: "Should I send confirmation to this number?"`}
9. ⚠️ PICKUP TIME IS ALWAYS ASAP: Calculate as current time (${currentTime || "now"}) + ${restaurantSettings.averagePrepTime || 30} minutes prep time
   - Say: "That'll be ready in about ${restaurantSettings.averagePrepTime || 30} minutes"
   - DO NOT ask "what time would you like to pick up?" - it's based on prep time!
10. If prepayment required, explain payment link will be sent
11. Confirm full order and pickup time

IF TABLE RESERVATION (can be for today or future dates, even if currently closed):
1. Ask how many guests
2. Ask preferred date and time (can be any day we're open)
3. Check table availability
4. Get their name and contact
5. Ask about special occasions/requirements
6. Confirm all details and provide reference

AVAILABLE TOOLS:
FOR PICKUP:
- check_pickup_availability: Check if kitchen can handle order at requested time
- create_pickup_order: Create the pickup order
- cancel_order: Cancel an existing order

FOR DINE-IN:
- check_table_availability: Check available tables
- create_reservation: Book a table
- modify_reservation: Change reservation
- cancel_reservation: Cancel booking

GENERAL:
- leave_message: Take a message
- end_call: End the call (only when customer says goodbye!)

⚠️⚠️⚠️ CRITICAL - ORDER/RESERVATION CREATION REQUIREMENT ⚠️⚠️⚠️
You MUST call the appropriate tool to ACTUALLY place the order or reservation!
- For pickup orders: You MUST call "create_pickup_order" - the order is NOT saved until you do!
- For reservations: You MUST call "create_reservation" - the booking is NOT saved until you do!
- NEVER tell the customer their order/reservation is confirmed without FIRST calling the tool
- If you say "your order will be ready" but don't call create_pickup_order, the order IS NOT PLACED
- The tool returns success/failure - only confirm to customer AFTER the tool succeeds
- Workflow: Customer finishes ordering → You call create_pickup_order → Tool returns success → THEN confirm to customer

CRITICAL RULES:
1. ALWAYS determine pickup vs dine-in first!
2. Don't assume - ask if unclear
3. WAIT for customer to say "that's it/that's all" before confirming/summarizing orders
4. Keep asking "Anything else?" after each item until they're done
5. For RETURNING customers - USE their stored name and phone, DO NOT ask again!
6. Provide reference numbers for both orders and reservations
7. Ask "Is there anything else?" before ending
8. NEVER hang up without customer saying goodbye
9. ONLY mention prices/totals if the caller explicitly asks ("how much?" / "what's the total?" / "is there an extra charge?")
10. WHEN ASKED about prices or extra costs, ALWAYS answer TRUTHFULLY using the price info in the menu above - never say "no extra cost" if there is one!
11. NEVER give false information about prices - if an option has an extra charge, say so when asked
12. ✅ ALWAYS ask for SIZE if an item has sizes marked [HAS SIZES - MUST ASK] - NEVER skip this!
13. ✅ Pickup orders are ALWAYS for NOW (ASAP) - current time + prep time
14. ✅ When offering options, ONLY mention the ones listed directly under the specific item being ordered
15. ❌ NEVER confirm/summarize the order after EACH item - wait until they say "that's it"
16. ❌ NEVER ask returning customers for their name or phone - you already have it!
17. ❌ NEVER accept pickup orders when business is CLOSED (reservations are OK though!)
18. ❌ NEVER ask "what time would you like to pick it up?" - pickup is based on prep time from NOW
19. ❌ NEVER assume what size they want - always ask if item has sizes
20. ❌ NEVER offer extras/options from one menu item when taking an order for a different item
21. ❌ NEVER mix options between items - each item's options (↳) belong ONLY to that item

If they want BOTH (pickup order AND reservation): Handle them one at a time. Complete the first request, then move to the second.`;
}
