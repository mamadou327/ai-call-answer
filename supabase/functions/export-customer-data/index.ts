import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};
const fmtTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
const fmtDateTime = (iso?: string | null) =>
  iso ? `${fmtDate(iso)} ${fmtTime(iso)}` : "";
const fmtDuration = (ms?: number | null) => {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};
const yn = (v: any) => (v ? "Yes" : "No");
const sanitize = (s: string) =>
  (s || "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Customer";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const business_id: string | undefined = body.business_id;
    const phoneIn: string = (body.phone || "").trim();
    const emailIn: string = (body.email || "").trim().toLowerCase();
    const customer_id: string | undefined = body.customer_id;

    if (!business_id) {
      return new Response(JSON.stringify({ error: "business_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!phoneIn && !emailIn && !customer_id) {
      return new Response(JSON.stringify({ error: "Provide phone, email or customer_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: biz, error: bizErr } = await admin
      .from("businesses").select("id, business_name, owner_id")
      .eq("id", business_id).maybeSingle();
    if (bizErr) throw bizErr;
    if (!biz || biz.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve customer
    let customer: any = null;
    if (customer_id) {
      const r = await admin.from("customers").select("*")
        .eq("business_id", business_id).eq("id", customer_id).maybeSingle();
      customer = r.data;
    }
    if (!customer && phoneIn) {
      const r = await admin.from("customers").select("*")
        .eq("business_id", business_id).eq("phone", phoneIn).maybeSingle();
      customer = r.data;
    }
    if (!customer && emailIn) {
      const r = await admin.from("customers").select("*")
        .eq("business_id", business_id).eq("email", emailIn).maybeSingle();
      customer = r.data;
    }

    const phone = customer?.phone || phoneIn || "";
    const email = (customer?.email || emailIn || "").toLowerCase();
    const displayName = customer?.name || phone || email || "Customer";

    // Helper: phone OR email predicate on a column pair
    const orPhoneEmail = (phoneCol: string, emailCol?: string) => {
      const parts: string[] = [];
      if (phone) parts.push(`${phoneCol}.eq.${phone}`);
      if (emailCol && email) parts.push(`${emailCol}.eq.${email}`);
      return parts.join(",");
    };

    const [
      bookingsRes, callsRes, conversationsRes, msgsRes,
      ordersRes, fallbackRes, missedRes, staffRes, servicesRes,
    ] = await Promise.all([
      orPhoneEmail("customer_phone", "customer_email")
        ? admin.from("bookings").select("*").eq("business_id", business_id)
            .or(orPhoneEmail("customer_phone", "customer_email"))
            .order("start_time", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      phone
        ? admin.from("calls_log").select("*").eq("business_id", business_id)
            .eq("caller_phone", phone).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      phone
        ? admin.from("call_conversations").select("*").eq("business_id", business_id)
            .eq("caller_phone", phone).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      phone
        ? admin.from("messages").select("*").eq("business_id", business_id)
            .eq("caller_phone", phone).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      orPhoneEmail("customer_phone", "customer_email")
        ? admin.from("orders").select("*").eq("business_id", business_id)
            .or(orPhoneEmail("customer_phone", "customer_email"))
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      orPhoneEmail("customer_phone", "customer_email")
        ? admin.from("fallback_reservations").select("*").eq("business_id", business_id)
            .or(orPhoneEmail("customer_phone", "customer_email"))
            .order("reservation_time", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      phone
        ? admin.from("missed_calls").select("*").eq("business_id", business_id)
            .eq("caller_phone", phone).order("call_time", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      admin.from("staff").select("id, name").eq("business_id", business_id),
      admin.from("services").select("id, name").eq("business_id", business_id),
    ]);

    const staffMap = new Map((staffRes.data || []).map((s: any) => [s.id, s.name]));
    const serviceMap = new Map((servicesRes.data || []).map((s: any) => [s.id, s.name]));

    if (
      !customer && !(bookingsRes.data?.length) && !(callsRes.data?.length) &&
      !(ordersRes.data?.length) && !(fallbackRes.data?.length) && !(missedRes.data?.length) &&
      !(msgsRes.data?.length)
    ) {
      return new Response(JSON.stringify({ error: "No records found for this customer" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wb = XLSX.utils.book_new();
    const addSheet = (name: string, rows: any[]) => {
      const ws = rows.length
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([["(no records)"]]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    // Summary
    const counts: Record<string, number> = {
      Bookings: bookingsRes.data?.length || 0,
      "Call Logs": callsRes.data?.length || 0,
      "Call Conversations": conversationsRes.data?.length || 0,
      Messages: msgsRes.data?.length || 0,
      Orders: ordersRes.data?.length || 0,
      "Fallback Reservations": fallbackRes.data?.length || 0,
      "Missed Calls": missedRes.data?.length || 0,
    };
    const summary: Array<{ Field: string; Value: any }> = [
      { Field: "Data Subject Access Request (GDPR Article 15)", Value: "" },
      { Field: "Business", Value: biz.business_name },
      { Field: "Generated", Value: new Date().toISOString() },
      { Field: "", Value: "" },
      { Field: "Customer Name", Value: customer?.name || "" },
      { Field: "Customer Phone", Value: phone },
      { Field: "Customer Email", Value: email },
      { Field: "First Visit", Value: fmtDate(customer?.first_visit_date) },
      { Field: "Total Visits", Value: customer?.total_visits ?? "" },
      { Field: "Marketing Consent", Value: customer?.marketing_consent != null ? yn(customer.marketing_consent) : "" },
      { Field: "Preferred Language", Value: customer?.preferred_language || "" },
      { Field: "Notes / Preferences", Value: customer?.notes_preferences || "" },
      { Field: "How Heard", Value: customer?.how_heard || "" },
      { Field: "Blocked", Value: customer?.is_blocked != null ? yn(customer.is_blocked) : "" },
      { Field: "", Value: "" },
      { Field: "— Data Categories Held —", Value: "" },
      ...Object.entries(counts).map(([k, v]) => ({ Field: k, Value: v })),
      { Field: "", Value: "" },
      { Field: "— Your Rights —", Value: "" },
      { Field: "Right of access (Art. 15)", Value: "This file" },
      { Field: "Right to rectification (Art. 16)", Value: "Contact the business to correct any inaccurate data" },
      { Field: "Right to erasure (Art. 17)", Value: "Contact the business to request deletion" },
      { Field: "Right to data portability (Art. 20)", Value: "This file is machine-readable (.xlsx)" },
      { Field: "Right to complain", Value: "UK: Information Commissioner's Office (ico.org.uk). EU: your local data protection authority." },
    ];
    addSheet("Summary", summary);

    // Customer profile
    if (customer) {
      addSheet("Customer Profile", [{
        Name: customer.name || "",
        Phone: customer.phone || "",
        Email: customer.email || "",
        "Total Visits": customer.total_visits ?? "",
        "First Visit": fmtDate(customer.first_visit_date),
        "Marketing Consent": yn(customer.marketing_consent),
        "Preferred Language": customer.preferred_language || "",
        "How Heard": customer.how_heard || "",
        "Notes/Preferences": customer.notes_preferences || "",
        Blocked: yn(customer.is_blocked),
        "Blocked Reason": customer.blocked_reason || "",
        "Preferred Staff": customer.preferred_staff_id ? (staffMap.get(customer.preferred_staff_id) || "") : "",
        "Created At": fmtDateTime(customer.created_at),
        "Updated At": fmtDateTime(customer.updated_at),
      }]);
    }

    // Bookings
    addSheet("Bookings", (bookingsRes.data || []).map((b: any) => ({
      "Booking Code": b.booking_code || "",
      Service: b.service_id ? (serviceMap.get(b.service_id) || "") : "",
      Date: fmtDate(b.start_time),
      Time: fmtTime(b.start_time),
      "End Time": fmtTime(b.end_time),
      Staff: b.staff_id ? (staffMap.get(b.staff_id) || "") : "",
      "Party Size": b.party_size ?? "",
      Status: b.status || "",
      "Payment Status": b.payment_status || "",
      "Deposit Amount": b.deposit_amount ?? "",
      "Deposit Paid At": fmtDateTime(b.deposit_paid_at),
      "Order Total": b.order_total ?? "",
      "Special Requests": b.special_requests || "",
      Notes: b.notes || "",
      "Delivery Address": b.delivery_address || "",
      "Cancelled At": fmtDateTime(b.cancelled_at),
      "Created By": b.created_by || "",
      "Created At": fmtDateTime(b.created_at),
    })));

    // Call Logs (+ signed recording URLs)
    const callRows: any[] = [];
    for (const c of callsRes.data || []) {
      let recording = c.recording_url || "";
      if (recording && recording.startsWith("call-recordings/")) {
        const path = recording.replace(/^call-recordings\//, "");
        const { data: signed } = await admin.storage.from("call-recordings")
          .createSignedUrl(path, 86400);
        if (signed?.signedUrl) recording = signed.signedUrl;
      }
      callRows.push({
        Date: fmtDate(c.created_at),
        Time: fmtTime(c.created_at),
        Type: c.call_type || "",
        Outcome: c.call_outcome || "",
        Duration: fmtDuration(c.duration_ms),
        "Caller Name": c.caller_name || "",
        "Caller Phone": c.caller_phone || "",
        "To Number": c.to_number || "",
        Summary: c.summary || "",
        Transcript: c.transcription || "",
        Tags: Array.isArray(c.tags) ? c.tags.join(", ") : "",
        "Recording URL (24h)": recording,
      });
    }
    addSheet("Call Logs", callRows);

    // Call Conversations (transcript-like)
    addSheet("Call Conversations", (conversationsRes.data || []).map((c: any) => ({
      Date: fmtDateTime(c.created_at),
      Intent: c.intent || "",
      Status: c.status || "",
      "Caller Name": c.caller_name || "",
      "Caller Phone": c.caller_phone || "",
      Messages: Array.isArray(c.messages)
        ? c.messages.map((m: any) => `[${m.role || "?"}] ${m.content || ""}`).join("\n")
        : JSON.stringify(c.messages || []),
    })));

    // Messages
    addSheet("Messages", (msgsRes.data || []).map((m: any) => ({
      Date: fmtDate(m.created_at),
      Time: fmtTime(m.created_at),
      Content: m.content || "",
      Urgent: yn(m.is_urgent),
      Read: yn(m.is_read),
      "Caller Name": m.caller_name || "",
      "Caller Phone": m.caller_phone || "",
      Recipient: m.recipient_type === "staff" && m.recipient_staff_id
        ? (staffMap.get(m.recipient_staff_id) || "Staff")
        : "All",
    })));

    // Orders
    addSheet("Orders", (ordersRes.data || []).map((o: any) => ({
      "Order #": o.order_number || "",
      Date: fmtDate(o.created_at),
      Time: fmtTime(o.created_at),
      Type: o.order_type || "",
      Status: o.status || "",
      Items: Array.isArray(o.items)
        ? o.items.map((it: any) => `${it.quantity || 1}× ${it.name || it.item_name || ""}`.trim()).join("; ")
        : "",
      Subtotal: o.subtotal ?? "",
      Total: o.total ?? "",
      "Pickup Time": fmtDateTime(o.pickup_time),
      Notes: o.notes || "",
    })));

    // Fallback Reservations
    addSheet("Fallback Reservations", (fallbackRes.data || []).map((f: any) => ({
      Date: fmtDate(f.reservation_time),
      Time: fmtTime(f.reservation_time),
      "Party Size": f.party_size ?? "",
      "Duration (min)": f.duration_minutes ?? "",
      Status: f.status || "",
      "Special Requests": f.special_requests || "",
      Allergens: f.allergen_info || "",
      Notes: f.notes || "",
    })));

    // Missed Calls
    addSheet("Missed Calls", (missedRes.data || []).map((m: any) => ({
      Date: fmtDate(m.call_time),
      Time: fmtTime(m.call_time),
      Reason: m.reason || "",
      "Followed Up": yn(m.followed_up),
      Notes: m.notes || "",
    })));

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const today = new Date().toISOString().slice(0, 10);
    const filename = `Aivia-DSAR-${sanitize(biz.business_name)}-${sanitize(displayName)}-${today}.xlsx`;

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("export-customer-data error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
