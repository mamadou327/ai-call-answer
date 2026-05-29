import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
};
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
const fmtDuration = (ms: number | null) => {
  if (!ms || ms < 0) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const sanitize = (s: string) =>
  s.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Business";

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
      .from("businesses").select("id, business_name").eq("owner_id", user.id);
    if (bizErr) throw bizErr;
    if (!businesses?.length) {
      return new Response(JSON.stringify({ error: "No business found for this account" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wb = XLSX.utils.book_new();
    const multi = businesses.length > 1;

    const clientsAll: any[] = [];
    const bookingsAll: any[] = [];
    const callsAll: any[] = [];
    const staffAll: any[] = [];

    for (const biz of businesses) {
      const bizId = biz.id;
      const bizTag = multi ? ` — ${biz.business_name}`.slice(0, 25) : "";

      const [customersRes, bookingsRes, callsRes, staffRes, servicesRes] = await Promise.all([
        admin.from("customers").select("name, phone, email").eq("business_id", bizId),
        admin.from("bookings")
          .select("customer_name, service_id, staff_id, start_time")
          .eq("business_id", bizId).order("start_time", { ascending: false }),
        admin.from("calls_log")
          .select("created_at, caller_phone, duration_ms, call_outcome")
          .eq("business_id", bizId).order("created_at", { ascending: false }),
        admin.from("staff").select("name, role, email").eq("business_id", bizId),
        admin.from("services").select("id, name").eq("business_id", bizId),
      ]);

      const staffMap = new Map((staffRes.data || []).map((s: any) => [s.name, s]));
      // also need staff by id for bookings
      const { data: staffById } = await admin.from("staff").select("id, name").eq("business_id", bizId);
      const staffIdMap = new Map((staffById || []).map((s: any) => [s.id, s.name]));
      const serviceMap = new Map((servicesRes.data || []).map((s: any) => [s.id, s.name]));

      clientsAll.push(...(customersRes.data || []).map((c: any) => ({
        "Name": c.name || "",
        "Phone Number": c.phone || "",
        "Email": c.email || "",
        ...(multi ? { "Business": biz.business_name } : {}),
      })));

      bookingsAll.push(...(bookingsRes.data || []).map((b: any) => ({
        "Client Name": b.customer_name || "",
        "Service": b.service_id ? (serviceMap.get(b.service_id) || "") : "",
        "Date": b.start_time ? fmtDate(b.start_time) : "",
        "Time": b.start_time ? fmtTime(b.start_time) : "",
        "Staff Member": b.staff_id ? (staffIdMap.get(b.staff_id) || "") : "",
        ...(multi ? { "Business": biz.business_name } : {}),
      })));

      callsAll.push(...(callsRes.data || []).map((c: any) => ({
        "Date": c.created_at ? fmtDate(c.created_at) : "",
        "Time": c.created_at ? fmtTime(c.created_at) : "",
        "Caller Number": c.caller_phone || "",
        "Duration": fmtDuration(c.duration_ms),
        "Outcome": c.call_outcome || "",
        ...(multi ? { "Business": biz.business_name } : {}),
      })));

      staffAll.push(...(staffRes.data || []).map((s: any) => ({
        "Name": s.name || "",
        "Role": s.role || "",
        "Email": s.email || "",
        ...(multi ? { "Business": biz.business_name } : {}),
      })));
    }

    const addSheet = (name: string, rows: any[], headers: string[]) => {
      const ws = rows.length
        ? XLSX.utils.json_to_sheet(rows, { header: headers })
        : XLSX.utils.aoa_to_sheet([headers]);
      XLSX.utils.book_append_sheet(wb, ws, name);
    };

    const baseHeaders = (h: string[]) => multi ? [...h, "Business"] : h;
    addSheet("Clients", clientsAll, baseHeaders(["Name", "Phone Number", "Email"]));
    addSheet("Bookings", bookingsAll, baseHeaders(["Client Name", "Service", "Date", "Time", "Staff Member"]));
    addSheet("Call Logs", callsAll, baseHeaders(["Date", "Time", "Caller Number", "Duration", "Outcome"]));
    addSheet("Staff", staffAll, baseHeaders(["Name", "Role", "Email"]));

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
