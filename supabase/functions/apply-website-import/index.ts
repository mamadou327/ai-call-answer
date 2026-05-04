// Apply website-extracted data to a business: services, opening_hours,
// cancellation policy, and website fields. Inserts a website_sync_log row.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_NAME_TO_NUM: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function parseTimeRange(value: unknown): { open: string | null; close: string | null; closed: boolean } {
  if (value == null) return { open: null, close: null, closed: true };
  const s = String(value).toLowerCase().trim();
  if (!s || /(closed|off|n\/a)/.test(s)) return { open: null, close: null, closed: true };
  // Match patterns like "9:00am - 5:30pm" or "09:00-17:00"
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return { open: null, close: null, closed: false };
  const to24 = (h: string, mm: string | undefined, ap: string | undefined) => {
    let hour = parseInt(h, 10);
    const minute = mm ? parseInt(mm, 10) : 0;
    if (ap) {
      const pm = ap.toLowerCase() === "pm";
      if (pm && hour < 12) hour += 12;
      if (!pm && hour === 12) hour = 0;
    }
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  };
  return {
    open: to24(m[1], m[2], m[3] || m[6]),
    close: to24(m[4], m[5], m[6]),
    closed: false,
  };
}

function priceToNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const m = value.match(/[\d]+(?:[.,]\d+)?/);
    if (m) return parseFloat(m[0].replace(",", "."));
  }
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { businessId, extracted, url, source } = body as {
      businessId?: string; extracted?: any; url?: string; source?: string;
    };
    if (!businessId || !extracted) {
      return new Response(JSON.stringify({ error: "Missing businessId or extracted" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: biz, error: bizErr } = await supabase
      .from("businesses")
      .select("id, owner_id, website")
      .eq("id", businessId)
      .maybeSingle();
    if (bizErr || !biz) {
      return new Response(JSON.stringify({ error: "Business not found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Update business website + sync timestamp + clear pending changes
    const newWebsite = url || biz.website || null;
    await supabase
      .from("businesses")
      .update({
        website: newWebsite,
        website_last_synced_at: new Date().toISOString(),
        website_last_synced_url: newWebsite,
        website_pending_changes: null,
      })
      .eq("id", businessId);

    // 2. Cancellation policy on business_settings
    if (typeof extracted.cancellation_policy === "string" && extracted.cancellation_policy.trim()) {
      await supabase
        .from("business_settings")
        .upsert(
          { business_id: businessId, cancellation_policy: extracted.cancellation_policy.trim() },
          { onConflict: "business_id" },
        );
    }

    // 3. Services — insert any not already present (case-insensitive name match)
    if (Array.isArray(extracted.services) && extracted.services.length) {
      const { data: existing } = await supabase
        .from("services")
        .select("name")
        .eq("business_id", businessId);
      const existingNames = new Set((existing || []).map((s: any) => String(s.name).toLowerCase().trim()));
      const toInsert = extracted.services
        .filter((s: any) => s && typeof s.name === "string" && s.name.trim())
        .filter((s: any) => !existingNames.has(s.name.toLowerCase().trim()))
        .map((s: any) => ({
          business_id: businessId,
          name: String(s.name).trim().slice(0, 200),
          category: "Imported",
          duration_minutes: 30,
          price: priceToNumber(s.price),
        }));
      if (toInsert.length) {
        await supabase.from("services").insert(toInsert);
      }
    }

    // 4. Opening hours — replace per-day
    if (extracted.opening_hours && typeof extracted.opening_hours === "object") {
      const upserts: Array<{ business_id: string; day_of_week: number; open_time: string | null; close_time: string | null; is_closed: boolean }> = [];
      for (const [k, v] of Object.entries(extracted.opening_hours)) {
        const dayNum = DAY_NAME_TO_NUM[k.toLowerCase().trim()];
        if (dayNum === undefined) continue;
        const parsed = parseTimeRange(v);
        upserts.push({
          business_id: businessId,
          day_of_week: dayNum,
          open_time: parsed.open,
          close_time: parsed.close,
          is_closed: parsed.closed || (!parsed.open && !parsed.close),
        });
      }
      if (upserts.length) {
        await supabase
          .from("opening_hours")
          .upsert(upserts, { onConflict: "business_id,day_of_week" });
      }
    }

    // 5. Log
    await supabase.from("website_sync_log").insert({
      business_id: businessId,
      url: newWebsite,
      changes_detected: source === "weekly" ? true : false,
      changes_summary: extracted,
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
