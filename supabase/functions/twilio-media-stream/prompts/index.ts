// Prompt router - selects the appropriate prompt builder based on business type

import { buildSalonSystemPrompt } from "./salon-prompt.ts";
import { buildRestaurantPickupSystemPrompt } from "./restaurant-pickup-prompt.ts";
import { buildRestaurantDineInSystemPrompt } from "./restaurant-dine-in-prompt.ts";
import { buildRestaurantHybridSystemPrompt } from "./restaurant-hybrid-prompt.ts";

export type BusinessType = "salon" | "restaurant_pickup" | "restaurant_dine_in" | "restaurant_hybrid";

interface PromptBuilderParams {
  businessType: BusinessType;
  businessName: string;
  businessNamePhonetic?: string; // Phonetic pronunciation for the AI to use when speaking
  businessAddress: string;
  assistantName: string;
  tone: string;
  voiceSpeed: string;
  callerPhone: string;
  twilioPhoneNumber: string | null;
  websiteKnowledge: string | null;
  openingHours: any[];
  businessSettings: any;
  callerInfo: any;
  openingContext?: string;
  recentCallContext?: string;
  // Time context for AI awareness
  currentTime?: string;     // Current time in business timezone (e.g., "14:30")
  currentDate?: string;     // Full date (e.g., "14 January 2026")
  currentDay?: string;      // Day name (e.g., "Tuesday")
  businessStatus?: string;  // "OPEN (11:00-22:00)" or "CLOSED"
  // Salon-specific
  staff?: any[];
  services?: any[];
  staffServices?: any[];
  staffTimeOff?: any[];
  customerSettings?: any;
  // Restaurant-specific
  tables?: any[];
  menuCategories?: any[];
  menuItems?: any[];
  menuItemOptionGroups?: any[];
  menuItemOptions?: any[];
  restaurantSettings?: {
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
}

export function buildSystemPromptForBusinessType(params: PromptBuilderParams): string {
  const { businessType } = params;

  switch (businessType) {
    case "salon":
      return buildSalonSystemPrompt({
        businessName: params.businessName,
        businessNamePhonetic: params.businessNamePhonetic,
        businessAddress: params.businessAddress,
        assistantName: params.assistantName,
        tone: params.tone,
        voiceSpeed: params.voiceSpeed,
        callerPhone: params.callerPhone,
        twilioPhoneNumber: params.twilioPhoneNumber,
        websiteKnowledge: params.websiteKnowledge,
        openingHours: params.openingHours,
        staff: params.staff || [],
        services: params.services || [],
        staffServices: params.staffServices || [],
        staffTimeOff: params.staffTimeOff || [],
        businessSettings: params.businessSettings,
        callerInfo: params.callerInfo,
        customerSettings: params.customerSettings || {},
        openingContext: params.openingContext,
        recentCallContext: params.recentCallContext,
      });

    case "restaurant_pickup":
      return buildRestaurantPickupSystemPrompt({
        businessName: params.businessName,
        businessNamePhonetic: params.businessNamePhonetic,
        businessAddress: params.businessAddress,
        assistantName: params.assistantName,
        tone: params.tone,
        voiceSpeed: params.voiceSpeed,
        callerPhone: params.callerPhone,
        twilioPhoneNumber: params.twilioPhoneNumber,
        websiteKnowledge: params.websiteKnowledge,
        openingHours: params.openingHours,
        menuCategories: params.menuCategories || [],
        menuItems: params.menuItems || [],
        menuItemOptionGroups: params.menuItemOptionGroups || [],
        menuItemOptions: params.menuItemOptions || [],
        businessSettings: params.businessSettings,
        restaurantSettings: params.restaurantSettings || getDefaultRestaurantSettings(),
        callerInfo: params.callerInfo,
        openingContext: params.openingContext,
        recentCallContext: params.recentCallContext,
        currentTime: params.currentTime,
        currentDate: params.currentDate,
        currentDay: params.currentDay,
        businessStatus: params.businessStatus,
      });

    case "restaurant_dine_in":
      return buildRestaurantDineInSystemPrompt({
        businessName: params.businessName,
        businessNamePhonetic: params.businessNamePhonetic,
        businessAddress: params.businessAddress,
        assistantName: params.assistantName,
        tone: params.tone,
        voiceSpeed: params.voiceSpeed,
        callerPhone: params.callerPhone,
        twilioPhoneNumber: params.twilioPhoneNumber,
        websiteKnowledge: params.websiteKnowledge,
        openingHours: params.openingHours,
        tables: params.tables || [],
        businessSettings: params.businessSettings,
        restaurantSettings: {
          cuisineType: params.restaurantSettings?.cuisineType || null,
          menuLink: params.restaurantSettings?.menuLink || null,
          refundPolicy: params.restaurantSettings?.refundPolicy || "full_refund",
          refundWindowHours: params.restaurantSettings?.refundWindowHours || 2,
        },
        callerInfo: params.callerInfo,
        openingContext: params.openingContext,
      });

    case "restaurant_hybrid":
      return buildRestaurantHybridSystemPrompt({
        businessName: params.businessName,
        businessNamePhonetic: params.businessNamePhonetic,
        businessAddress: params.businessAddress,
        assistantName: params.assistantName,
        tone: params.tone,
        voiceSpeed: params.voiceSpeed,
        callerPhone: params.callerPhone,
        twilioPhoneNumber: params.twilioPhoneNumber,
        websiteKnowledge: params.websiteKnowledge,
        openingHours: params.openingHours,
        tables: params.tables || [],
        menuCategories: params.menuCategories || [],
        menuItems: params.menuItems || [],
        businessSettings: params.businessSettings,
        restaurantSettings: params.restaurantSettings || getDefaultRestaurantSettings(),
        callerInfo: params.callerInfo,
        openingContext: params.openingContext,
        currentTime: params.currentTime,
        currentDate: params.currentDate,
        currentDay: params.currentDay,
        businessStatus: params.businessStatus,
      });

    default:
      // Default to salon for unknown types
      console.warn(`[PromptRouter] Unknown business type: ${businessType}, defaulting to salon`);
      return buildSalonSystemPrompt({
        businessName: params.businessName,
        businessNamePhonetic: params.businessNamePhonetic,
        businessAddress: params.businessAddress,
        assistantName: params.assistantName,
        tone: params.tone,
        voiceSpeed: params.voiceSpeed,
        callerPhone: params.callerPhone,
        twilioPhoneNumber: params.twilioPhoneNumber,
        websiteKnowledge: params.websiteKnowledge,
        openingHours: params.openingHours,
        staff: params.staff || [],
        services: params.services || [],
        staffServices: params.staffServices || [],
        staffTimeOff: params.staffTimeOff || [],
        businessSettings: params.businessSettings,
        callerInfo: params.callerInfo,
        customerSettings: params.customerSettings || {},
        openingContext: params.openingContext,
      });
  }
}

function getDefaultRestaurantSettings() {
  return {
    cuisineType: null,
    menuLink: null,
    paymentMethods: ["card"],
    requirePrepayment: false,
    prepaymentType: "none",
    minimumOrderAmount: null,
    refundPolicy: "full_refund",
    refundWindowHours: 2,
    averagePrepTime: 30,
  };
}

// Get the appropriate tools for a business type
export function getToolsForBusinessType(businessType: BusinessType): any[] {
  const commonTools = [
    {
      type: "function",
      name: "leave_message",
      description: "Leave a message for the business.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The message content" },
          recipient_type: { type: "string", enum: ["all", "admin", "staff"], description: "Who should receive the message" },
          is_urgent: { type: "boolean", description: "Whether the message is urgent" },
        },
        required: ["message", "recipient_type"],
      },
    },
    {
      type: "function",
      name: "end_call",
      description: "End the phone call. ONLY call when customer explicitly says goodbye.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Must be 'customer_said_goodbye'" },
        },
        required: ["reason"],
      },
    },
  ];

  switch (businessType) {
    case "salon":
      return [
        ...commonTools,
        {
          type: "function",
          name: "create_booking",
          description: "Create a new appointment booking.",
          parameters: {
            type: "object",
            properties: {
              customer_name: { type: "string" },
              customer_phone: { type: "string" },
              customer_email: { type: "string" },
              service_name: { type: "string" },
              staff_name: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
            },
            required: ["customer_name", "customer_phone", "service_name", "staff_name", "date", "time"],
          },
        },
        {
          type: "function",
          name: "check_availability",
          description: "Check staff availability for appointments.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string" },
              time: { type: "string" },
              service_name: { type: "string" },
              staff_name: { type: "string" },
            },
            required: ["date"],
          },
        },
        {
          type: "function",
          name: "cancel_booking",
          description: "Cancel an existing booking.",
          parameters: {
            type: "object",
            properties: {
              booking_code: { type: "string" },
              customer_name: { type: "string" },
            },
          },
        },
        {
          type: "function",
          name: "reschedule_booking",
          description: "Reschedule an existing booking.",
          parameters: {
            type: "object",
            properties: {
              booking_code: { type: "string" },
              customer_name: { type: "string" },
              new_date: { type: "string" },
              new_time: { type: "string" },
            },
            required: ["new_date", "new_time"],
          },
        },
        {
          type: "function",
          name: "transfer_call",
          description: "Transfer call to a staff member.",
          parameters: {
            type: "object",
            properties: {
              staff_name: { type: "string" },
              reason: { type: "string" },
            },
            required: ["staff_name"],
          },
        },
      ];

    case "restaurant_pickup":
      return [
        ...commonTools,
        {
          type: "function",
          name: "check_pickup_availability",
          description: "Check if kitchen can handle order at requested pickup time.",
          parameters: {
            type: "object",
            properties: {
              pickup_time: { type: "string", description: "Requested pickup time in HH:MM format" },
              order_items: { type: "array", items: { type: "string" }, description: "List of menu items" },
            },
            required: ["pickup_time"],
          },
        },
        {
          type: "function",
          name: "create_pickup_order",
          description: "Create a pickup/takeaway order. Always collect customer name and phone. Email is optional but helpful for receipts.",
          parameters: {
            type: "object",
            properties: {
              customer_name: { type: "string", description: "Customer's name for the order" },
              customer_phone: { type: "string", description: "Customer's phone number for confirmation SMS" },
              customer_email: { type: "string", description: "Customer's email (optional) for receipts" },
              items: {
                type: "array",
                description: "List of items being ordered",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Menu item name" },
                    quantity: { type: "number", description: "Number of this item" },
                    notes: { type: "string", description: "Special instructions or options for this item" },
                    size: { type: "string", description: "Size if applicable (e.g., small, large)" },
                  },
                  required: ["name"],
                },
              },
              pickup_time: { type: "string", description: "Time for pickup in HH:MM format (24-hour)" },
              special_requests: { type: "string", description: "Any overall special requests for the order" },
            },
            required: ["customer_name", "customer_phone", "items", "pickup_time"],
          },
        },
        {
          type: "function",
          name: "cancel_order",
          description: "Cancel a pickup order.",
          parameters: {
            type: "object",
            properties: {
              order_code: { type: "string" },
              customer_name: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
      ];

    case "restaurant_dine_in":
      return [
        ...commonTools,
        {
          type: "function",
          name: "check_table_availability",
          description: "Check available tables for party size and time.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Date in YYYY-MM-DD format" },
              time: { type: "string", description: "Time in HH:MM format" },
              party_size: { type: "number", description: "Number of guests" },
              seating_preference: { type: "string", enum: ["indoor", "outdoor", "private", "any"] },
            },
            required: ["date", "time", "party_size"],
          },
        },
        {
          type: "function",
          name: "create_reservation",
          description: "Book a table reservation.",
          parameters: {
            type: "object",
            properties: {
              customer_name: { type: "string" },
              customer_phone: { type: "string" },
              customer_email: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              party_size: { type: "number" },
              seating_preference: { type: "string" },
              special_occasion: { type: "string" },
              special_requests: { type: "string" },
            },
            required: ["customer_name", "customer_phone", "date", "time", "party_size"],
          },
        },
        {
          type: "function",
          name: "modify_reservation",
          description: "Modify an existing reservation.",
          parameters: {
            type: "object",
            properties: {
              reservation_code: { type: "string" },
              customer_name: { type: "string" },
              new_date: { type: "string" },
              new_time: { type: "string" },
              new_party_size: { type: "number" },
            },
          },
        },
        {
          type: "function",
          name: "cancel_reservation",
          description: "Cancel a table reservation.",
          parameters: {
            type: "object",
            properties: {
              reservation_code: { type: "string" },
              customer_name: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
      ];

    case "restaurant_hybrid":
      // Combine both pickup and dine-in tools
      return [
        ...commonTools,
        // Pickup tools
        {
          type: "function",
          name: "check_pickup_availability",
          description: "Check if kitchen can handle order at requested pickup time.",
          parameters: {
            type: "object",
            properties: {
              pickup_time: { type: "string" },
              order_items: { type: "array", items: { type: "string" } },
            },
            required: ["pickup_time"],
          },
        },
        {
          type: "function",
          name: "create_pickup_order",
          description: "Create a pickup/takeaway order. Always collect customer name and phone. Email is optional.",
          parameters: {
            type: "object",
            properties: {
              customer_name: { type: "string", description: "Customer's name for the order" },
              customer_phone: { type: "string", description: "Customer's phone number for confirmation" },
              customer_email: { type: "string", description: "Customer's email (optional)" },
              items: { 
                type: "array", 
                items: { 
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    quantity: { type: "number" },
                    notes: { type: "string" },
                    size: { type: "string" },
                  },
                },
              },
              pickup_time: { type: "string" },
              special_requests: { type: "string" },
            },
            required: ["customer_name", "customer_phone", "items", "pickup_time"],
          },
        },
        {
          type: "function",
          name: "cancel_order",
          description: "Cancel a pickup order.",
          parameters: {
            type: "object",
            properties: {
              order_code: { type: "string" },
              customer_name: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        // Dine-in tools
        {
          type: "function",
          name: "check_table_availability",
          description: "Check available tables for party size and time.",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string" },
              time: { type: "string" },
              party_size: { type: "number" },
              seating_preference: { type: "string" },
            },
            required: ["date", "time", "party_size"],
          },
        },
        {
          type: "function",
          name: "create_reservation",
          description: "Book a table reservation.",
          parameters: {
            type: "object",
            properties: {
              customer_name: { type: "string" },
              customer_phone: { type: "string" },
              date: { type: "string" },
              time: { type: "string" },
              party_size: { type: "number" },
              special_requests: { type: "string" },
            },
            required: ["customer_name", "customer_phone", "date", "time", "party_size"],
          },
        },
        {
          type: "function",
          name: "cancel_reservation",
          description: "Cancel a table reservation.",
          parameters: {
            type: "object",
            properties: {
              reservation_code: { type: "string" },
              customer_name: { type: "string" },
            },
          },
        },
      ];

    default:
      return commonTools;
  }
}

// Combined function that returns both prompt and tools based on business type
export function getSystemPromptAndTools(params: PromptBuilderParams): { prompt: string; tools: any[] } {
  const prompt = buildSystemPromptForBusinessType(params);
  const tools = getToolsForBusinessType(params.businessType);
  return { prompt, tools };
}
