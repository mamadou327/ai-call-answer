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
  bookingsCount: 247,
  cancelledCount: 12,
  revenue: 8450,
  callsCount: 189,
  messagesCount: 8,
};

export const DEMO_RESTAURANT_STATS = {
  ordersCount: 312,
  completedCount: 298,
  cancelledCount: 8,
  revenue: 4890,
  callsCount: 156,
  messagesCount: 5,
};

export const DEMO_RESERVATION_STATS = {
  reservationsCount: 156,
  cancelledCount: 6,
  noShowCount: 4,
  totalCovers: 412,
};

export const DEMO_CALLS_STATS = {
  totalCalls: 189,
  bookingsCreated: 156,
  enquiries: 28,
  cancellations: 5,
};

// Demo today's appointments (Salon)
export const DEMO_TODAYS_APPOINTMENTS = [
  {
    id: "demo-apt-1",
    customer_name: "Sarah Johnson",
    customer_phone: "+44 7700 900123",
    start_time: new Date().setHours(9, 0, 0, 0),
    end_time: new Date().setHours(10, 0, 0, 0),
    status: "confirmed",
    service: { name: "Haircut & Blowdry", price: 65 },
    staff: { name: "Emma" },
  },
  {
    id: "demo-apt-2",
    customer_name: "Michael Chen",
    customer_phone: "+44 7700 900456",
    start_time: new Date().setHours(10, 30, 0, 0),
    end_time: new Date().setHours(11, 0, 0, 0),
    status: "confirmed",
    service: { name: "Men's Cut", price: 35 },
    staff: { name: "James" },
  },
  {
    id: "demo-apt-3",
    customer_name: "Emma Williams",
    customer_phone: "+44 7700 900789",
    start_time: new Date().setHours(11, 0, 0, 0),
    end_time: new Date().setHours(13, 0, 0, 0),
    status: "confirmed",
    service: { name: "Colour Treatment", price: 120 },
    staff: { name: "Sophie" },
  },
  {
    id: "demo-apt-4",
    customer_name: "James Brown",
    customer_phone: "+44 7700 901234",
    start_time: new Date().setHours(13, 0, 0, 0),
    end_time: new Date().setHours(13, 30, 0, 0),
    status: "confirmed",
    service: { name: "Beard Trim", price: 20 },
    staff: { name: "James" },
  },
  {
    id: "demo-apt-5",
    customer_name: "Sophie Miller",
    customer_phone: "+44 7700 901567",
    start_time: new Date().setHours(14, 30, 0, 0),
    end_time: new Date().setHours(16, 30, 0, 0),
    status: "confirmed",
    service: { name: "Full Highlights", price: 150 },
    staff: { name: "Emma" },
  },
  {
    id: "demo-apt-6",
    customer_name: "David Wilson",
    customer_phone: "+44 7700 901890",
    start_time: new Date().setHours(16, 0, 0, 0),
    end_time: new Date().setHours(16, 45, 0, 0),
    status: "confirmed",
    service: { name: "Haircut", price: 45 },
    staff: { name: "James" },
  },
  {
    id: "demo-apt-7",
    customer_name: "Olivia Taylor",
    customer_phone: "+44 7700 902123",
    start_time: new Date().setHours(17, 0, 0, 0),
    end_time: new Date().setHours(17, 45, 0, 0),
    status: "confirmed",
    service: { name: "Wash & Style", price: 40 },
    staff: { name: "Sophie" },
  },
  {
    id: "demo-apt-8",
    customer_name: "Liam Harris",
    customer_phone: "+44 7700 902456",
    start_time: new Date().setHours(18, 30, 0, 0),
    end_time: new Date().setHours(19, 15, 0, 0),
    status: "confirmed",
    service: { name: "Men's Fade", price: 30 },
    staff: { name: "James" },
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
    order_number: "ORD-0114-001",
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
    order_number: "ORD-0114-002",
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
    order_number: "ORD-0114-003",
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
    order_number: "ORD-0114-004",
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
