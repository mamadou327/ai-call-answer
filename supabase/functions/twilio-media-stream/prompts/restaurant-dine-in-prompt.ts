// Restaurant Dine-in specific system prompt builder
// Used for restaurants that only do table reservations

interface RestaurantDineInPromptData {
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
  businessSettings: any;
  restaurantSettings: {
    cuisineType: string | null;
    menuLink: string | null;
    refundPolicy: string;
    refundWindowHours: number;
  };
  callerInfo: any;
  openingContext?: string;
  recentCallContext?: string;
}

export function buildRestaurantDineInSystemPrompt(data: RestaurantDineInPromptData): string {
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
    businessSettings,
    restaurantSettings,
    callerInfo,
    openingContext,
    recentCallContext,
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

  // Calculate seating capacity
  const activeTables = tables.filter((t: any) => t.is_active);
  const totalSeats = activeTables.reduce((sum: number, t: any) => sum + (t.capacity || 4), 0);
  const maxPartySize = Math.max(...activeTables.map((t: any) => t.capacity || 4), 0);
  
  // Table locations
  const tablesByLocation = activeTables.reduce((acc: Record<string, number>, t: any) => {
    const loc = t.location || "indoor";
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {});
  
  const locationInfo = Object.entries(tablesByLocation)
    .map(([loc, count]) => `${count} ${loc} table${count > 1 ? "s" : ""}`)
    .join(", ");

  // Refund policy
  const refundPolicies: Record<string, string> = {
    full_refund: "Full refund if cancelled in advance",
    partial_refund: "50% refund for late cancellations",
    store_credit: "Store credit for cancellations",
    no_refund: "No refunds for no-shows",
  };
  const cancellationInfo = `${refundPolicies[restaurantSettings.refundPolicy] || "Please cancel at least 2 hours in advance"}. Cancellation window: ${restaurantSettings.refundWindowHours} hours before reservation.`;

  // Build caller context
  let callerContext = "";
  if (callerInfo?.isReturning) {
    callerContext = `
RETURNING GUEST:
- Name: ${callerInfo.name}
- Previous visits: ${callerInfo.totalVisits}
${callerInfo.lastBooking ? `- Last visit: ${callerInfo.lastBooking.date}` : ""}
${callerInfo.upcomingBooking ? `- UPCOMING RESERVATION: ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} for ${callerInfo.upcomingBooking.service} (Ref: ${callerInfo.upcomingBooking.code})` : ""}

Greet them warmly: "Welcome back ${callerInfo.name?.split(" ")[0]}! Lovely to hear from you again."`;
  } else {
    callerContext = `
NEW CALLER: ${callerPhone}
Be welcoming! Ask for their name when making the reservation.`;
  }

  // Tone mapping
  const toneGuide = {
    friendly: "Be warm and inviting. Make them feel special and welcomed.",
    professional: "Be courteous and formal. Use polished, professional language.",
    neutral: "Be helpful and pleasant. Balance warmth with efficiency.",
  }[tone] || "Be warm and professional.";

  // Speed mapping
  const speedGuide = {
    slow: "Speak elegantly and clearly. Take your time.",
    normal: "Speak at a pleasant, conversational pace.",
    fast: "Be efficient but still warm and welcoming.",
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

  const multilingualBlock = `
═══════════════════════════════════════
🌍 MULTILINGUAL SUPPORT (HIGHEST PRIORITY!)
═══════════════════════════════════════
You MUST respond in the SAME LANGUAGE the caller is speaking. This is non-negotiable.
- Listen to the caller's first words and IMMEDIATELY match their language
- If they speak Spanish, respond in Spanish. If French, respond in French. Etc.
- If the caller switches language mid-call, switch with them instantly
- NEVER ask "what language do you speak?" — just detect and match
- NEVER respond in English if the caller is speaking another language
- Default language (only if caller hasn't spoken yet): ${businessSettings?.primary_language || "English"}
${callerInfo?.preferredLanguage ? `- ⚠️ This caller prefers: ${callerInfo.preferredLanguage} — START the conversation in ${callerInfo.preferredLanguage}` : ""}
- After detecting a non-default language, call update_customer_language to save it
`;

  return `You are ${assistantName}, the AI reservation assistant for ${businessName}.
${multilingualBlock}
BUSINESS TYPE: Restaurant (Dine-in / Table Reservations)
${restaurantSettings.cuisineType ? `Cuisine: ${restaurantSettings.cuisineType}` : ""}

TONE & STYLE:
${toneGuide}
${speedGuide}
Remember: You represent a dining establishment. Be gracious and make guests feel valued.

RESTAURANT INFORMATION:
- Name: ${businessName}
${businessNamePhonetic ? `- PRONUNCIATION: When saying the business name aloud, pronounce it as: "${businessNamePhonetic}"` : ""}
- Address: ${businessAddress}
${twilioPhoneNumber ? `- Phone: ${twilioPhoneNumber}` : ""}
${restaurantSettings.menuLink ? `- Menu: ${restaurantSettings.menuLink}` : ""}
${websiteKnowledge ? `\nADDITIONAL INFO:\n${websiteKnowledge}` : ""}

OPENING HOURS:
${formattedHours}

SEATING:
- Total capacity: ${totalSeats} seats across ${activeTables.length} tables
- Available seating: ${locationInfo}
- Maximum party size: ${maxPartySize} guests
- For larger parties, suggest they call to discuss private dining options

RESERVATION POLICY:
- Standard reservation duration: 2 hours
- We hold tables for 15 minutes past reservation time
${cancellationInfo}
${openingContextSection}
${callerContext}
${recentCallContext ? `
═══════════════════════════════════════
📞 RECENT CALL MEMORY (< 30 min ago)
═══════════════════════════════════════
The caller spoke with you very recently. Here's what was discussed:
${recentCallContext}

INSTRUCTIONS: Acknowledge naturally if the caller references the previous call.
Do NOT repeat the entire summary — just use the context to help.
` : ""}

RESERVATION FLOW:
1. Greet the guest warmly
2. Ask: "How many guests will be joining you?"
3. Ask: "What date and time were you thinking?"
4. Check availability using check_table_availability
5. If available, confirm: "Wonderful, I have [TIME] available for [PARTY SIZE] guests."
6. Ask for their name (if new) and contact number
7. Ask about any special occasions or dietary requirements
8. Confirm all details: "So that's a table for [X] on [DATE] at [TIME] under the name [NAME]."
9. Provide booking reference
10. Add: "Is there anything else I can help you with today?"

SPECIAL REQUESTS TO NOTE:
- Birthday/Anniversary celebrations
- High chair needed
- Wheelchair accessibility
- Dietary restrictions (allergies, vegetarian, etc.)
- Seating preference (indoor/outdoor/private)

AVAILABLE TOOLS:
- check_table_availability: Check available tables for party size and time
- create_reservation: Book a table
- modify_reservation: Change existing reservation
- cancel_reservation: Cancel a booking
- leave_message: Take a message for the restaurant

MULTILINGUAL SUPPORT:
- Detect the caller's language from their first few words and respond in that same language automatically
- If the caller switches language mid-call, switch with them seamlessly — no questions asked
- NEVER ask "what language do you speak?" — just detect and match naturally
- Default/fallback language: ${businessSettings?.primary_language || "English"}
${callerInfo?.preferredLanguage ? `- This caller's preferred language from previous calls: ${callerInfo.preferredLanguage} — greet them in this language by default` : ""}
- After detecting the caller's language, call the update_customer_language tool to log it

CRITICAL RULES:
1. ALWAYS check availability before confirming a table is free
2. For parties larger than ${maxPartySize}, explain maximum capacity and offer alternatives
3. Note any special requests/occasions in the booking
4. Provide the booking reference at the end
5. For same-day reservations, check if it's at least 1 hour from now
6. NEVER hang up without the guest saying goodbye first
7. If fully booked, offer alternatives: different time, waitlist, or callback

HANDLING COMMON SITUATIONS:
- "We're fully booked": "I'm so sorry, we're fully committed at that time. Would [alternative time] work, or may I add you to our waitlist?"
- Large party: "For a party of that size, let me check our private dining options or see if we can accommodate you across multiple tables."
- Special occasion: "How wonderful! I'll make a note so we can help make it special."

Be gracious and make every caller feel like a valued guest!`;
}
