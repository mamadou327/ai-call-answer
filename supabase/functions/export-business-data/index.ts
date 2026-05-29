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
const fmtDuration = (ms?: number | null) => {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};
const yn = (v: any) => (v ? "Yes" : "No");
const sanitize = (s: string) =>
  s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Business";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

    const { data: businesses, error: bizErr } = await admin
      .from("businesses").select("*").eq("owner_id", user.id);
    if (bizErr) throw bizErr;
    if (!businesses?.length) {
      return new Response(JSON.stringify({ error: "No business found for this account" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wb = XLSX.utils.book_new();
    const multi = businesses.length > 1;
    const bizCol = (name: string) => (multi ? { Business: name } : {});

    const all: Record<string, any[]> = {
      Clients: [],
      Bookings: [],
      "Call Logs": [],
      Messages: [],
      Orders: [],
      "Fallback Reservations": [],
      "Missed Calls": [],
      Staff: [],
      Services: [],
      "Business Profile": [],
    };

    for (const biz of businesses) {
      const bizId = biz.id;
      const bn = biz.business_name;

      const [
        customersRes, bookingsRes, callsRes, msgsRes,
        ordersRes, fallbackRes, missedRes, staffRes, servicesRes,
        settingsRes, hoursRes,
      ] = await Promise.all([
        admin.from("customers").select("*").eq("business_id", bizId),
        admin.from("bookings").select("*").eq("business_id", bizId).order("start_time", { ascending: false }),
        admin.from("calls_log").select("*").eq("business_id", bizId).order("created_at", { ascending: false }),
        admin.from("messages").select("*").eq("business_id", bizId).order("created_at", { ascending: false }),
        admin.from("orders").select("*").eq("business_id", bizId).order("created_at", { ascending: false }),
        admin.from("fallback_reservations").select("*").eq("business_id", bizId).order("reservation_time", { ascending: false }),
        admin.from("missed_calls").select("*").eq("business_id", bizId).order("call_time", { ascending: false }),
        admin.from("staff").select("*").eq("business_id", bizId),
        admin.from("services").select("*").eq("business_id", bizId),
        admin.from("business_settings").select("*").eq("business_id", bizId).maybeSingle(),
        admin.from("opening_hours").select("*").eq("business_id", bizId).order("day_of_week"),
      ]);

      const staffIdMap = new Map((staffRes.data || []).map((s: any) => [s.id, s.name]));
      const serviceMap = new Map((servicesRes.data || []).map((s: any) => [s.id, s.name]));
      const bookingMap = new Map((bookingsRes.data || []).map((b: any) => [b.id, b]));

      for (const c of customersRes.data || []) {
        all.Clients.push({
          Name: c.name || "",
          Phone: c.phone || "",
          Email: c.email || "",
          "Total Visits": c.total_visits ?? "",
          "First Visit": fmtDate(c.first_visit_date),
          "Marketing Consent": yn(c.marketing_consent),
          "Preferred Language": c.preferred_language || "",
          "How Heard": c.how_heard || "",
          "Notes/Preferences": c.notes_preferences || "",
          Blocked: yn(c.is_blocked),
          "Created At": fmtDate(c.created_at) + " " + fmtTime(c.created_at),
          ...bizCol(bn),
        });
      }

      for (const b of bookingsRes.data || []) {
        all.Bookings.push({
          "Booking Code": b.booking_code || "",
          "Client Name": b.customer_name || "",
          "Client Phone": b.customer_phone || "",
          "Client Email": b.customer_email || "",
          Service: b.service_id ? (serviceMap.get(b.service_id) || "") : "",
          Date: fmtDate(b.start_time),
          Time: fmtTime(b.start_time),
          "End Time": fmtTime(b.end_time),
          Staff: b.staff_id ? (staffIdMap.get(b.staff_id) || "") : "",
          "Party Size": b.party_size ?? "",
          Status: b.status || "",
          "Payment Status": b.payment_status || "",
          "Deposit Amount": b.deposit_amount ?? "",
          "Deposit Paid At": b.deposit_paid_at ? fmtDate(b.deposit_paid_at) + " " + fmtTime(b.deposit_paid_at) : "",
          "Order Total": b.order_total ?? "",
          "Special Requests": b.special_requests || "",
          Notes: b.notes || "",
          "Cancelled At": b.cancelled_at ? fmtDate(b.cancelled_at) + " " + fmtTime(b.cancelled_at) : "",
          "Created By": b.created_by || "",
          "Created At": fmtDate(b.created_at) + " " + fmtTime(b.created_at),
          ...bizCol(bn),
        });
      }

      for (const c of callsRes.data || []) {
        const linkedCode = c.booking_id ? (bookingMap.get(c.booking_id)?.booking_code || "") : "";
        all["Call Logs"].push({
          Date: fmtDate(c.created_at),
          Time: fmtTime(c.created_at),
          "Caller Name": c.caller_name || "",
          "Caller Number": c.caller_phone || "",
          "To Number": c.to_number || "",
          Type: c.call_type || "",
          Outcome: c.call_outcome || "",
          Duration: fmtDuration(c.duration_ms),
          Summary: c.summary || "",
          Transcript: c.transcription || "",
          Tags: Array.isArray(c.tags) ? c.tags.join(", ") : "",
          "Linked Booking": linkedCode,
          "Recording URL": c.recording_url || "",
          ...bizCol(bn),
        });
      }

      for (const m of msgsRes.data || []) {
        all.Messages.push({
          Date: fmtDate(m.created_at),
          Time: fmtTime(m.created_at),
          "Caller Name": m.caller_name || "",
          "Caller Phone": m.caller_phone || "",
          Content: m.content || "",
          Urgent: yn(m.is_urgent),
          Read: yn(m.is_read),
          Recipient: m.recipient_type === "staff" && m.recipient_staff_id
            ? (staffIdMap.get(m.recipient_staff_id) || "Staff")
            : "All",
          ...bizCol(bn),
        });
      }

      for (const o of ordersRes.data || []) {
        const itemsStr = Array.isArray(o.items)
          ? o.items.map((it: any) =>
              `${it.quantity || 1}× ${it.name || it.item_name || ""}`.trim()
            ).join("; ")
          : "";
        all.Orders.push({
          "Order #": o.order_number || "",
          Date: fmtDate(o.created_at),
          Time: fmtTime(o.created_at),
          "Customer Name": o.customer_name || "",
          "Customer Phone": o.customer_phone || "",
          "Customer Email": o.customer_email || "",
          Type: o.order_type || "",
          Status: o.status || "",
          Items: itemsStr,
          Subtotal: o.subtotal ?? "",
          Total: o.total ?? "",
          "Pickup Time": o.pickup_time ? fmtDate(o.pickup_time) + " " + fmtTime(o.pickup_time) : "",
          Notes: o.notes || "",
          ...bizCol(bn),
        });
      }

      for (const f of fallbackRes.data || []) {
        all["Fallback Reservations"].push({
          Date: fmtDate(f.reservation_time),
          Time: fmtTime(f.reservation_time),
          "Customer Name": f.customer_name || "",
          "Customer Phone": f.customer_phone || "",
          "Customer Email": f.customer_email || "",
          "Party Size": f.party_size ?? "",
          "Duration (min)": f.duration_minutes ?? "",
          Status: f.status || "",
          "Special Requests": f.special_requests || "",
          Allergens: f.allergen_info || "",
          Notes: f.notes || "",
          ...bizCol(bn),
        });
      }

      for (const m of missedRes.data || []) {
        all["Missed Calls"].push({
          Date: fmtDate(m.call_time),
          Time: fmtTime(m.call_time),
          "Caller Name": m.caller_name || "",
          "Caller Phone": m.caller_phone || "",
          Reason: m.reason || "",
          "Followed Up": yn(m.followed_up),
          Notes: m.notes || "",
          ...bizCol(bn),
        });
      }

      for (const s of staffRes.data || []) {
        all.Staff.push({
          Name: s.name || "",
          Role: s.role || "",
          Title: s.title || "",
          Email: s.email || "",
          Phone: s.phone || "",
          Chair: s.chair || "",
          "AI Enabled": yn(s.ai_enabled),
          "Is Owner": yn(s.is_business_owner),
          ...bizCol(bn),
        });
      }

      for (const s of servicesRes.data || []) {
        all.Services.push({
          Name: s.name || "",
          Category: s.category || "",
          "Duration (min)": s.duration_minutes ?? "",
          Price: s.price ?? "",
          "Deposit Required": yn(s.deposit_required),
          "Deposit Amount": s.deposit_amount ?? "",
          Description: s.description || "",
          ...bizCol(bn),
        });
      }

      const settings = settingsRes.data || {};
      const hoursStr = (hoursRes.data || [])
        .map((h: any) => `${DAYS[h.day_of_week]}: ${h.is_closed ? "Closed" : `${h.open_time || ""}–${h.close_time || ""}`}`)
        .join("\n");
      const profile: Array<{ Field: string; Value: any }> = [
        { Field: "Business Name", Value: biz.business_name },
        { Field: "Business Type", Value: biz.business_type || "" },
        { Field: "Cuisine Type", Value: biz.cuisine_type || "" },
        { Field: "Address", Value: biz.address || "" },
        { Field: "Main Phone", Value: biz.main_phone || "" },
        { Field: "Secondary Phone", Value: biz.secondary_phone || "" },
        { Field: "Aivia Number", Value: biz.assigned_aivia_number || "" },
        { Field: "Website", Value: biz.website || "" },
        { Field: "Booking Slug", Value: biz.booking_slug || "" },
        { Field: "Custom Domain", Value: biz.custom_booking_domain || "" },
        { Field: "Online Booking Enabled", Value: yn(biz.online_booking_enabled) },
        { Field: "Country", Value: settings.country || "" },
        { Field: "Currency", Value: settings.currency || "" },
        { Field: "Primary Language", Value: settings.primary_language || "" },
        { Field: "Assistant Name", Value: settings.assistant_name || "" },
        { Field: "Tone", Value: settings.tone || "" },
        { Field: "Voice Gender", Value: settings.voice_gender || "" },
        { Field: "Voice Speed", Value: settings.voice_speed || "" },
        { Field: "Min Booking Notice (hrs)", Value: settings.min_booking_notice_hours ?? "" },
        { Field: "Min Cancellation Notice (hrs)", Value: settings.min_cancellation_notice_hours ?? "" },
        { Field: "Max Days Advance", Value: settings.max_days_advance ?? "" },
        { Field: "SMS Reminder (hrs)", Value: settings.sms_reminder_hours ?? "" },
        { Field: "Cancellation Policy", Value: settings.cancellation_policy || "" },
        { Field: "Opening Hours", Value: hoursStr },
        { Field: "Created At", Value: fmtDate(biz.created_at) },
      ];
      if (multi) profile.unshift({ Field: "— Business —", Value: bn });
      all["Business Profile"].push(...profile);
      if (multi) all["Business Profile"].push({ Field: "", Value: "" });
    }

    const sheetOrder = [
      "Business Profile", "Clients", "Bookings", "Call Logs", "Messages",
      "Orders", "Fallback Reservations", "Missed Calls", "Staff", "Services",
    ];
    for (const name of sheetOrder) {
      const rows = all[name];
      const ws = rows.length
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([["(no records)"]]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    }

    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const today = new Date().toISOString().slice(0, 10);
    const filename = `Aivia-Data-Export-${sanitize(businesses[0].business_name)}-${today}.xlsx`;

    return new Response(buf, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: any) {
    console.error("export-business-data error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
