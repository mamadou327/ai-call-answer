// Restaurant Hybrid specific system prompt builder
// Used for restaurants that do both pickup/takeaway AND dine-in reservations

interface RestaurantHybridPromptData {
  businessName: string;
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
}

export function buildRestaurantHybridSystemPrompt(data: RestaurantHybridPromptData): string {
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
    tables,
    menuCategories,
    menuItems,
    menuItemOptions = [],
    menuItemOptionGroups = [],
    businessSettings,
    restaurantSettings,
    callerInfo,
    openingContext,
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
  
  // Helper to format item options with their sizes
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
          if (opt.has_sizes && opt.sizes && opt.sizes.length > 0) {
            const sizesList = opt.sizes.map((s: any) => `${s.name}`).join(", ");
            return `${opt.name} [HAS SIZES - MUST ASK: ${sizesList}]`;
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
RETURNING CUSTOMER:
- Name: ${callerInfo.name}
- Previous orders/visits: ${callerInfo.totalVisits}
${callerInfo.upcomingBooking ? `- UPCOMING BOOKING: ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} (Ref: ${callerInfo.upcomingBooking.code})` : ""}

Greet them: "Hi ${callerInfo.name?.split(" ")[0]}, lovely to hear from you again!"`;
  } else {
    callerContext = `
NEW CALLER: ${callerPhone}
Be welcoming! Ask for their name when taking order or reservation.`;
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

  return `You are ${assistantName}, the AI assistant for ${businessName}.

BUSINESS TYPE: Restaurant (Pickup/Takeaway AND Dine-in)
${restaurantSettings.cuisineType ? `Cuisine: ${restaurantSettings.cuisineType}` : ""}

TONE & STYLE:
${toneGuide}
${speedGuide}

BUSINESS INFORMATION:
- Name: ${businessName}
- Address: ${businessAddress}
${twilioPhoneNumber ? `- Phone: ${twilioPhoneNumber}` : ""}
${restaurantSettings.menuLink ? `- Menu: ${restaurantSettings.menuLink}` : ""}
${websiteKnowledge ? `\nADDITIONAL INFO:\n${websiteKnowledge}` : ""}

OPENING HOURS:
${formattedHours}

═══════════════════════════════════════
PICKUP/TAKEAWAY INFORMATION:
═══════════════════════════════════════
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
1. Take their order item by item
2. For items with REQUIRED options, ALWAYS ask which one they want
3. ⚠️ CRITICAL: If an option has SIZES (marked HAS SIZES), you MUST ask "What size?" (only mention prices if the caller asks)
4. NEVER skip size selection - it affects the final price!
5. Confirm each item with selected options/sizes and running total
6. Get their name
7. For phone: Ask "Should I send the confirmation to this number or a different one?"
8. Suggest pickup time (prep time + current time)
9. If prepayment required, explain payment link will be sent
10. Confirm full order and collection time

IF TABLE RESERVATION:
1. Ask how many guests
2. Ask preferred date and time
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

CRITICAL RULES:
1. ALWAYS determine pickup vs dine-in first!
2. Don't assume - ask if unclear
3. Confirm all details before finalizing
4. Provide reference numbers for both orders and reservations
5. Ask "Is there anything else?" before ending
6. NEVER hang up without customer saying goodbye

If they want BOTH (pickup order AND reservation): Handle them one at a time. Complete the first request, then move to the second.`;
}
