// Demo account configuration
// These are special demo accounts that display fake data for screenshots

export const DEMO_ACCOUNTS = {
  salon: {
    email: "demo-salon@aivia.app",
    password: "AiviaDemo2024!",
    businessType: "salon",
    businessName: "Luxe Hair Studio",
  },
  pickup: {
    email: "demo-pickup@aivia.app",
    password: "AiviaDemo2024!",
    businessType: "restaurant_pickup",
    businessName: "Fresh Bites Takeaway",
  },
  dinein: {
    email: "demo-dinein@aivia.app",
    password: "AiviaDemo2024!",
    businessType: "restaurant_dine_in",
    businessName: "The Golden Table",
  },
  hybrid: {
    email: "demo-hybrid@aivia.app",
    password: "AiviaDemo2024!",
    businessType: "restaurant_hybrid",
    businessName: "Bella's Kitchen",
  },
};

export const DEMO_EMAILS = Object.values(DEMO_ACCOUNTS).map((acc) => acc.email);

export function isDemoAccount(email: string | undefined | null): boolean {
  if (!email) return false;
  return DEMO_EMAILS.includes(email.toLowerCase());
}

export function getDemoBusinessType(email: string | undefined | null): string | null {
  if (!email) return null;
  const account = Object.values(DEMO_ACCOUNTS).find(
    (acc) => acc.email.toLowerCase() === email.toLowerCase()
  );
  return account?.businessType || null;
}

// Demo business data
export const DEMO_BUSINESS = {
  salon: {
    id: "demo-salon-id",
    business_name: "Luxe Hair Studio",
    address: "123 High Street, London, UK",
    main_phone: "+44 20 7123 4567",
    business_type: "salon",
    status: "approved",
    aivia_active: true,
    plan_tier: "professional",
    assigned_aivia_number: "+44 20 7946 0958",
    owner_id: "demo-salon-user",
  },
  restaurant_pickup: {
    id: "demo-pickup-id",
    business_name: "Fresh Bites Takeaway",
    address: "45 Market Street, Manchester, UK",
    main_phone: "+44 161 123 4567",
    business_type: "restaurant_pickup",
    status: "approved",
    aivia_active: true,
    plan_tier: "professional",
    assigned_aivia_number: "+44 161 946 0123",
    owner_id: "demo-pickup-user",
    average_prep_time_minutes: 20,
  },
  restaurant_dine_in: {
    id: "demo-dinein-id",
    business_name: "The Golden Table",
    address: "78 Victoria Road, Birmingham, UK",
    main_phone: "+44 121 123 4567",
    business_type: "restaurant_dine_in",
    status: "approved",
    aivia_active: true,
    plan_tier: "professional",
    assigned_aivia_number: "+44 121 946 0456",
    owner_id: "demo-dinein-user",
  },
  restaurant_hybrid: {
    id: "demo-hybrid-id",
    business_name: "Bella's Kitchen",
    address: "92 Queen Street, Edinburgh, UK",
    main_phone: "+44 131 123 4567",
    business_type: "restaurant_hybrid",
    status: "approved",
    aivia_active: true,
    plan_tier: "professional",
    assigned_aivia_number: "+44 131 946 0789",
    owner_id: "demo-hybrid-user",
    average_prep_time_minutes: 25,
  },
};

// Demo settings data
export const DEMO_SETTINGS = {
  currency: "GBP",
  primary_language: "en-GB",
  assistant_name: "Sophie",
  tone: "professional",
  min_booking_notice_hours: 2,
  max_days_advance: 30,
  cancellation_policy: "Cancellations must be made at least 24 hours in advance.",
};

// Demo dashboard stats
export const DEMO_SALON_STATS = {
  // Monthly figures (used by the in-app SalonDashboardTab demo)
  bookingsCount: 247,
  cancelledCount: 12,
  revenue: 8450,
  callsCount: 189,
  messagesCount: 8,
  // Landing-demo "today" view fields — match the 5-appointment list (£150+£45+£85+£55+£180 = £515)
  appointmentsCount: 5,
  completedCount: 3,
  todayCancelledCount: 1,
  todayRevenue: 515,
  todayCallsCount: 12,
  todayMessagesCount: 4,
};

export const DEMO_RESTAURANT_STATS = {
  ordersCount: 24,
  completedCount: 21,
  cancelledCount: 2,
  revenue: 485,
  callsCount: 18,
  messagesCount: 5,
};

export const DEMO_RESERVATION_STATS = {
  reservationsCount: 18,
  cancelledCount: 1,
  noShowCount: 1,
  totalCovers: 56,
};

// Demo call stats for calls tab (consistent with dashboard stats)
export const DEMO_CALLS_STATS = {
  totalCalls: 18,
  bookingsCreated: 20,
  enquiries: 4,
  cancellations: 2,
};

