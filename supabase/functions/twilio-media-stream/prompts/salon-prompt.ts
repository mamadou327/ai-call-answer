// Salon-specific system prompt builder
// Used for salons, barbershops, spas - appointment-based services
import { formatPriceForSpeech } from "./advanced-rules.ts";

interface SalonPromptData {
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
  staff: any[];
  services: any[];
  staffServices: any[];
  staffTimeOff: any[];
  businessSettings: any;
  callerInfo: any;
  customerSettings: any;
  openingContext?: string;
  recentCallContext?: string;
}

export function buildSalonSystemPrompt(data: SalonPromptData): string {
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
    staff,
    services,
    staffServices,
    staffTimeOff,
    businessSettings,
    callerInfo,
    customerSettings,
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
      return `${day}: ${h.open_time?.slice(0, 5) || "09:00"} - ${h.close_time?.slice(0, 5) || "17:00"}`;
    })
    .join("\n");

  // Format services with categories
  const servicesByCategory = services.reduce((acc: Record<string, any[]>, service: any) => {
    const cat = service.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const salonCurrency = businessSettings?.currency || "GBP";
  let formattedServices = "";
  for (const [category, categoryServices] of Object.entries(servicesByCategory)) {
    formattedServices += `\n${category}:\n`;
    for (const service of categoryServices as any[]) {
      const deposit = service.deposit_required ? ` (Deposit: ${formatPriceForSpeech(service.deposit_amount, salonCurrency)})` : "";
      formattedServices += `  - ${service.name}: ${service.duration_minutes} minutes, ${formatPriceForSpeech(service.price, salonCurrency)}${deposit}\n`;
    }
  }

  // Format staff with their services
  const formattedStaff = staff.map((s: any) => {
    const staffServiceIds = staffServices.filter((ss: any) => ss.staff_id === s.id).map((ss: any) => ss.service_id);
    const staffServiceNames = services.filter((svc: any) => staffServiceIds.includes(svc.id)).map((svc: any) => svc.name);
    
    if (!s.ai_enabled) {
      return `- ${s.name} (${s.role}) [TRANSFER ONLY - cannot book via AI]`;
    }
    
    const serviceList = staffServiceNames.length > 0 ? `[CAN ONLY BOOK FOR: ${staffServiceNames.join(", ")}]` : "[NO SERVICES ASSIGNED]";
    return `- ${s.name} (${s.role}) ${serviceList}`;
  }).join("\n");

  // Format time off
  const formattedTimeOff = staffTimeOff.length > 0
    ? staffTimeOff.map((to: any) => `- ${to.staff_name || "Staff"}: ${to.start_time} to ${to.end_time} (${to.reason})`).join("\n")
    : "No scheduled time off.";

  // Build caller context
  let callerContext = "";
  if (callerInfo?.isReturning) {
    callerContext = `
RETURNING CUSTOMER DETECTED:
- Name: ${callerInfo.name}
- Total visits: ${callerInfo.totalVisits}
${callerInfo.preferredStaff ? `- Preferred staff: ${callerInfo.preferredStaff}` : ""}
${callerInfo.lastBooking ? `- Last booking: ${callerInfo.lastBooking.service} with ${callerInfo.lastBooking.staff} on ${callerInfo.lastBooking.date}` : ""}
${callerInfo.upcomingBooking ? `- UPCOMING BOOKING: ${callerInfo.upcomingBooking.service} on ${callerInfo.upcomingBooking.date} at ${callerInfo.upcomingBooking.time} (Code: ${callerInfo.upcomingBooking.code})` : ""}

INSTRUCTIONS: Greet them by name! Say "Hi ${callerInfo.name?.split(" ")[0]}, great to hear from you again!" at the start.`;
  } else {
    callerContext = `
NEW CALLER: Phone ${callerPhone}
This appears to be a new customer. Be welcoming and ask for their name when making a booking.`;
  }

  // Tone mapping
  const toneGuide = {
    friendly: "Be warm, approachable, and conversational. Use casual language.",
    professional: "Be polite, formal, and business-like. Use professional language.",
    neutral: "Be balanced - professional but not stiff, friendly but not overly casual.",
  }[tone] || "Be balanced and professional.";

  // Speed mapping
  const speedGuide = {
    slow: "Speak slowly and clearly. Pause between sentences.",
    normal: "Speak at a natural, conversational pace.",
    fast: "Speak briskly but clearly. Be concise.",
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

  // Cancellation policy
  const cancellationPolicy = businessSettings?.cancellation_policy || "Please cancel at least 24 hours in advance.";

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

  return `You are ${assistantName}, the AI phone assistant for ${businessName}.
${multilingualBlock}
BUSINESS TYPE: Salon/Barbershop/Spa (Appointment-based services)

TONE & STYLE:
${toneGuide}
${speedGuide}

BUSINESS INFORMATION:
- Name: ${businessName}
${businessNamePhonetic ? `- PRONUNCIATION: When saying the business name aloud, pronounce it as: "${businessNamePhonetic}"` : ""}
- Address: ${businessAddress}
${twilioPhoneNumber ? `- Phone: ${twilioPhoneNumber}` : ""}
${websiteKnowledge ? `\nWEBSITE KNOWLEDGE:\n${websiteKnowledge}` : ""}

LIVE REFERENCE DATA (DO NOT GUESS — CALL THE TOOL):
- This business has ${services.length} service(s), ${staff.length} staff member(s), and weekly opening hours configured.
- Before listing or quoting ANY service, price, duration or deposit → call get_services.
- Before naming, listing or confirming ANY staff member or their eligibility for a service → call get_staff.
- Before stating opening/closing times or which days are open → call get_opening_hours.
- NEVER read services, staff or hours from memory. They are NOT in this prompt — you MUST fetch them.
${staffTimeOff.length > 0 ? `\nACTIVE STAFF TIME OFF (already loaded, safe to use):\n${formattedTimeOff}` : ""}

BOOKING RULES:
- Minimum notice: ${businessSettings?.min_booking_notice_hours || 2} hours
- Maximum advance booking: ${businessSettings?.max_days_advance || 30} days
- Cancellation notice required: ${businessSettings?.min_cancellation_notice_hours || 24} hours
- Cancellation policy: ${cancellationPolicy}
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

CRITICAL RULES:
1. ALWAYS use check_availability tool BEFORE confirming any time is available
2. VERIFY staff can provide the requested service (check [CAN ONLY BOOK FOR:] list)
3. For staff marked [TRANSFER ONLY], use transfer_call tool instead of booking
4. Collect customer name and phone for new customers before booking
5. Confirm all details before calling create_booking
6. After booking, ask "Is there anything else I can help you with?"
7. NEVER hang up without the customer saying goodbye first

IMPORTANT: Be conversational and natural. Don't sound robotic. Listen carefully to what the customer needs.`;
}
