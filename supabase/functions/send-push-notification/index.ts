import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "mailto:support@aiviaapp.co.uk";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
    console.log("[send-push] VAPID configured");
  } catch (e) {
    console.error("[send-push] VAPID setup failed", e);
  }
} else {
  console.error("[send-push] VAPID keys missing at boot");
}

interface Body {
  business_id?: string;
  user_id?: string;
  staff_id?: string | null; // when set, restrict staff push recipients to this staff_id (owners still receive)
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const internalSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!internalSecret || provided !== internalSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: "VAPID keys not configured" }, 500);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { business_id, user_id, staff_id, title, body: message, url, tag } = body;
  if ((!business_id && !user_id) || !title || !message) {
    return json(
      { error: "Missing required fields: (business_id or user_id), title, body" },
      400,
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Build recipient user_id list
  let targetUserIds: string[] | null = null;
  if (user_id) {
    targetUserIds = [user_id];
  } else if (business_id) {
    // Owner always receives
    const { data: biz } = await supabase
      .from("businesses")
      .select("owner_id")
      .eq("id", business_id)
      .maybeSingle();
    const ownerId = biz?.owner_id as string | undefined;

    // Staff members of this business — optionally filtered by linked_staff_id
    let smQuery = supabase
      .from("staff_memberships")
      .select("user_id, linked_staff_id")
      .eq("business_id", business_id)
      .eq("status", "active");
    if (staff_id) smQuery = smQuery.eq("linked_staff_id", staff_id);
    const { data: memberships } = await smQuery;

    const set = new Set<string>();
    if (ownerId) set.add(ownerId);
    // If staff_id was provided, only include matching staff. If NOT provided,
    // this is a broadcast (e.g. missed call / message) → only send to owner.
    if (staff_id && memberships) {
      for (const m of memberships) if (m.user_id) set.add(m.user_id as string);
    }
    targetUserIds = Array.from(set);
  }

  if (!targetUserIds || targetUserIds.length === 0) {
    return json({ sent: 0, message: "No target users" });
  }

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, subscription, user_id")
    .in("user_id", targetUserIds);

  if (error) {
    console.error("[send-push] query error", error);
    return json({ error: error.message }, 500);
  }
  if (!subs || subs.length === 0) {
    return json({ sent: 0, message: "No subscribers", targets: targetUserIds.length });
  }

  const payload = JSON.stringify({
    title,
    body: message,
    url: url || "/dashboard",
    tag: tag || "aivia",
  });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
        } else {
          console.error("[send-push] send failed", status, err?.body || err?.message);
        }
      }
    }),
  );

  console.log(
    `[send-push] delivered=${sent} removed=${removed} total=${subs.length} targets=${targetUserIds.length}`,
  );
  return json({ sent, removed, total: subs.length, targets: targetUserIds.length });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