// Demo today's appointments (Luxe Hair Studio)
export const DEMO_TODAYS_APPOINTMENTS = [
  {
    id: "demo-apt-1",
    customer_name: "Hannah Roberts",
    customer_phone: "+44 7700 900111",
    start_time: new Date().setHours(10, 0, 0, 0),
    end_time: new Date().setHours(12, 0, 0, 0),
    status: "confirmed",
    service: { name: "Balayage", price: 150 },
    staff: { name: "Isla" },
  },
  {
    id: "demo-apt-2",
    customer_name: "Daniel Foster",
    customer_phone: "+44 7700 900222",
    start_time: new Date().setHours(11, 30, 0, 0),
    end_time: new Date().setHours(12, 15, 0, 0),
    status: "confirmed",
    service: { name: "Haircut & Beard", price: 45 },
    staff: { name: "Marcus" },
  },
  {
    id: "demo-apt-3",
    customer_name: "Priya Shah",
    customer_phone: "+44 7700 900333",
    start_time: new Date().setHours(13, 0, 0, 0),
    end_time: new Date().setHours(14, 15, 0, 0),
    status: "confirmed",
    service: { name: "Root Tint + Blow-dry", price: 85 },
    staff: { name: "Isla" },
  },
  {
    id: "demo-apt-4",
    customer_name: "Olivia Bennett",
    customer_phone: "+44 7700 900444",
    start_time: new Date().setHours(15, 30, 0, 0),
    end_time: new Date().setHours(16, 15, 0, 0),
    status: "confirmed",
    service: { name: "Cut & Style", price: 55 },
    staff: { name: "Marcus" },
  },
  {
    id: "demo-apt-5",
    customer_name: "Chloe Mitchell",
    customer_phone: "+44 7700 900555",
    start_time: new Date().setHours(17, 0, 0, 0),
    end_time: new Date().setHours(19, 0, 0, 0),
    status: "confirmed",
    service: { name: "Full Highlights", price: 180 },
    staff: { name: "Isla" },
  },
].map((apt) => ({
  ...apt,
  start_time: new Date(apt.start_time).toISOString(),
  end_time: new Date(apt.end_time).toISOString(),
}));

// Demo upcoming bookings
export const DEMO_UPCOMING_BOOKINGS = [
  {
    id: "demo-up-1",
    customer_name: "Charlotte Davies",
    start_time: new Date(Date.now() + 86400000).setHours(10, 0, 0, 0),
    service: { name: "Cut & Colour" },
    staff: { name: "Emma" },
  },
  {
    id: "demo-up-2",
    customer_name: "Oliver Thompson",
    start_time: new Date(Date.now() + 86400000).setHours(14, 0, 0, 0),
    service: { name: "Men's Cut" },
    staff: { name: "James" },
  },
  {
    id: "demo-up-3",
    customer_name: "Amelia Roberts",
    start_time: new Date(Date.now() + 172800000).setHours(11, 30, 0, 0),
    service: { name: "Balayage" },
    staff: { name: "Sophie" },
  },
  {
    id: "demo-up-4",
    customer_name: "George Evans",
    start_time: new Date(Date.now() + 172800000).setHours(15, 0, 0, 0),
    service: { name: "Haircut & Beard" },
    staff: { name: "James" },
  },
  {
    id: "demo-up-5",
    customer_name: "Isabella Walker",
    start_time: new Date(Date.now() + 259200000).setHours(9, 0, 0, 0),
    service: { name: "Keratin Treatment" },
    staff: { name: "Emma" },
  },
].map((apt) => ({
  ...apt,
  start_time: new Date(apt.start_time).toISOString(),
}));

// Demo cancelled bookings
export const DEMO_CANCELLED_BOOKINGS = [
  {
    id: "demo-can-1",
    customer_name: "Thomas White",
    start_time: new Date(Date.now() - 86400000).setHours(11, 0, 0, 0),
    cancelled_at: new Date(Date.now() - 172800000).toISOString(),
    service: { name: "Haircut" },
    staff: { name: "James" },
  },
  {
    id: "demo-can-2",
    customer_name: "Sophia Green",
    start_time: new Date(Date.now() - 259200000).setHours(14, 30, 0, 0),
    cancelled_at: new Date(Date.now() - 345600000).toISOString(),
    service: { name: "Colour Touch-up" },
    staff: { name: "Sophie" },
  },
].map((apt) => ({
  ...apt,
  start_time: new Date(apt.start_time).toISOString(),
}));

// Demo call logs - Salon specific
export const DEMO_SALON_CALLS = [
  {
    id: "demo-call-1",
    caller_name: "Sarah Johnson",
    caller_phone: "+44 7700 900123",
    call_type: "new_booking",
    call_outcome: "Booking confirmed for tomorrow at 2pm",
    summary: "Customer called to book a haircut appointment. Confirmed for tomorrow at 2pm with Emma.",
    duration_ms: 180000,
    needs_review: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-call-2",
    caller_name: "Michael Chen",
    caller_phone: "+44 7700 900456",
    call_type: "question",
    call_outcome: "Enquiry about availability",
    summary: "Customer enquired about availability next week for a colour treatment.",
    duration_ms: 120000,
    needs_review: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "demo-call-3",
    caller_name: "Emma Williams",
    caller_phone: "+44 7700 900789",
    call_type: "reschedule",
    call_outcome: "Rescheduled from Monday to Friday",
    summary: "Customer rescheduled their appointment from Monday to Friday at 3pm.",
    duration_ms: 90000,
    needs_review: false,
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "demo-call-4",
    caller_name: "James Brown",
    caller_phone: "+44 7700 901234",
    call_type: "cancel",
    call_outcome: "Appointment cancelled",
    summary: "Customer cancelled their appointment due to work commitments. Will rebook later.",
    duration_ms: 60000,
    needs_review: false,
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: "demo-call-5",
    caller_name: "Sophie Miller",
    caller_phone: "+44 7700 901567",
    call_type: "new_booking",
    call_outcome: "Booking confirmed for next week",
    summary: "New customer booked full highlights with Sophie for next Tuesday.",
    duration_ms: 240000,
    needs_review: false,
    created_at: new Date(Date.now() - 28800000).toISOString(),
  },
];

