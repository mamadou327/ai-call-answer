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

    const newWebsite = url || biz.website || null;

    // 1. Update businesses row — only fill fields that are blank, never overwrite
    const businessUpdates: Record<string, any> = {
      website: newWebsite,
      website_last_synced_at: new Date().toISOString(),
      website_last_synced_url: newWebsite,
      website_pending_changes: null,
    };

    const { data: fullBiz } = await supabase
      .from("businesses")
      .select("business_name, address, main_phone, business_type, logo_url, social_instagram, social_facebook, social_tiktok, social_twitter, social_youtube, payment_methods")
      .eq("id", businessId)
      .maybeSingle();

    const fillIfEmpty = (field: string, value: any) => {
      if (value == null || value === "") return;
      const current = (fullBiz as any)?.[field];
      if (current == null || current === "" || (Array.isArray(current) && current.length === 0)) {
        businessUpdates[field] = value;
      }
    };

    fillIfEmpty("business_name", typeof extracted.business_name === "string" ? extracted.business_name.trim() : null);
    fillIfEmpty("address", typeof extracted.address === "string" ? extracted.address.trim() : null);
    fillIfEmpty("main_phone", typeof extracted.phone === "string" ? extracted.phone.trim() : null);
    fillIfEmpty("logo_url", typeof extracted.logo_url === "string" ? extracted.logo_url.trim() : null);
    if (typeof extracted.business_type === "string") {
      const bt = extracted.business_type.toLowerCase().trim();
      const validTypes = ["salon", "barbershop", "spa", "clinic", "restaurant", "cafe", "bar", "other"];
      if (validTypes.includes(bt)) fillIfEmpty("business_type", bt);
    }
    if (extracted.social && typeof extracted.social === "object") {
      fillIfEmpty("social_instagram", extracted.social.instagram);
      fillIfEmpty("social_facebook", extracted.social.facebook);
      fillIfEmpty("social_tiktok", extracted.social.tiktok);
      fillIfEmpty("social_twitter", extracted.social.twitter);
      fillIfEmpty("social_youtube", extracted.social.youtube);
    }
    if (Array.isArray(extracted.payment_methods) && extracted.payment_methods.length) {
      const pm = extracted.payment_methods
        .map((x: any) => String(x).toLowerCase().trim())
        .filter((x: string) => ["card", "cash", "contactless", "apple_pay", "google_pay", "bank_transfer"].includes(x));
      if (pm.length) fillIfEmpty("payment_methods", pm);
    }

    await supabase.from("businesses").update(businessUpdates).eq("id", businessId);

    // 2. business_settings — cancellation policy, window, languages
    const settingsPayload: Record<string, any> = { business_id: businessId };
    if (typeof extracted.cancellation_policy === "string" && extracted.cancellation_policy.trim()) {
      settingsPayload.cancellation_policy = extracted.cancellation_policy.trim();
    }
    if (typeof extracted.cancellation_window_hours === "number" && extracted.cancellation_window_hours > 0) {
      settingsPayload.min_cancellation_notice_hours = Math.round(extracted.cancellation_window_hours);
    }
    if (Array.isArray(extracted.languages_spoken) && extracted.languages_spoken.length) {
      settingsPayload.primary_language = String(extracted.languages_spoken[0]).trim();
    }
    if (Object.keys(settingsPayload).length > 1) {
      await supabase.from("business_settings").upsert(settingsPayload, { onConflict: "business_id" });
    }

    // 2b. Staff — insert any not already present (case-insensitive name match)
    if (Array.isArray(extracted.staff) && extracted.staff.length) {
      const { data: existingStaff } = await supabase
        .from("staff")
        .select("name")
        .eq("business_id", businessId);
      const existingStaffNames = new Set((existingStaff || []).map((s: any) => String(s.name).toLowerCase().trim()));
      const staffToInsert = extracted.staff
        .filter((s: any) => s && typeof s.name === "string" && s.name.trim().length > 1)
        .filter((s: any) => !existingStaffNames.has(s.name.toLowerCase().trim()))
        .map((s: any) => ({
          business_id: businessId,
          name: String(s.name).trim().slice(0, 100),
          role: typeof s.role === "string" && s.role.trim() ? s.role.trim().slice(0, 100) : "Staff",
          title: typeof s.role === "string" && s.role.trim() ? s.role.trim().slice(0, 100) : null,
        }));
      if (staffToInsert.length) {
        await supabase.from("staff").insert(staffToInsert);
      }
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
        .map((s: any) => {
          const cat = typeof s.category === "string" && s.category.trim()
            ? s.category.trim().slice(0, 100)
            : "Imported";
          const dur = typeof s.duration_minutes === "number" && s.duration_minutes > 0
            ? Math.round(s.duration_minutes)
            : 30;
          return {
            business_id: businessId,
            name: String(s.name).trim().slice(0, 200),
            category: cat,
            duration_minutes: dur,
            price: priceToNumber(s.price),
          };
        });
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