// Demo call logs - Restaurant specific
export const DEMO_RESTAURANT_CALLS = [
  {
    id: "demo-call-1",
    caller_name: "John Smith",
    caller_phone: "+44 7700 800123",
    call_type: "new_order",
    call_outcome: "Order placed for pickup",
    summary: "Customer placed an order for 2 Fish & Chips with mushy peas. Pickup in 20 minutes.",
    duration_ms: 180000,
    needs_review: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-call-2",
    caller_name: "Mary Johnson",
    caller_phone: "+44 7700 800456",
    call_type: "question",
    call_outcome: "Menu enquiry",
    summary: "Customer asked about vegetarian options and gluten-free items on the menu.",
    duration_ms: 120000,
    needs_review: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "demo-call-3",
    caller_name: "Robert Williams",
    caller_phone: "+44 7700 800789",
    call_type: "new_order",
    call_outcome: "Large order placed",
    summary: "Customer ordered 2 pizzas and garlic bread for family dinner. Ready in 25 minutes.",
    duration_ms: 240000,
    needs_review: false,
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "demo-call-4",
    caller_name: "Patricia Brown",
    caller_phone: "+44 7700 801234",
    call_type: "cancel",
    call_outcome: "Order cancelled",
    summary: "Customer cancelled their pending order due to change of plans.",
    duration_ms: 60000,
    needs_review: false,
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: "demo-call-5",
    caller_name: "James Wilson",
    caller_phone: "+44 7700 801567",
    call_type: "question",
    call_outcome: "Opening hours enquiry",
    summary: "Customer asked about opening hours and delivery options.",
    duration_ms: 90000,
    needs_review: false,
    created_at: new Date(Date.now() - 28800000).toISOString(),
  },
];

// Demo call logs - Dine-in Restaurant specific
export const DEMO_DINEIN_CALLS = [
  {
    id: "demo-call-1",
    caller_name: "William Turner",
    caller_phone: "+44 7700 700123",
    call_type: "new_reservation",
    call_outcome: "Table reserved for 4",
    summary: "Customer booked a table for 4 people at 7pm this evening.",
    duration_ms: 180000,
    needs_review: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-call-2",
    caller_name: "Elizabeth Moore",
    caller_phone: "+44 7700 700456",
    call_type: "question",
    call_outcome: "Menu enquiry",
    summary: "Customer enquired about the tasting menu and wine pairing options.",
    duration_ms: 150000,
    needs_review: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "demo-call-3",
    caller_name: "Henry Jackson",
    caller_phone: "+44 7700 700789",
    call_type: "reschedule",
    call_outcome: "Reservation moved to later time",
    summary: "Customer rescheduled their 6pm reservation to 8pm due to traffic.",
    duration_ms: 90000,
    needs_review: false,
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "demo-call-4",
    caller_name: "Victoria Martin",
    caller_phone: "+44 7700 701234",
    call_type: "cancel",
    call_outcome: "Reservation cancelled",
    summary: "Customer cancelled their reservation for tomorrow evening.",
    duration_ms: 60000,
    needs_review: false,
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: "demo-call-5",
    caller_name: "Charles Anderson",
    caller_phone: "+44 7700 701567",
    call_type: "new_reservation",
    call_outcome: "Private dining enquiry",
    summary: "Customer enquired about private dining room for a birthday celebration next month.",
    duration_ms: 300000,
    needs_review: false,
    created_at: new Date(Date.now() - 28800000).toISOString(),
  },
];

// Default DEMO_CALLS for backward compatibility (uses salon calls)
export const DEMO_CALLS = DEMO_SALON_CALLS;

// Demo messages - Salon specific
export const DEMO_SALON_MESSAGES = [
  {
    id: "demo-msg-1",
    caller_name: "Sarah Johnson",
    caller_phone: "+44 7700 900123",
    content: "Hi, can you please let me know if there's availability for a colour treatment next week? Thanks!",
    recipient_type: "business",
    is_urgent: false,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "demo-msg-2",
    caller_name: "Michael Chen",
    caller_phone: "+44 7700 900456",
    content: "I need to change my appointment from Tuesday to Wednesday if possible. Please call me back.",
    recipient_type: "business",
    is_urgent: true,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-msg-3",
    caller_name: "Emma Williams",
    caller_phone: "+44 7700 900789",
    content: "Just wanted to say thank you for the great service yesterday!",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-msg-4",
    caller_name: "James Brown",
    caller_phone: "+44 7700 901234",
    content: "Can you confirm my appointment for tomorrow at 2pm?",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "demo-msg-5",
    caller_name: "Sophie Miller",
    caller_phone: "+44 7700 901567",
    content: "What products do you recommend for coloured hair maintenance?",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: true,
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

// Demo messages - Restaurant specific
export const DEMO_RESTAURANT_MESSAGES = [
  {
    id: "demo-msg-1",
    caller_name: "John Smith",
    caller_phone: "+44 7700 800123",
    content: "Hi, I placed an order 30 minutes ago. Is it ready for collection yet?",
    recipient_type: "business",
    is_urgent: true,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "demo-msg-2",
    caller_name: "Mary Johnson",
    caller_phone: "+44 7700 800456",
    content: "Do you have any gluten-free options on the menu? My daughter has allergies.",
    recipient_type: "business",
    is_urgent: false,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-msg-3",
    caller_name: "Robert Williams",
    caller_phone: "+44 7700 800789",
    content: "The food was delicious! Will definitely order again. Thank you!",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-msg-4",
    caller_name: "Patricia Brown",
    caller_phone: "+44 7700 801234",
    content: "What time do you close tonight? I want to pick up before you shut.",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "demo-msg-5",
    caller_name: "James Wilson",
    caller_phone: "+44 7700 801567",
    content: "Can I order for delivery to my office tomorrow lunchtime?",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: true,
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

// Demo messages - Dine-in Restaurant specific
export const DEMO_DINEIN_MESSAGES = [
  {
    id: "demo-msg-1",
    caller_name: "William Turner",
    caller_phone: "+44 7700 700123",
    content: "Hi, I have a reservation for tonight at 7pm. Can we add 2 more guests?",
    recipient_type: "business",
    is_urgent: true,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "demo-msg-2",
    caller_name: "Elizabeth Moore",
    caller_phone: "+44 7700 700456",
    content: "Do you have a private dining room available for a birthday party next Saturday?",
    recipient_type: "business",
    is_urgent: false,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-msg-3",
    caller_name: "Henry Jackson",
    caller_phone: "+44 7700 700789",
    content: "Wonderful meal last night! The tasting menu was exceptional. Thank you!",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-msg-4",
    caller_name: "Victoria Martin",
    caller_phone: "+44 7700 701234",
    content: "Can you confirm our reservation for 3 guests tomorrow at 8pm?",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "demo-msg-5",
    caller_name: "Charles Anderson",
    caller_phone: "+44 7700 701567",
    content: "What's the dress code for dinner? Planning to come this weekend.",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: true,
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

// Default DEMO_MESSAGES for backward compatibility (uses salon messages)
export const DEMO_MESSAGES = DEMO_SALON_MESSAGES;

// Demo orders (Restaurant)
export const DEMO_ORDERS = [
  {
    id: "demo-order-1",
    order_number: "4521",
    customer_name: "John Smith",
    customer_phone: "+44 7700 800123",
    items: [
      { name: "Fish & Chips", quantity: 2, price: 12.99 },
      { name: "Mushy Peas", quantity: 2, price: 2.50 },
      { name: "Curry Sauce", quantity: 1, price: 1.50 },
    ],
    subtotal: 32.48,
    total: 32.48,
    status: "preparing",
    order_type: "pickup",
    created_at: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: "demo-order-2",
    order_number: "7832",
    customer_name: "Mary Johnson",
    customer_phone: "+44 7700 800456",
    items: [
      { name: "Chicken Tikka Masala", quantity: 1, price: 10.99 },
      { name: "Pilau Rice", quantity: 1, price: 3.50 },
      { name: "Garlic Naan", quantity: 2, price: 2.99 },
    ],
    subtotal: 20.47,
    total: 20.47,
    status: "pending",
    order_type: "pickup",
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: "demo-order-3",
    order_number: "2156",
    customer_name: "Robert Williams",
    customer_phone: "+44 7700 800789",
    items: [
      { name: "Margherita Pizza", quantity: 1, price: 11.99 },
      { name: "Pepperoni Pizza", quantity: 1, price: 13.99 },
      { name: "Garlic Bread", quantity: 1, price: 4.50 },
    ],
    subtotal: 30.48,
    total: 30.48,
    status: "ready",
    order_type: "pickup",
    created_at: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: "demo-order-4",
    order_number: "8943",
    customer_name: "Patricia Brown",
    customer_phone: "+44 7700 801234",
    items: [
      { name: "Burger & Fries", quantity: 2, price: 9.99 },
      { name: "Onion Rings", quantity: 1, price: 3.99 },
      { name: "Chocolate Milkshake", quantity: 2, price: 4.50 },
    ],
    subtotal: 32.96,
    total: 32.96,
    status: "pending",
    order_type: "pickup",
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
];

// Demo reservations
export const DEMO_RESERVATIONS = [
  {
    id: "demo-res-1",
    customer_name: "William Turner",
    customer_phone: "+44 7700 700123",
    party_size: 4,
    reservation_time: new Date().setHours(18, 0, 0, 0),
    duration_minutes: 90,
    status: "confirmed",
    table: { table_number: "5", capacity: 4 },
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-res-2",
    customer_name: "Elizabeth Moore",
    customer_phone: "+44 7700 700456",
    party_size: 2,
    reservation_time: new Date().setHours(19, 0, 0, 0),
    duration_minutes: 90,
    status: "confirmed",
    table: { table_number: "2", capacity: 2 },
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "demo-res-3",
    customer_name: "Henry Jackson",
    customer_phone: "+44 7700 700789",
    party_size: 6,
    reservation_time: new Date().setHours(19, 30, 0, 0),
    duration_minutes: 120,
    status: "confirmed",
    table: { table_number: "8", capacity: 8 },
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "demo-res-4",
    customer_name: "Victoria Martin",
    customer_phone: "+44 7700 701234",
    party_size: 3,
    reservation_time: new Date().setHours(20, 0, 0, 0),
    duration_minutes: 90,
    status: "confirmed",
    table: { table_number: "4", capacity: 4 },
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: "demo-res-5",
    customer_name: "Charles Anderson",
    customer_phone: "+44 7700 701567",
    party_size: 2,
    reservation_time: new Date().setHours(20, 30, 0, 0),
    duration_minutes: 90,
    status: "confirmed",
    table: { table_number: "1", capacity: 2 },
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "demo-res-6",
    customer_name: "Margaret Thompson",
    customer_phone: "+44 7700 701890",
    party_size: 8,
    reservation_time: new Date().setHours(18, 30, 0, 0),
    duration_minutes: 150,
    status: "seated",
    seated_at: new Date(Date.now() - 1800000).toISOString(),
    table: { table_number: "10", capacity: 10 },
    created_at: new Date(Date.now() - 345600000).toISOString(),
  },
].map((res) => ({
  ...res,
  reservation_time: new Date(res.reservation_time).toISOString(),
}));

// Demo bookings for BookingsTab
export const DEMO_BOOKINGS_LIST = [
  ...DEMO_TODAYS_APPOINTMENTS.map((apt, i) => ({
    ...apt,
    created_by: "Phone",
    created_by_user_id: null,
    status: i < 3 ? "completed" : "confirmed",
    notes: null,
    deposit_amount: i === 2 ? 50 : null,
    deposit_paid_at: i === 2 ? new Date(Date.now() - 86400000).toISOString() : null,
    creator_name: "Phone Call",
  })),
  ...DEMO_UPCOMING_BOOKINGS.map((apt) => ({
    ...apt,
    end_time: new Date(new Date(apt.start_time).getTime() + 3600000).toISOString(),
    status: "confirmed",
    created_by: "Online",
    created_by_user_id: null,
    notes: null,
    deposit_amount: null,
    deposit_paid_at: null,
    creator_name: "Online Booking",
    customer_phone: "+44 7700 900000",
  })),
];

// ─────────────────────────────────────────────────────────────
// Salon & Spa demo stats / data (used by DemoDashboard)
// ─────────────────────────────────────────────────────────────

// (DEMO_SALON_STATS lives above with the original salon stats; landing-demo fields added inline.)

export const DEMO_SPA_STATS = {
  appointmentsCount: 6,
  completedCount: 4,
  cancelledCount: 1,
  revenue: 720,
  callsCount: 9,
  messagesCount: 3,
};

// Demo today's appointments (Spa / Wellness)
export const DEMO_SPA_APPOINTMENTS = [
  {
    id: "demo-spa-1",
    customer_name: "Hannah Roberts",
    customer_phone: "+44 7700 920111",
    start_time: new Date().setHours(9, 30, 0, 0),
    end_time: new Date().setHours(10, 30, 0, 0),
    status: "confirmed",
    service: { name: "Swedish Massage (60 min)", price: 75 },
    staff: { name: "Isla", room: "Room 1" },
  },
  {
    id: "demo-spa-2",
    customer_name: "Daniel Foster",
    customer_phone: "+44 7700 920222",
    start_time: new Date().setHours(11, 0, 0, 0),
    end_time: new Date().setHours(12, 30, 0, 0),
    status: "confirmed",
    service: { name: "Deep Tissue Massage (90 min)", price: 110 },
    staff: { name: "Marcus", room: "Room 2" },
  },
  {
    id: "demo-spa-3",
    customer_name: "Priya Patel",
    customer_phone: "+44 7700 920333",
    start_time: new Date().setHours(13, 0, 0, 0),
    end_time: new Date().setHours(14, 15, 0, 0),
    status: "confirmed",
    service: { name: "Hydrating Facial", price: 85 },
    staff: { name: "Isla", room: "Treatment Room" },
  },
  {
    id: "demo-spa-4",
    customer_name: "Tom Caldwell",
    customer_phone: "+44 7700 920444",
    start_time: new Date().setHours(14, 30, 0, 0),
    end_time: new Date().setHours(16, 0, 0, 0),
    status: "confirmed",
    service: { name: "Hot Stone Therapy (90 min)", price: 120 },
    staff: { name: "Marcus", room: "Room 1" },
  },
  {
    id: "demo-spa-5",
    customer_name: "Aisha Khan",
    customer_phone: "+44 7700 920555",
    start_time: new Date().setHours(16, 30, 0, 0),
    end_time: new Date().setHours(18, 0, 0, 0),
    status: "confirmed",
    service: { name: "Detox Body Wrap", price: 130 },
    staff: { name: "Isla", room: "Wrap Suite" },
  },
  {
    id: "demo-spa-6",
    customer_name: "Eleanor Pike",
    customer_phone: "+44 7700 920666",
    start_time: new Date().setHours(18, 30, 0, 0),
    end_time: new Date().setHours(19, 30, 0, 0),
    status: "confirmed",
    service: { name: "Aromatherapy Massage (60 min)", price: 80 },
    staff: { name: "Marcus", room: "Room 2" },
  },
].map((apt) => ({
  ...apt,
  start_time: new Date(apt.start_time).toISOString(),
  end_time: new Date(apt.end_time).toISOString(),
}));

// Demo call logs - Spa specific
export const DEMO_SPA_CALLS = [
  {
    id: "demo-spa-call-1",
    caller_name: "Hannah Roberts",
    caller_phone: "+44 7700 920111",
    call_type: "new_booking",
    call_outcome: "Booked Swedish massage",
    summary: "Customer booked a 60 minute Swedish massage with Isla for this morning.",
    duration_ms: 165000,
    needs_review: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-spa-call-2",
    caller_name: "Daniel Foster",
    caller_phone: "+44 7700 920222",
    call_type: "question",
    call_outcome: "Asked about couples packages",
    summary: "Caller asked whether we offer couples treatment packages for an anniversary.",
    duration_ms: 140000,
    needs_review: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "demo-spa-call-3",
    caller_name: "Priya Patel",
    caller_phone: "+44 7700 920333",
    call_type: "reschedule",
    call_outcome: "Moved facial to Friday",
    summary: "Customer rescheduled their hydrating facial from Wednesday to Friday at 1pm.",
    duration_ms: 95000,
    needs_review: false,
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "demo-spa-call-4",
    caller_name: "Tom Caldwell",
    caller_phone: "+44 7700 920444",
    call_type: "new_booking",
    call_outcome: "Hot stone therapy booked",
    summary: "New client booked a 90 minute hot stone therapy session with Marcus.",
    duration_ms: 210000,
    needs_review: false,
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: "demo-spa-call-5",
    caller_name: "Aisha Khan",
    caller_phone: "+44 7700 920555",
    call_type: "cancel",
    call_outcome: "Body wrap cancelled, will rebook",
    summary: "Customer cancelled her detox body wrap due to illness, will call back next week.",
    duration_ms: 75000,
    needs_review: false,
    created_at: new Date(Date.now() - 28800000).toISOString(),
  },
];

// Demo messages - Spa specific
export const DEMO_SPA_MESSAGES = [
  {
    id: "demo-spa-msg-1",
    caller_name: "Hannah Roberts",
    caller_phone: "+44 7700 920111",
    content: "Do you offer gift vouchers I can buy online for a friend's birthday?",
    recipient_type: "business",
    is_urgent: false,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "demo-spa-msg-2",
    caller_name: "Daniel Foster",
    caller_phone: "+44 7700 920222",
    content: "Could you let me know if Marcus is available for a couples massage on Saturday?",
    recipient_type: "business",
    is_urgent: true,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-spa-msg-3",
    caller_name: "Priya Patel",
    caller_phone: "+44 7700 920333",
    content: "The facial was wonderful, my skin feels amazing. Thank you!",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-spa-msg-4",
    caller_name: "Eleanor Pike",
    caller_phone: "+44 7700 920666",
    content: "Is parking available at the spa? Coming from out of town this evening.",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

// ─────────────────────────────────────────────────────────────
// Real Estate demo data (used by DemoDashboard)
// Mirrors the appointment-based salon/spa dashboard with viewings,
// agents, and pipeline value labels.
// ─────────────────────────────────────────────────────────────

export const DEMO_REALESTATE_STATS = {
  appointmentsCount: 7,    // viewings booked today
  completedCount: 4,       // viewings completed
  cancelledCount: 1,
  revenue: 18500,          // pipeline value of today's bookings (£)
  callsCount: 14,
  messagesCount: 5,
};

export const DEMO_REALESTATE_APPOINTMENTS = [
  {
    id: "demo-re-1",
    customer_name: "Mr & Mrs Holloway",
    customer_phone: "+44 7700 930111",
    start_time: new Date().setHours(9, 30, 0, 0),
    end_time: new Date().setHours(10, 0, 0, 0),
    status: "confirmed",
    service: { name: "Viewing — 2-bed flat", price: 0 },
    staff: { name: "Daniel", room: "14 Oak Avenue" },
  },
  {
    id: "demo-re-2",
    customer_name: "Priya Shah",
    customer_phone: "+44 7700 930222",
    start_time: new Date().setHours(10, 30, 0, 0),
    end_time: new Date().setHours(11, 15, 0, 0),
    status: "confirmed",
    service: { name: "Valuation visit", price: 0 },
    staff: { name: "Rebecca", room: "32 Elmwood Road" },
  },
  {
    id: "demo-re-3",
    customer_name: "Jacob Lawrence",
    customer_phone: "+44 7700 930333",
    start_time: new Date().setHours(12, 0, 0, 0),
    end_time: new Date().setHours(12, 30, 0, 0),
    status: "confirmed",
    service: { name: "Viewing — 3-bed terrace", price: 0 },
    staff: { name: "Daniel", room: "7 Beechcroft Lane" },
  },
  {
    id: "demo-re-4",
    customer_name: "Sophie Adeyemi",
    customer_phone: "+44 7700 930444",
    start_time: new Date().setHours(13, 30, 0, 0),
    end_time: new Date().setHours(14, 0, 0, 0),
    status: "confirmed",
    service: { name: "Viewing — Studio apartment", price: 0 },
    staff: { name: "Rebecca", room: "18 Riverside Quay" },
  },
  {
    id: "demo-re-5",
    customer_name: "Mark Pemberton",
    customer_phone: "+44 7700 930555",
    start_time: new Date().setHours(15, 0, 0, 0),
    end_time: new Date().setHours(15, 45, 0, 0),
    status: "confirmed",
    service: { name: "Second viewing", price: 0 },
    staff: { name: "Daniel", room: "14 Oak Avenue" },
  },
  {
    id: "demo-re-6",
    customer_name: "Anna Whitfield",
    customer_phone: "+44 7700 930666",
    start_time: new Date().setHours(16, 30, 0, 0),
    end_time: new Date().setHours(17, 15, 0, 0),
    status: "confirmed",
    service: { name: "Lettings viewing", price: 0 },
    staff: { name: "Rebecca", room: "5 Cedar Court" },
  },
  {
    id: "demo-re-7",
    customer_name: "Owen & Claire Bates",
    customer_phone: "+44 7700 930777",
    start_time: new Date().setHours(18, 0, 0, 0),
    end_time: new Date().setHours(18, 30, 0, 0),
    status: "confirmed",
    service: { name: "Viewing — 4-bed semi", price: 0 },
    staff: { name: "Daniel", room: "44 Linden Grove" },
  },
].map((apt) => ({
  ...apt,
  start_time: new Date(apt.start_time).toISOString(),
  end_time: new Date(apt.end_time).toISOString(),
}));

export const DEMO_REALESTATE_CALLS = [
  {
    id: "demo-re-call-1",
    caller_name: "Mr & Mrs Holloway",
    caller_phone: "+44 7700 930111",
    call_type: "new_booking",
    call_outcome: "Viewing booked",
    summary: "Booked a viewing for 14 Oak Avenue at 9:30am with Daniel.",
    duration_ms: 190000,
    needs_review: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-re-call-2",
    caller_name: "Priya Shah",
    caller_phone: "+44 7700 930222",
    call_type: "question",
    call_outcome: "Valuation enquiry",
    summary: "Asked for a free valuation of her flat on Elmwood Road. Visit booked.",
    duration_ms: 220000,
    needs_review: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "demo-re-call-3",
    caller_name: "Jacob Lawrence",
    caller_phone: "+44 7700 930333",
    call_type: "reschedule",
    call_outcome: "Moved viewing to today",
    summary: "Pulled forward the 3-bed terrace viewing from Friday to today at noon.",
    duration_ms: 110000,
    needs_review: false,
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "demo-re-call-4",
    caller_name: "Mark Pemberton",
    caller_phone: "+44 7700 930555",
    call_type: "new_booking",
    call_outcome: "Second viewing booked",
    summary: "Wants a second look at 14 Oak Avenue with his partner this afternoon.",
    duration_ms: 175000,
    needs_review: false,
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: "demo-re-call-5",
    caller_name: "Liam Donovan",
    caller_phone: "+44 7700 930888",
    call_type: "cancel",
    call_outcome: "Viewing cancelled",
    summary: "Cancelled tomorrow's viewing — has offer accepted on another property.",
    duration_ms: 85000,
    needs_review: false,
    created_at: new Date(Date.now() - 28800000).toISOString(),
  },
];

export const DEMO_REALESTATE_MESSAGES = [
  {
    id: "demo-re-msg-1",
    caller_name: "Priya Shah",
    caller_phone: "+44 7700 930222",
    content: "Can you send the brochure for 14 Oak Avenue before our visit?",
    recipient_type: "business",
    is_urgent: false,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "demo-re-msg-2",
    caller_name: "Owen Bates",
    caller_phone: "+44 7700 930777",
    content: "We'd like to put an offer in on 44 Linden Grove after today's viewing.",
    recipient_type: "business",
    is_urgent: true,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-re-msg-3",
    caller_name: "Anna Whitfield",
    caller_phone: "+44 7700 930666",
    content: "Is 5 Cedar Court still available for a 12-month let? Looking to move next month.",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-re-msg-4",
    caller_name: "Hugo Ferreira",
    caller_phone: "+44 7700 930999",
    content: "Do you offer property management as well as sales? Looking for a long-term agent.",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

// ─────────────────────────────────────────────────────────────
// Trades demo data (used by DemoDashboard)
// Mirrors the appointment-based dashboard with jobs, engineers,
// and day-takings labels.
// ─────────────────────────────────────────────────────────────

export const DEMO_TRADES_STATS = {
  appointmentsCount: 9,   // jobs booked today
  completedCount: 6,      // jobs completed
  cancelledCount: 1,
  revenue: 1840,          // day takings (£)
  callsCount: 21,
  messagesCount: 4,
};

export const DEMO_TRADES_APPOINTMENTS = [
  {
    id: "demo-tr-1",
    customer_name: "Mrs Edwards",
    customer_phone: "+44 7700 940111",
    start_time: new Date().setHours(8, 0, 0, 0),
    end_time: new Date().setHours(9, 0, 0, 0),
    status: "confirmed",
    service: { name: "Boiler service", price: 95 },
    staff: { name: "Liam", room: "22 Willow Drive" },
  },
  {
    id: "demo-tr-2",
    customer_name: "Mr Patel",
    customer_phone: "+44 7700 940222",
    start_time: new Date().setHours(9, 30, 0, 0),
    end_time: new Date().setHours(10, 30, 0, 0),
    status: "confirmed",
    service: { name: "Leaking tap repair", price: 75 },
    staff: { name: "Tom", room: "8 Maple Close" },
  },
  {
    id: "demo-tr-3",
    customer_name: "Jenkins Cafe",
    customer_phone: "+44 7700 940333",
    start_time: new Date().setHours(10, 0, 0, 0),
    end_time: new Date().setHours(12, 0, 0, 0),
    status: "confirmed",
    service: { name: "Emergency call-out — no hot water", price: 220 },
    staff: { name: "Liam", room: "High Street unit 4" },
  },
  {
    id: "demo-tr-4",
    customer_name: "Mr Doyle",
    customer_phone: "+44 7700 940444",
    start_time: new Date().setHours(12, 30, 0, 0),
    end_time: new Date().setHours(13, 30, 0, 0),
    status: "confirmed",
    service: { name: "Radiator install", price: 180 },
    staff: { name: "Tom", room: "47 Birch Avenue" },
  },
  {
    id: "demo-tr-5",
    customer_name: "Ms Okafor",
    customer_phone: "+44 7700 940555",
    start_time: new Date().setHours(14, 0, 0, 0),
    end_time: new Date().setHours(14, 45, 0, 0),
    status: "confirmed",
    service: { name: "Quote — full bathroom refit", price: 0 },
    staff: { name: "Liam", room: "12 Hazel Mews" },
  },
  {
    id: "demo-tr-6",
    customer_name: "The White House B&B",
    customer_phone: "+44 7700 940666",
    start_time: new Date().setHours(15, 0, 0, 0),
    end_time: new Date().setHours(16, 30, 0, 0),
    status: "confirmed",
    service: { name: "Annual gas safety check", price: 120 },
    staff: { name: "Sam", room: "2 Vicarage Lane" },
  },
  {
    id: "demo-tr-7",
    customer_name: "Mrs Reilly",
    customer_phone: "+44 7700 940777",
    start_time: new Date().setHours(16, 0, 0, 0),
    end_time: new Date().setHours(17, 0, 0, 0),
    status: "confirmed",
    service: { name: "Shower thermostat replace", price: 145 },
    staff: { name: "Tom", room: "31 Sycamore Walk" },
  },
  {
    id: "demo-tr-8",
    customer_name: "Mr Greaves",
    customer_phone: "+44 7700 940888",
    start_time: new Date().setHours(17, 30, 0, 0),
    end_time: new Date().setHours(18, 30, 0, 0),
    status: "confirmed",
    service: { name: "Toilet repair", price: 95 },
    staff: { name: "Liam", room: "9 Poplar Terrace" },
  },
  {
    id: "demo-tr-9",
    customer_name: "Bright Sparks Nursery",
    customer_phone: "+44 7700 940999",
    start_time: new Date().setHours(18, 0, 0, 0),
    end_time: new Date().setHours(19, 30, 0, 0),
    status: "confirmed",
    service: { name: "Emergency — burst pipe", price: 260 },
    staff: { name: "Sam", room: "Lambourne Industrial Estate" },
  },
].map((apt) => ({
  ...apt,
  start_time: new Date(apt.start_time).toISOString(),
  end_time: new Date(apt.end_time).toISOString(),
}));

export const DEMO_TRADES_CALLS = [
  {
    id: "demo-tr-call-1",
    caller_name: "Jenkins Cafe",
    caller_phone: "+44 7700 940333",
    call_type: "new_booking",
    call_outcome: "Emergency job booked",
    summary: "No hot water at the cafe — booked Liam for a 10am emergency call-out.",
    duration_ms: 165000,
    needs_review: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-tr-call-2",
    caller_name: "Mr Patel",
    caller_phone: "+44 7700 940222",
    call_type: "new_booking",
    call_outcome: "Tap repair booked",
    summary: "Leaking tap under the kitchen sink. Tom booked in for 9:30am same day.",
    duration_ms: 130000,
    needs_review: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "demo-tr-call-3",
    caller_name: "Ms Okafor",
    caller_phone: "+44 7700 940555",
    call_type: "question",
    call_outcome: "Quote requested",
    summary: "Wants a quote for a full bathroom refit — Liam visiting at 2pm to scope.",
    duration_ms: 240000,
    needs_review: false,
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    id: "demo-tr-call-4",
    caller_name: "Mr Doyle",
    caller_phone: "+44 7700 940444",
    call_type: "reschedule",
    call_outcome: "Radiator job moved earlier",
    summary: "Wanted the radiator install pulled forward — moved to today 12:30pm.",
    duration_ms: 95000,
    needs_review: false,
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: "demo-tr-call-5",
    caller_name: "Mrs Sloane",
    caller_phone: "+44 7700 941001",
    call_type: "cancel",
    call_outcome: "Cancelled — fixed it themselves",
    summary: "Cancelled tomorrow's job, husband managed to clear the blockage.",
    duration_ms: 60000,
    needs_review: false,
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
];

export const DEMO_TRADES_MESSAGES = [
  {
    id: "demo-tr-msg-1",
    caller_name: "Jenkins Cafe",
    caller_phone: "+44 7700 940333",
    content: "Engineer arrived, sorted within an hour — invoice please when you can.",
    recipient_type: "business",
    is_urgent: false,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "demo-tr-msg-2",
    caller_name: "Bright Sparks Nursery",
    caller_phone: "+44 7700 940999",
    content: "Burst pipe in the back kitchen — water everywhere. Can someone come ASAP?",
    recipient_type: "business",
    is_urgent: true,
    is_read: false,
    is_archived: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-tr-msg-3",
    caller_name: "Mrs Edwards",
    caller_phone: "+44 7700 940111",
    content: "Boiler service all done, Liam was lovely — thank you!",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-tr-msg-4",
    caller_name: "Mr Greaves",
    caller_phone: "+44 7700 940888",
    content: "Could you also take a look at the boiler pressure while you're here later?",
    recipient_type: "business",
    is_urgent: false,
    is_read: true,
    is_archived: false,
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
];
